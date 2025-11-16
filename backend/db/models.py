"""Pydantic models mirroring Supabase schema for type safety."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Organization(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime


class Workflow(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class WorkflowVersion(BaseModel):
    id: UUID
    workflow_id: UUID
    version: int
    status: str = Field(..., pattern="^(draft|published|archived)$")
    published_at: Optional[datetime] = None
    config: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class AgentNode(BaseModel):
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


class AgentTool(BaseModel):
    id: UUID
    agent_id: UUID
    tool_type: str
    config: dict[str, Any]
    display_name: Optional[str] = None
    created_at: datetime


class AgentPath(BaseModel):
    id: UUID
    from_agent_id: UUID
    to_agent_id: UUID
    name: str
    description: Optional[str] = None
    guard_condition: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime


class PathVariable(BaseModel):
    id: UUID
    path_id: UUID
    name: str
    description: Optional[str] = None
    is_required: bool = True
    data_type: str = "string"
    created_at: datetime


class CallSession(BaseModel):
    id: UUID
    workflow_version_id: Optional[UUID] = None
    external_session_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str = Field(..., pattern="^(active|completed|dropped)$")
    channel: str = "voice"


class SessionEvent(BaseModel):
    id: int
    session_id: UUID
    event_type: str
    payload: dict[str, Any]
    occurred_at: datetime


class TestSession(BaseModel):
    id: UUID
    workflow_version_id: Optional[UUID] = None
    transcript: Optional[dict[str, Any]] = None
    created_at: datetime



class IntegrationConnection(BaseModel):
    id: UUID
    organization_id: UUID
    provider: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    scope: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    refresh_token_secret_id: Optional[UUID] = None
    refresh_token_secret_created_at: Optional[datetime] = None
    access_token_secret_id: Optional[UUID] = None
    access_token_secret_created_at: Optional[datetime] = None
    profile_email: Optional[str] = None


class OAuthStateToken(BaseModel):
    nonce: str
    provider: str
    organization_id: UUID
    redirect_url: Optional[str] = None
    origin: Optional[str] = None
    pkce_verifier: str
    expires_at: datetime
    created_at: datetime









