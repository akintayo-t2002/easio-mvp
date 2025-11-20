"""FastAPI routes for workflow management API."""

import json
import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from livekit import api

from .dependencies import get_organization_id, get_repository, get_supabase_client
from .repositories.supabase_repo import SupabaseWorkflowRepository
from .repositories.integrations_repo import IntegrationConnectionRepository
from .config import get_settings
from .services import VaultError, delete_secret

logger = logging.getLogger(__name__)
from .schemas import (
    AgentNodeCreateRequest,
    AgentNodeResponse,
    AgentPathCreateRequest,
    AgentPathResponse,
    AgentPathUpdateRequest,
    AgentToolCreateRequest,
    AgentToolUpdateRequest,
    AgentToolResponse,
    IntegrationStatusResponse,
    PathVariableCreateRequest,
    PathVariableResponse,
    PathVariableUpdateRequest,
    WorkflowConfigResponse,
    WorkflowCreateRequest,
    WorkflowResponse,
    WorkflowSummaryResponse,
    WorkflowUpdateRequest,
    WorkflowVersionResponse,
    WorkflowVersionConfigUpdateRequest,
    WorkflowWithVersionResponse,
    WorkflowTestSessionResponse,
)

router = APIRouter()


# ==================== Health Check ====================


@router.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


# ==================== Workflow Endpoints ====================


@router.post(
    "/workflows",
    response_model=WorkflowWithVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_workflow(
    payload: WorkflowCreateRequest,
    org_id: UUID = Depends(get_organization_id),
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowWithVersionResponse:
    """Create a new workflow with initial draft version."""
    return await repo.create_workflow(org_id, payload)


@router.get("/workflows", response_model=list[WorkflowSummaryResponse])
async def list_workflows(
    org_id: UUID = Depends(get_organization_id),
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> list[WorkflowSummaryResponse]:
    """List all workflows for the organization."""
    return await repo.list_workflows(org_id)


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowResponse:
    """Get a specific workflow."""
    workflow = await repo.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )
    return workflow


@router.patch("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    payload: WorkflowUpdateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowResponse:
    """Update workflow name and/or description."""
    workflow = await repo.update_workflow(workflow_id, payload)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )
    return workflow


# ==================== Workflow Version Endpoints ====================


@router.post(
    "/workflows/{workflow_id}/versions",
    response_model=WorkflowVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_version(
    workflow_id: UUID,
    copy_from: Optional[UUID] = None,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowVersionResponse:
    """Create a new draft version, optionally copying from an existing version."""
    return await repo.create_version(workflow_id, copy_from)


@router.get("/workflow-versions/{version_id}", response_model=WorkflowVersionResponse)
async def get_version(
    version_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowVersionResponse:
    """Get a specific workflow version."""
    version = await repo.get_version(version_id)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_id} not found",
        )
    return version


@router.get("/workflows/{workflow_id}/versions/draft", response_model=WorkflowVersionResponse)
async def get_latest_draft(
    workflow_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowVersionResponse:
    """Get the latest draft version of a workflow."""
    version = await repo.get_latest_draft(workflow_id)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No draft version found for workflow {workflow_id}",
        )
    return version


@router.get(
    "/workflows/{workflow_id}/versions/published", response_model=WorkflowVersionResponse
)
async def get_published_version(
    workflow_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowVersionResponse:
    """Get the currently published version of a workflow."""
    version = await repo.get_published_version(workflow_id)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No published version found for workflow {workflow_id}",
        )
    return version


@router.post(
    "/workflow-versions/{version_id}/publish", response_model=WorkflowVersionResponse
)
async def publish_version(
    version_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowVersionResponse:
    """Publish a draft version."""
    try:
        return await repo.publish_version(version_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.patch(
    "/workflow-versions/{version_id}/config", response_model=WorkflowVersionResponse
)
async def update_version_config(
    version_id: UUID,
    payload: WorkflowVersionConfigUpdateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowVersionResponse:
    """Update workflow version config metadata."""
    version = await repo.update_version_config(version_id, payload.config)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_id} not found",
        )
    return version


@router.post(
    "/workflow-versions/{version_id}/test-session",
    response_model=WorkflowTestSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_session(
    version_id: UUID,
    org_id: UUID = Depends(get_organization_id),
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowTestSessionResponse:
    """Create a temporary LiveKit token for testing a workflow version via chat."""

    settings = get_settings()
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveKit credentials are not configured",
        )

    room_url = settings.next_public_livekit_url or settings.livekit_url
    if not room_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LiveKit URL is not configured",
        )

    version = await repo.get_version(version_id)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_id} not found",
        )

    workflow = await repo.get_workflow(version.workflow_id)
    if not workflow or workflow.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {version.workflow_id} not found",
        )

    room_name = f"workflow-test-{version_id.hex[:8]}-{uuid4().hex[:6]}"
    participant_identity = f"workflow-tester-{uuid4().hex}"
    participant_name = "Workflow Tester"
    metadata_payload = json.dumps(
        {
            "workflow_id": str(workflow.id),
            "version_id": str(version.id),
            "mode": "text",
        }
    )

    try:
        token = (
            api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(participant_identity)
            .with_name(participant_name)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room_create=True,
                    room=room_name,
                )
            )
            .with_room_config(
                api.RoomConfiguration(
                    metadata=metadata_payload,
                    agents=[
                        api.RoomAgentDispatch(
                            agent_name="starteragent",
                            metadata=metadata_payload,
                        )
                    ],
                )
            )
            .to_jwt()
        )

        # Note: The RoomConfiguration.agents array will auto-dispatch the worker
        # when the participant joins and creates the room. No explicit dispatch needed.
    except Exception as exc:  # pragma: no cover - low-level SDK failure
        logger = logging.getLogger("livekit-token")
        logger.exception("Failed to create LiveKit access token")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to create LiveKit token: {exc}",
        ) from exc

    return WorkflowTestSessionResponse(
        room_url=room_url,
        room_name=room_name,
        token=token,
        participant_identity=participant_identity,
    )


# ==================== Agent Node Endpoints ====================


@router.post(
    "/workflow-versions/{version_id}/agents",
    response_model=AgentNodeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_agent(
    version_id: UUID,
    payload: AgentNodeCreateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> AgentNodeResponse:
    """Create a new agent in a workflow version."""
    return await repo.create_agent(version_id, payload)


@router.get("/workflow-versions/{version_id}/agents", response_model=list[AgentNodeResponse])
async def list_agents(
    version_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> list[AgentNodeResponse]:
    """List all agents in a workflow version."""
    return await repo.list_agents(version_id)


@router.get("/agents/{agent_id}", response_model=AgentNodeResponse)
async def get_agent(
    agent_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> AgentNodeResponse:
    """Get a specific agent."""
    agent = await repo.get_agent(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )
    return agent


@router.put("/agents/{agent_id}", response_model=AgentNodeResponse)
async def update_agent(
    agent_id: UUID,
    payload: AgentNodeCreateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> AgentNodeResponse:
    """Update an existing agent."""
    return await repo.update_agent(agent_id, payload)


@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> None:
    """Delete an agent and its related resources."""
    success = await repo.delete_agent(agent_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )


# ==================== Agent Tool Endpoints ====================


@router.post(
    "/agents/{agent_id}/tools",
    response_model=AgentToolResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tool(
    agent_id: UUID,
    payload: AgentToolCreateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> AgentToolResponse:
    """Add a tool to an agent."""
    return await repo.create_tool(agent_id, payload)


@router.get("/agents/{agent_id}/tools", response_model=list[AgentToolResponse])
async def list_tools(
    agent_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> list[AgentToolResponse]:
    """List all tools for an agent."""
    return await repo.list_tools(agent_id)


@router.put("/tools/{tool_id}", response_model=AgentToolResponse)
async def update_tool(
    tool_id: UUID,
    payload: AgentToolUpdateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> AgentToolResponse:
    """Update a tool."""
    try:
        return await repo.update_tool(tool_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(
    tool_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> None:
    """Delete a tool."""
    success = await repo.delete_tool(tool_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool {tool_id} not found",
        )


# ==================== Agent Path Endpoints ====================


@router.post(
    "/agents/{agent_id}/paths",
    response_model=AgentPathResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_path(
    agent_id: UUID,
    payload: AgentPathCreateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> AgentPathResponse:
    """Create a path from this agent to another."""
    return await repo.create_path(agent_id, payload)


@router.get("/agents/{agent_id}/paths", response_model=list[AgentPathResponse])
async def list_paths(
    agent_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> list[AgentPathResponse]:
    """List all outgoing paths from an agent."""
    return await repo.list_paths(agent_id)


@router.delete("/paths/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_path(
    path_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> None:
    """Delete a path."""
    success = await repo.delete_path(path_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path {path_id} not found",
        )


@router.patch("/paths/{path_id}", response_model=AgentPathResponse)
async def update_path(
    path_id: UUID,
    payload: AgentPathUpdateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> AgentPathResponse:
    """Update a path's metadata."""
    path = await repo.update_path(path_id, payload)
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path {path_id} not found",
        )
    return path


# ==================== Path Variable Endpoints ====================


@router.post(
    "/paths/{path_id}/variables",
    response_model=PathVariableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_path_variable(
    path_id: UUID,
    payload: PathVariableCreateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> PathVariableResponse:
    """Add a required variable to a path."""
    return await repo.create_path_variable(path_id, payload)


@router.get("/paths/{path_id}/variables", response_model=list[PathVariableResponse])
async def list_path_variables(
    path_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> list[PathVariableResponse]:
    """List all variables for a path."""
    return await repo.list_path_variables(path_id)


@router.patch(
    "/path-variables/{variable_id}", response_model=PathVariableResponse
)
async def update_path_variable(
    variable_id: UUID,
    payload: PathVariableUpdateRequest,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> PathVariableResponse:
    """Update a path variable."""
    variable = await repo.update_path_variable(variable_id, payload)
    if not variable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path variable {variable_id} not found",
        )
    return variable


@router.delete("/path-variables/{variable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_path_variable(
    variable_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> None:
    """Delete a path variable."""
    success = await repo.delete_path_variable(variable_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path variable {variable_id} not found",
        )


# ==================== Complete Configuration Endpoint ====================


@router.get(
    "/workflow-versions/{version_id}/config", response_model=WorkflowConfigResponse
)
async def get_workflow_config(
    version_id: UUID,
    repo: SupabaseWorkflowRepository = Depends(get_repository),
) -> WorkflowConfigResponse:
    """Get complete workflow configuration including all agents, tools, and paths."""
    # Get version
    version = await repo.get_version(version_id)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_id} not found",
        )

    # Get workflow
    workflow = await repo.get_workflow(version.workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {version.workflow_id} not found",
        )

    # Get all agents
    agents = await repo.list_agents(version_id)

    # Get tools for all agents
    tools = {}
    for agent in agents:
        tools[agent.id] = await repo.list_tools(agent.id)

    # Get paths for all agents
    paths = {}
    for agent in agents:
        paths[agent.id] = await repo.list_paths(agent.id)

    # Get variables for all paths
    path_variables = {}
    for agent_paths in paths.values():
        for path in agent_paths:
            path_variables[path.id] = await repo.list_path_variables(path.id)

    return WorkflowConfigResponse(
        workflow=workflow,
        version=version,
        agents=agents,
        tools=tools,
        paths=paths,
        path_variables=path_variables,
        start_position=(version.config or {}).get("start_position"),
    )


# ==================== Integration Endpoints ====================


@router.get("/integrations/{integration_id}/status", response_model=IntegrationStatusResponse)
async def get_integration_status(
    integration_id: str,
    organization_id: UUID = Depends(get_organization_id),
) -> IntegrationStatusResponse:
    """Return the stored OAuth connection status for an integration."""

    repo = IntegrationConnectionRepository(get_supabase_client())
    connection = repo.get_connection(organization_id=organization_id, provider=integration_id)

    if not connection:
        return IntegrationStatusResponse(connected=False)

    return IntegrationStatusResponse(
        connected=True,
        connection_id=connection.id,
        connected_at=connection.updated_at,
        scope=connection.scope,
        email=getattr(connection, "profile_email", None),
    )


@router.delete("/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    integration_id: str,
    organization_id: UUID = Depends(get_organization_id),
) -> None:
    """Remove an integration connection and purge stored secrets."""

    repo = IntegrationConnectionRepository(get_supabase_client())
    connection = repo.get_connection(organization_id=organization_id, provider=integration_id)

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Integration {integration_id} is not connected",
        )

    settings = get_settings()
    secret_ids: list[str] = []
    if connection.refresh_token_secret_id:
        secret_ids.append(str(connection.refresh_token_secret_id))
    if connection.access_token_secret_id:
        secret_ids.append(str(connection.access_token_secret_id))

    vault_errors: list[Exception] = []
    for secret_id in secret_ids:
        try:
            await delete_secret(settings, secret_id=secret_id)
        except VaultError as exc:
            vault_errors.append(exc)

    repo.delete_connection(organization_id=organization_id, provider=integration_id)

    if vault_errors:
        logger.warning(
            "Vault deletion errors while disconnecting integration",
            extra={
                "provider": integration_id,
                "organization_id": str(organization_id),
                "connection_id": str(connection.id),
                "errors": [str(err) for err in vault_errors],
            },
        )

    logger.info(
        "Integration disconnected",
        extra={
            "provider": integration_id,
            "organization_id": str(organization_id),
            "connection_id": str(connection.id),
        },
    )
