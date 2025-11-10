"""Factory for creating dynamic LiveKit agents from configuration."""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from livekit.agents import JobContext
from livekit.agents.llm import function_tool
from livekit.agents.voice import Agent, RunContext
from livekit.plugins import assemblyai, cartesia, deepgram, openai, silero

from .config import AgentConfig, PathConfig, WorkflowRuntimeConfig
from .tool_registry import build_tool_functions

logger = logging.getLogger("agent-factory")

DEFAULT_CARTESIA_VOICE_ID = "5ee9feff-1265-424a-9d7f-8e4d431a12c7"


@dataclass
class UserData:
    """Stores data and agents to be shared across the session."""

    personas: dict[str, Agent] = field(default_factory=dict)
    prev_agent: Optional[Agent] = None
    ctx: Optional[JobContext] = None
    workflow_config: Optional[WorkflowRuntimeConfig] = None


RunContext_T = RunContext[UserData]


class BaseConfigurableAgent(Agent):
    """Base agent with dynamic configuration and context sharing."""

    def __init__(
        self,
        agent_config: AgentConfig,
        **kwargs: Any,
    ):
        self.agent_config = agent_config
        self.agent_id = str(agent_config.id)
        self.agent_name = agent_config.name

        super().__init__(
            instructions=agent_config.instructions,
            **kwargs,
        )

    async def on_enter(self) -> None:
        """Called when this agent becomes active."""
        logger.info(f"Entering agent: {self.agent_name}")

        userdata: UserData = self.session.userdata
        if userdata.ctx and userdata.ctx.room:
            try:
                participant = userdata.ctx.room.local_participant
                if participant:
                    await participant.set_attributes(
                        {"agent": self.agent_name, "agent_id": self.agent_id}
                    )
            except Exception as exc:
                logger.debug(
                    "Failed to set participant attributes for %s: %s",
                    self.agent_name,
                    exc,
                )

        chat_ctx = self.chat_ctx.copy()

        # Merge context from previous agent if exists
        if userdata.prev_agent:
            items_copy = self._truncate_chat_ctx(
                userdata.prev_agent.chat_ctx.items, keep_function_call=True
            )
            existing_ids = {item.id for item in chat_ctx.items}
            items_copy = [item for item in items_copy if item.id not in existing_ids]
            chat_ctx.items.extend(items_copy)

        # Add system message identifying this agent
        chat_ctx.add_message(
            role="system",
            content=f"You are now {self.agent_name}. Continue the conversation naturally.",
        )
        await self.update_chat_ctx(chat_ctx)
        self.session.generate_reply()

    def _truncate_chat_ctx(
        self,
        items: list,
        keep_last_n_messages: int = 6,
        keep_system_message: bool = False,
        keep_function_call: bool = False,
    ) -> list:
        """Truncate chat context to keep only recent messages."""

        def _valid_item(item: Any) -> bool:
            if not keep_system_message and item.type == "message" and item.role == "system":
                return False
            if not keep_function_call and item.type in [
                "function_call",
                "function_call_output",
            ]:
                return False
            return True

        new_items = []
        for item in reversed(items):
            if _valid_item(item):
                new_items.append(item)
            if len(new_items) >= keep_last_n_messages:
                break
        new_items = new_items[::-1]

        # Remove leading function calls
        while new_items and new_items[0].type in ["function_call", "function_call_output"]:
            new_items.pop(0)

        return new_items

    async def _transfer_to_agent(self, target_agent_id: str, context: RunContext_T) -> Agent:
        """Transfer to another agent while preserving context."""
        userdata = context.userdata
        current_agent = context.session.current_agent
        next_agent = userdata.personas.get(target_agent_id)

        if not next_agent:
            logger.error(f"Target agent {target_agent_id} not found")
            raise ValueError(f"Agent {target_agent_id} not found")

        userdata.prev_agent = current_agent
        return next_agent


class AgentFactory:
    """Factory for creating dynamic agents from configuration."""

    def __init__(self):
        pass

    def create_agent(self, agent_config: AgentConfig, workflow_config: WorkflowRuntimeConfig) -> Agent:
        """
        Create a LiveKit agent from configuration.

        Args:
            agent_config: Configuration for this agent
            workflow_config: Complete workflow configuration for path lookups

        Returns:
            Configured Agent instance with transfer tools
        """
        # Parse STT configuration
        stt = self._create_stt(agent_config.stt_config)

        # Parse LLM configuration
        llm = self._create_llm(agent_config.llm_config)

        # Parse TTS configuration
        tts = self._create_tts(agent_config.tts_config)

        # Parse VAD configuration
        vad = self._create_vad(agent_config.vad_config)

        # Create the agent instance
        agent = BaseConfigurableAgent(
            agent_config=agent_config,
            stt=stt,
            llm=llm,
            tts=tts,
            vad=vad,
        )

        # Register integration tools
        integration_tools: list[Any] = []
        for tool_func in build_tool_functions(agent_config.tools, workflow_config):
            bound_tool = tool_func.__get__(agent, type(agent))
            setattr(agent, tool_func.__name__, bound_tool)
            integration_tools.append(bound_tool)

        # Dynamically create transfer functions for each path
        transfer_tools: list[Any] = []
        for path in agent_config.paths:
            transfer_func = self._create_transfer_function(path)
            bound_method = transfer_func.__get__(agent, type(agent))
            setattr(agent, f"transfer_to_{path.id}", bound_method)
            transfer_tools.append(bound_method)

        if integration_tools or transfer_tools:
            existing_tools = getattr(agent, "_tools", [])
            merged_tools = existing_tools + integration_tools + transfer_tools
            seen = set()
            deduped_tools = []
            for tool in merged_tools:
                if tool in seen:
                    continue
                deduped_tools.append(tool)
                seen.add(tool)

            agent._tools = deduped_tools  # type: ignore[attr-defined]
            if hasattr(agent, "_chat_ctx"):
                agent._chat_ctx = agent._chat_ctx.copy(tools=agent._tools)  # type: ignore[attr-defined]

        return agent

    def _create_transfer_function(self, path: PathConfig) -> Callable:
        """Create a transfer function for a specific path."""

        target_agent_id = str(path.target_agent_id)
        base_name = path.name or target_agent_id
        tool_slug = self._slugify(base_name)
        tool_name = tool_slug if tool_slug.startswith("transfer_") else f"transfer_{tool_slug}"

        description_parts: list[str] = []

        destination_label = path.name or "the target agent"

        if path.description:
            description_parts.append(path.description.strip())

        if path.guard_condition:
            description_parts.append(f"Recommended trigger: {path.guard_condition}.")

        if getattr(path, "required_variables", None):
            required = ", ".join(var.name for var in path.required_variables)
            if required:
                description_parts.append(f"Collect these variables first: {required}.")

        tool_description = " ".join(description_parts).strip()
        if not tool_description:
            tool_description = f"Use this tool to transfer the conversation to {destination_label}."

        transfer_message = None
        if path.metadata and isinstance(path.metadata, dict):
            raw_message = path.metadata.get("transferMessage")
            if isinstance(raw_message, str) and raw_message.strip():
                transfer_message = raw_message.strip()

        @function_tool(name=tool_name, description=tool_description)
        async def transfer_func(self: BaseConfigurableAgent, context: RunContext_T) -> Agent:
            if transfer_message:
                await self.session.say(transfer_message)
            return await self._transfer_to_agent(target_agent_id, context)

        transfer_func.__name__ = f"transfer_to_{target_agent_id}"
        return transfer_func

    @staticmethod
    def _slugify(value: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
        return slug or "transfer"

    def _create_stt(self, config: Optional[dict[str, Any]]) -> Any:
        """Create STT provider from configuration."""
        if not config:
            return assemblyai.STT()

        provider = config.get("provider", "assemblyai")
        use_livekit = config.get("use_livekit", False)

        if provider == "assemblyai":
            # AssemblyAI STT doesn't accept model parameter
            if use_livekit:
                model = config.get("model", "best")
                return f"assemblyai/{model}"
            return assemblyai.STT()

        if provider == "deepgram":
            model = config.get("model", "nova-2")
            if use_livekit:
                return f"deepgram/{model}"
            return deepgram.STT(model=model)

        return assemblyai.STT()

    def _create_llm(self, config: Optional[dict[str, Any]]) -> Any:
        """Create LLM provider from configuration."""
        if not config:
            return openai.LLM(model="gpt-4o-mini")

        provider = config.get("provider", "openai")
        model = config.get("model", "gpt-4o-mini")
        use_livekit = config.get("use_livekit", False)

        if provider == "openai":
            if use_livekit:
                return f"openai/{model}"
            return openai.LLM(model=model)

        return openai.LLM(model="gpt-4o-mini")

    def _create_tts(self, config: Optional[dict[str, Any]]) -> Any:
        """Create TTS provider from configuration."""
        if not config:
            return cartesia.TTS(voice=DEFAULT_CARTESIA_VOICE_ID)

        provider = config.get("provider", "cartesia")
        use_livekit = config.get("use_livekit", False)

        if provider == "cartesia":
            voice_id = config.get("voice_id") or DEFAULT_CARTESIA_VOICE_ID
            if use_livekit:
                return f"cartesia/{voice_id}"
            return cartesia.TTS(voice=voice_id)

        return cartesia.TTS(voice=DEFAULT_CARTESIA_VOICE_ID)

    def _create_vad(self, config: Optional[dict[str, Any]]) -> Any:
        """Create VAD provider from configuration."""
        if not config:
            return silero.VAD.load()

        provider = config.get("provider", "silero")
        if provider == "silero":
            return silero.VAD.load()
        else:
            return silero.VAD.load()

