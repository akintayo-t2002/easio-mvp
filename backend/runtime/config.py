"""Runtime configuration models for dynamic agent instantiation."""

from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import UUID


@dataclass
class ToolConfig:
    """Configuration for a tool attached to an agent."""

    id: UUID
    tool_type: str
    config: dict[str, Any]
    display_name: Optional[str] = None
    llm_description: str = ""
    runtime_parameters: list["RuntimeToolParameterConfig"] = field(default_factory=list)


@dataclass
class RuntimeToolParameterConfig:
    """Runtime parameter definition for a tool."""

    name: str
    description: str
    required: bool
    data_type: str


@dataclass
class PathVariableConfig:
    """Configuration for a variable that must be collected before transfer."""

    name: str
    description: Optional[str]
    data_type: str


@dataclass
class PathConfig:
    """Configuration for a transfer path between agents."""

    id: UUID
    target_agent_id: UUID
    name: str
    description: Optional[str]
    guard_condition: Optional[str]
    required_variables: list[PathVariableConfig] = field(default_factory=list)
    metadata: Optional[dict[str, Any]] = None


@dataclass
class AgentConfig:
    """Configuration for a single agent in the workflow."""

    id: UUID
    name: str
    instructions: str
    stt_config: Optional[dict[str, Any]] = None
    llm_config: Optional[dict[str, Any]] = None
    tts_config: Optional[dict[str, Any]] = None
    vad_config: Optional[dict[str, Any]] = None
    tools: list[ToolConfig] = field(default_factory=list)
    paths: list[PathConfig] = field(default_factory=list)
    metadata: Optional[dict[str, Any]] = None
    position: Optional[dict[str, Any]] = None


@dataclass
class WorkflowRuntimeConfig:
    """Complete runtime configuration for a workflow."""

    workflow_id: UUID
    organization_id: UUID
    workflow_name: str
    version_id: UUID
    version_number: int
    agents: dict[str, AgentConfig]  # agent_id -> config
    entry_agent_id: str  # ID of the first agent to start with
    start_position: Optional[dict[str, Any]] = None

    def get_agent(self, agent_id: str) -> Optional[AgentConfig]:
        """Get agent config by ID."""
        return self.agents.get(agent_id)










