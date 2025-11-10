"""LiveKit worker for dynamic agent instantiation from workflow configurations."""

import asyncio
import json
import logging
from uuid import UUID

from dotenv import load_dotenv
from livekit.agents import AgentSession, JobContext, RoomOutputOptions, WorkerOptions, cli

from .dependencies import get_supabase_client
from .repositories.supabase_repo import SupabaseWorkflowRepository
from .runtime import AgentFactory, UserData, WorkflowLoader, get_workflow_cache

logger = logging.getLogger("livekit-worker")
logger.setLevel(logging.INFO)

# Silence noisy debug logs
logging.getLogger("hpack.hpack").setLevel(logging.WARNING)
logging.getLogger("hpack.table").setLevel(logging.WARNING)

load_dotenv(".env.local")


async def entrypoint(ctx: JobContext):
    """
    LiveKit worker entrypoint that loads workflows dynamically.

    The workflow ID is extracted from job metadata (for explicit dispatch)
    or room metadata (for automatic dispatch) with key 'workflow_id'.
    """
    logger.info(f"Worker started for room: {ctx.room.name}")

    ready_event = asyncio.Event()

    def handle_ready_signal(packet) -> None:
        try:
            payload = packet.data.decode("utf-8") if isinstance(packet.data, bytes) else str(packet.data)
            data = json.loads(payload)
        except Exception:
            return

        if isinstance(data, dict) and data.get("type") == "ready_to_listen":
            if not ready_event.is_set():
                ready_event.set()
                try:
                    ctx.room.off("data_received", handle_ready_signal)
                except Exception:
                    pass

    ctx.room.on("data_received", handle_ready_signal)

    # Extract workflow identifier from job metadata (explicit dispatch) or room metadata
    # Debug: Log raw metadata
    logger.info(f"Raw ctx.job.metadata: {ctx.job.metadata}")
    logger.info(f"Raw ctx.room.metadata: {ctx.room.metadata}")
    
    job_metadata = {}
    if ctx.job.metadata:
        try:
            job_metadata = json.loads(ctx.job.metadata)
            logger.info(f"Parsed job_metadata: {job_metadata}")
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse job metadata: {ctx.job.metadata}")
    
    room_metadata = {}
    if ctx.room.metadata:
        try:
            room_metadata = json.loads(ctx.room.metadata)
            logger.info(f"Parsed room_metadata: {room_metadata}")
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse room metadata: {ctx.room.metadata}")
    
    # Prefer job metadata over room metadata
    workflow_id_str = job_metadata.get("workflow_id") or room_metadata.get("workflow_id")
    workflow_name = job_metadata.get("workflow_name") or room_metadata.get("workflow_name")
    mode = job_metadata.get("mode") or room_metadata.get("mode")

    if not workflow_id_str and not workflow_name:
        logger.error("No workflow_id or workflow_name in job or room metadata")
        raise ValueError("Job or room must have workflow_id or workflow_name in metadata")

    # Initialize repository and loader
    client = get_supabase_client()
    repository = SupabaseWorkflowRepository(client)
    loader = WorkflowLoader(repository)
    cache = get_workflow_cache()

    # Load workflow configuration
    workflow_config = None
    workflow_id: UUID | None = None

    if workflow_id_str:
        workflow_id = UUID(workflow_id_str)

    version_id = None
    version_id_str = job_metadata.get("version_id") or room_metadata.get("version_id")
    if version_id_str:
        try:
            version_id = UUID(version_id_str)
        except ValueError as exc:
            logger.error(f"Invalid version_id in metadata: {version_id_str}")
            raise ValueError("Invalid version_id in metadata") from exc

    if version_id:
        workflow_config = cache.get(version_id)
        if not workflow_config:
            logger.info(f"Loading workflow version {version_id} from database")
            workflow_config = await loader.load_workflow_version(version_id)
            if workflow_config:
                cache.set(version_id, workflow_config)
                workflow_id = workflow_config.workflow_id
            else:
                logger.error(f"Failed to load workflow version {version_id}. The workflow may have no agents configured.")
                raise ValueError("Workflow version not found or has no agents configured")
        elif not workflow_id:
            workflow_id = workflow_config.workflow_id
    elif workflow_id:
        logger.info(f"Loading published version of workflow {workflow_id}")
        workflow_config = await loader.load_workflow(workflow_id, use_draft=False)
        if workflow_config:
            cache.set(workflow_config.version_id, workflow_config)
    else:
        # Lookup workflow by name (for convenience)
        logger.info(f"Looking up workflow by name: {workflow_name}")
        # This would require a new repository method to find by name
        # For now, raise error requiring workflow_id
        raise ValueError("workflow_name lookup not implemented yet; use workflow_id")

    if not workflow_config:
        logger.error(f"Failed to load workflow configuration")
        raise ValueError("Workflow configuration not found or has no published version")

    logger.info(
        f"Loaded workflow: {workflow_config.workflow_name} "
        f"(version {workflow_config.version_number})"
    )

    # Create agent factory
    factory = AgentFactory()

    # Instantiate all agents
    agent_instances = {}
    for agent_id, agent_config in workflow_config.agents.items():
        logger.info(f"Creating agent: {agent_config.name}")
        agent = factory.create_agent(agent_config, workflow_config)
        agent_instances[agent_id] = agent

    # Create shared userdata
    userdata = UserData(
        ctx=ctx,
        personas=agent_instances,
        workflow_config=workflow_config,
    )

    # Get entry agent
    entry_agent = agent_instances.get(workflow_config.entry_agent_id)
    if not entry_agent:
        logger.error(f"Entry agent {workflow_config.entry_agent_id} not found")
        raise ValueError(f"Entry agent not found in workflow")

    logger.info(f"Starting session with entry agent: {entry_agent.agent_name}")

    # Create and start session
    session = AgentSession[UserData](userdata=userdata)

    # Wait for tester participant and ready signal before starting session
    try:
        if not ctx.room.isconnected():
            await ctx.connect()
    except Exception as exc:
        logger.warning("Failed to connect to room before participant wait: %s", exc)

    try:
        participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=10.0)
        logger.info("Tester participant connected: %s", participant.identity)
    except asyncio.TimeoutError:
        logger.warning("Timed out waiting for tester participant; proceeding without confirmation")

    try:
        await asyncio.wait_for(ready_event.wait(), timeout=5.0)
        logger.info("Received ready_to_listen signal; starting agent")
    except asyncio.TimeoutError:
        logger.warning("Timed out waiting for ready_to_listen signal; starting agent anyway")

    # Configure output options based on mode
    # For text mode, disable sync for faster text responses
    sync_transcription = mode != "text"
    logger.info(f"Mode: {mode}, sync_transcription: {sync_transcription}")

    await session.start(
        agent=entry_agent,
        room=ctx.room,
        room_output_options=RoomOutputOptions(
            sync_transcription=sync_transcription
        ),
    )

    logger.info("Session started successfully")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="starteragent"))

