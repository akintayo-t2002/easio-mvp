"""Factory for creating dynamic LiveKit agents from configuration."""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from livekit.agents import JobContext
from livekit.agents.llm import function_tool
from livekit.agents.llm.tool_context import ToolError
from livekit.agents.voice import Agent, RunContext
from livekit.plugins import assemblyai, cartesia, deepgram, openai, silero

from .config import AgentConfig, PathConfig, PathVariableConfig, WorkflowRuntimeConfig
from .tool_registry import build_tool_functions

logger = logging.getLogger("agent-factory")

DEFAULT_CARTESIA_VOICE_ID = "5ee9feff-1265-424a-9d7f-8e4d431a12c7"


@dataclass
class UserData:
    """Stores data and agents to be shared across the session."""

    personas: dict[str, Agent] = field(default_factory=dict)
    ctx: Optional[JobContext] = None
    workflow_config: Optional[WorkflowRuntimeConfig] = None
    path_variables: dict[str, dict[str, Any]] = field(default_factory=dict)


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

        chat_ctx = self.session.history.copy()

        chat_ctx.add_message(
            role="system",
            content=f"You are now {self.agent_name}. Continue the conversation naturally.",
        )
        await self.update_chat_ctx(chat_ctx)
        self.session.generate_reply()

    def set_path_variable(self, path_id: str, variable: str, value: Any) -> None:
        """Persist a structured value for the specified path variable."""

        store = self.session.userdata.path_variables.setdefault(path_id, {})
        store[variable] = value

    def get_path_variables(self, path_id: str) -> dict[str, Any]:
        """Return collected variables for a given path."""

        return dict(self.session.userdata.path_variables.get(path_id, {}))

    def _prepare_handoff_summary(self, path: PathConfig) -> Optional[dict[str, Any]]:
        path_id = str(path.id)
        collected = self.get_path_variables(path_id)

        allowed_names = {var.name for var in path.required_variables}
        filtered = (
            {name: value for name, value in collected.items() if name in allowed_names}
            if allowed_names
            else collected
        )

        missing = [var.name for var in path.required_variables if var.name not in filtered]
        if missing:
            raise ToolError(
                "Collect required variables before transferring: " + ", ".join(sorted(missing))
            )

        if not filtered:
            return None

        return {
            "path_id": path_id,
            "path_name": path.name or path_id,
            "variables": filtered,
        }

    async def _transfer_to_agent(
        self,
        target_agent_id: str,
        context: RunContext_T,
        handoff_summary: Optional[dict[str, Any]] = None,
    ) -> Agent:
        """Transfer to another agent while preserving context."""
        userdata = context.userdata
        next_agent = userdata.personas.get(target_agent_id)

        if not next_agent:
            logger.error(f"Target agent {target_agent_id} not found")
            raise ValueError(f"Agent {target_agent_id} not found")

        chat_ctx = self.session.history.copy()
        if handoff_summary and handoff_summary.get("variables"):
            try:
                summary_payload = json.dumps(handoff_summary, ensure_ascii=False, default=str)
            except TypeError:
                summary_payload = str(handoff_summary)
            chat_ctx.add_message(
                role="system",
                content=f"Structured handoff context: {summary_payload}",
            )
        await next_agent.update_chat_ctx(chat_ctx)
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

        # Create variable collection helpers for each path variable
        variable_tools: list[Any] = []
        for path in agent_config.paths:
            for variable in path.required_variables:
                var_tool = self._create_variable_tool(path, variable)
                bound_tool = var_tool.__get__(agent, type(agent))
                setattr(agent, var_tool.__name__, bound_tool)
                variable_tools.append(bound_tool)

        # Dynamically create transfer functions for each path
        transfer_tools: list[Any] = []
        for path in agent_config.paths:
            transfer_func = self._create_transfer_function(path)
            bound_method = transfer_func.__get__(agent, type(agent))
            setattr(agent, f"transfer_to_{path.id}", bound_method)
            transfer_tools.append(bound_method)

        if integration_tools or transfer_tools or variable_tools:
            existing_tools = getattr(agent, "_tools", [])
            merged_tools = existing_tools + integration_tools + variable_tools + transfer_tools
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
            handoff_summary = self._prepare_handoff_summary(path)
            if transfer_message:
                await self.session.say(transfer_message)
            return await self._transfer_to_agent(
                target_agent_id,
                context,
                handoff_summary=handoff_summary,
            )

        transfer_func.__name__ = f"transfer_to_{target_agent_id}"
        return transfer_func

    def _create_variable_tool(self, path: PathConfig, variable: PathVariableConfig) -> Callable:
        """Create a tool that stores a path variable before transfer."""

        path_label = path.name or str(path.id)
        base_name = f"record_{path_label}_{variable.name or 'value'}"
        tool_name = self._slugify(base_name)
        path_id = str(path.id)
        description = variable.description or f"Capture {variable.name} for path {path_label}."
        tool_description = f"{description} (Required)."

        schema = {
            "name": tool_name,
            "description": tool_description,
            "parameters": {
                "type": "object",
                "properties": {
                    "value": {
                        "type": self._json_schema_type(variable.data_type),
                        "description": variable.description or f"Value for {variable.name}.",
                    }
                },
                "required": ["value"],
                "additionalProperties": False,
            },
        }

        @function_tool(raw_schema=schema)
        async def record_variable(self: BaseConfigurableAgent, raw_arguments: dict[str, Any]) -> dict[str, Any]:
            if not isinstance(raw_arguments, dict):
                raise ToolError("Invalid arguments payload for variable collection.")
            if "value" not in raw_arguments:
                raise ToolError("Parameter 'value' is required.")

            coerced = AgentFactory._coerce_variable_value(raw_arguments["value"], variable.data_type)
            self.set_path_variable(path_id, variable.name, coerced)
            return {
                "stored": True,
                "path_id": path_id,
                "variable": variable.name,
            }

        record_variable.__name__ = f"record_{path.id.hex}_{self._slugify(variable.name)}"
        return record_variable

    @staticmethod
    def _slugify(value: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
        return slug or "transfer"

    @staticmethod
    def _json_schema_type(data_type: Optional[str]) -> Any:
        mapping = {
            "string": "string",
            "number": "number",
            "float": "number",
            "integer": "integer",
            "int": "integer",
            "boolean": "boolean",
            "bool": "boolean",
        }
        return mapping.get((data_type or "string").lower(), "string")

    @staticmethod
    def _coerce_variable_value(value: Any, data_type: Optional[str]) -> Any:
        kind = (data_type or "string").lower()

        if kind in {"string", "text", ""}:
            if value is None:
                raise ToolError("Value cannot be null.")
            return str(value)

        if kind in {"number", "float"}:
            try:
                return float(value)
            except (TypeError, ValueError):
                raise ToolError("Value must be a number.")

        if kind in {"integer", "int"}:
            try:
                return int(value)
            except (TypeError, ValueError):
                raise ToolError("Value must be an integer.")

        if kind in {"boolean", "bool"}:
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                lowered = value.strip().lower()
                if lowered in {"true", "1", "yes"}:
                    return True
                if lowered in {"false", "0", "no"}:
                    return False
            if isinstance(value, (int, float)):
                if value in {0, 0.0}:
                    return False
                if value in {1, 1.0}:
                    return True
            raise ToolError("Value must be boolean (true/false).")

        if value is None:
            raise ToolError("Value cannot be null.")
        return str(value)

    def _create_stt(self, config: Optional[dict[str, Any]]) -> Any:
        """Create STT provider from configuration."""

        config = config or {}
        provider = (config.get("provider") or "deepgram").lower()
        use_livekit = bool(config.get("use_livekit", False))

        if provider == "deepgram":
            model = config.get("model") or "nova-3"
            if use_livekit:
                return f"deepgram/{model}"
            return deepgram.STT(model=model)

        if provider == "assemblyai":
            if use_livekit:
                model = config.get("model", "best")
                return f"assemblyai/{model}"
            return assemblyai.STT()

        logger.warning("Unknown STT provider '%s'; defaulting to Deepgram nova-3", provider)
        return deepgram.STT(model="nova-3")

    def _create_llm(self, config: Optional[dict[str, Any]]) -> Any:
        """Create LLM provider from configuration."""

        if not config:
            logger.info("LLM config missing; defaulting to OpenAI gpt-4o-mini")
            return openai.LLM(model="gpt-4o-mini")

        provider = (config.get("provider") or "openai").lower()
        model = config.get("model") or "gpt-4o-mini"
        use_livekit = bool(config.get("use_livekit", False))

        if provider == "openai":
            if use_livekit:
                return f"openai/{model}"
            return openai.LLM(model=model)

        logger.warning("Unsupported LLM provider '%s'; defaulting to OpenAI", provider)
        return openai.LLM(model=model)

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

