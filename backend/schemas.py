"""Pydantic schemas for API request/response validation."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ==================== Workflow Schemas ====================


class WorkflowCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class WorkflowUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class WorkflowResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class WorkflowVersionResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    version: int
    status: str
    published_at: Optional[datetime] = None
    config: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class WorkflowVersionConfigUpdateRequest(BaseModel):
    config: dict[str, Any]


class WorkflowWithVersionResponse(BaseModel):
    workflow: WorkflowResponse
    version: WorkflowVersionResponse


class WorkflowSummaryResponse(WorkflowResponse):
    status: str
    latest_published_version_id: Optional[UUID] = None
    latest_draft_version_id: Optional[UUID] = None


# ==================== Agent Node Schemas ====================


class AgentNodeCreateRequest(BaseModel):
    name: str
    instructions: str
    stt_config: Optional[dict[str, Any]] = None
    llm_config: Optional[dict[str, Any]] = None
    tts_config: Optional[dict[str, Any]] = None
    vad_config: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None
    position: Optional[dict[str, Any]] = None


class AgentNodeResponse(BaseModel):
    id: UUID
    workflow_version_id: UUID
    name: str
    instructions: str
    stt_config: Optional[dict[str, Any]] = None
    llm_config: Optional[dict[str, Any]] = None
    tts_config: Optional[dict[str, Any]] = None
    vad_config: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None
    position: Optional[dict[str, Any]] = None
    created_at: datetime


# ==================== Agent Tool Schemas ====================


class AgentToolCreateRequest(BaseModel):
    tool_type: str
    config: dict[str, Any] = Field(default_factory=dict)
    display_name: Optional[str] = None


class AgentToolUpdateRequest(BaseModel):
    config: Optional[dict[str, Any]] = None
    display_name: Optional[str] = None


class AgentToolResponse(BaseModel):
    id: UUID
    agent_id: UUID
    tool_type: str
    config: dict[str, Any]
    display_name: Optional[str] = None
    created_at: datetime


class IntegrationStatusResponse(BaseModel):
    connected: bool
    connection_id: Optional[UUID] = None
    connected_at: Optional[datetime] = None
    scope: Optional[str] = None
    email: Optional[str] = None


# ==================== Agent Path Schemas ====================


class AgentPathCreateRequest(BaseModel):
    to_agent_id: UUID
    name: str
    description: Optional[str] = None
    guard_condition: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class AgentPathResponse(BaseModel):
    id: UUID
    from_agent_id: UUID
    to_agent_id: UUID
    name: str
    description: Optional[str] = None
    guard_condition: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime


# ==================== Path Variable Schemas ====================


class PathVariableCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_required: bool = True
    data_type: str = "string"


class PathVariableResponse(BaseModel):
    id: UUID
    path_id: UUID
    name: str
    description: Optional[str] = None
    is_required: bool
    data_type: str
    created_at: datetime


# ==================== Complete Workflow Config Schema ====================


class WorkflowConfigResponse(BaseModel):
    """Complete workflow configuration including all agents, tools, and paths."""

    workflow: WorkflowResponse
    version: WorkflowVersionResponse
    agents: list[AgentNodeResponse]
    tools: dict[UUID, list[AgentToolResponse]]  # agent_id -> tools
    paths: dict[UUID, list[AgentPathResponse]]  # agent_id -> outgoing paths
    path_variables: dict[UUID, list[PathVariableResponse]]  # path_id -> variables
    start_position: Optional[dict[str, Any]] = None


class WorkflowTestSessionResponse(BaseModel):
    """Details required for starting a LiveKit-backed workflow test session."""

    room_url: str
    room_name: str
    token: str
    participant_identity: str
