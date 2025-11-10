"""Supabase-backed repository for workflow management."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from supabase import Client

from ..db.models import AgentNode, AgentPath, AgentTool, PathVariable, Workflow, WorkflowVersion
from ..schemas import (
    AgentNodeCreateRequest,
    AgentNodeResponse,
    AgentPathCreateRequest,
    AgentPathResponse,
    AgentToolCreateRequest,
    AgentToolUpdateRequest,
    AgentToolResponse,
    PathVariableCreateRequest,
    PathVariableResponse,
    WorkflowCreateRequest,
    WorkflowResponse,
    WorkflowSummaryResponse,
    WorkflowUpdateRequest,
    WorkflowVersionResponse,
    WorkflowWithVersionResponse,
)


class SupabaseWorkflowRepository:
    """Repository for workflow CRUD operations using Supabase."""

    def __init__(self, client: Client):
        self.client = client

    # ==================== Workflow Operations ====================

    async def create_workflow(
        self, org_id: UUID, payload: WorkflowCreateRequest
    ) -> WorkflowWithVersionResponse:
        """Create a new workflow and its initial draft version."""
        workflow_data = {
            "id": str(uuid4()),
            "organization_id": str(org_id),
            "name": payload.name,
            "description": payload.description,
        }

        result = self.client.table("workflow").insert(workflow_data).execute()
        workflow = result.data[0]

        # Create initial draft version
        version_data = {
            "id": str(uuid4()),
            "workflow_id": workflow["id"],
            "version": 1,
            "status": "draft",
            "config": {},
        }
        version_result = self.client.table("workflow_version").insert(version_data).execute()
        version = version_result.data[0]

        return WorkflowWithVersionResponse(
            workflow=WorkflowResponse(**workflow),
            version=WorkflowVersionResponse(**version),
        )

    async def list_workflows(self, org_id: UUID) -> list[WorkflowSummaryResponse]:
        """List all workflows for an organization with status metadata."""
        result = (
            self.client.table("workflow")
            .select("*")
            .eq("organization_id", str(org_id))
            .order("created_at", desc=True)
            .execute()
        )
        workflows = result.data or []
        if not workflows:
            return []

        workflow_ids = [w["id"] for w in workflows]

        versions_result = (
            self.client.table("workflow_version")
            .select("id, workflow_id, status, version, created_at, published_at")
            .in_("workflow_id", workflow_ids)
            .order("version", desc=True)
            .execute()
        )
        versions = versions_result.data or []

        latest_published: dict[str, dict] = {}
        latest_draft: dict[str, dict] = {}

        for version in versions:
            workflow_id = version["workflow_id"]
            status = version["status"]
            if status == "published" and workflow_id not in latest_published:
                latest_published[workflow_id] = version
            if status == "draft" and workflow_id not in latest_draft:
                latest_draft[workflow_id] = version

        summaries: list[WorkflowSummaryResponse] = []
        for workflow in workflows:
            workflow_id = workflow["id"]
            published_version = latest_published.get(workflow_id)
            draft_version = latest_draft.get(workflow_id)
            status = "published" if published_version else "draft"

            summary_payload = {
                **workflow,
                "status": status,
                "latest_published_version_id": published_version["id"]
                if published_version
                else None,
                "latest_draft_version_id": draft_version["id"] if draft_version else None,
            }
            summaries.append(WorkflowSummaryResponse(**summary_payload))

        return summaries

    async def get_workflow(self, workflow_id: UUID) -> Optional[WorkflowResponse]:
        """Get a specific workflow by ID."""
        result = (
            self.client.table("workflow").select("*").eq("id", str(workflow_id)).execute()
        )
        if not result.data:
            return None
        return WorkflowResponse(**result.data[0])

    async def update_workflow(
        self, workflow_id: UUID, payload: WorkflowUpdateRequest
    ) -> Optional[WorkflowResponse]:
        """Update workflow name and/or description."""
        update_data = {}
        if payload.name is not None:
            update_data["name"] = payload.name
        if payload.description is not None:
            update_data["description"] = payload.description

        if not update_data:
            # If nothing to update, just return the existing workflow
            return await self.get_workflow(workflow_id)

        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = (
            self.client.table("workflow")
            .update(update_data)
            .eq("id", str(workflow_id))
            .execute()
        )
        if not result.data:
            return None
        return WorkflowResponse(**result.data[0])

    # ==================== Workflow Version Operations ====================

    async def create_version(
        self, workflow_id: UUID, copy_from: Optional[UUID] = None
    ) -> WorkflowVersionResponse:
        """Create a new draft version, optionally copying from an existing version."""
        # Get current max version
        result = (
            self.client.table("workflow_version")
            .select("version")
            .eq("workflow_id", str(workflow_id))
            .order("version", desc=True)
            .limit(1)
            .execute()
        )

        next_version = (result.data[0]["version"] + 1) if result.data else 1

        # Get config from source version if copying
        config = {}
        if copy_from:
            source = (
                self.client.table("workflow_version")
                .select("config")
                .eq("id", str(copy_from))
                .execute()
            )
            if source.data:
                config = source.data[0]["config"]

        version_data = {
            "id": str(uuid4()),
            "workflow_id": str(workflow_id),
            "version": next_version,
            "status": "draft",
            "config": config,
        }

        result = self.client.table("workflow_version").insert(version_data).execute()
        return WorkflowVersionResponse(**result.data[0])

    async def get_version(self, version_id: UUID) -> Optional[WorkflowVersionResponse]:
        """Get a specific workflow version."""
        result = (
            self.client.table("workflow_version")
            .select("*")
            .eq("id", str(version_id))
            .execute()
        )
        if not result.data:
            return None
        return WorkflowVersionResponse(**result.data[0])

    async def get_latest_draft(
        self, workflow_id: UUID
    ) -> Optional[WorkflowVersionResponse]:
        """Get the latest draft version of a workflow."""
        result = (
            self.client.table("workflow_version")
            .select("*")
            .eq("workflow_id", str(workflow_id))
            .eq("status", "draft")
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        return WorkflowVersionResponse(**result.data[0])

    async def get_published_version(
        self, workflow_id: UUID
    ) -> Optional[WorkflowVersionResponse]:
        """Get the currently published version of a workflow."""
        result = (
            self.client.table("workflow_version")
            .select("*")
            .eq("workflow_id", str(workflow_id))
            .eq("status", "published")
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        return WorkflowVersionResponse(**result.data[0])

    async def publish_version(self, version_id: UUID) -> WorkflowVersionResponse:
        """Publish a draft version (unpublish others for same workflow)."""
        # Get the version
        version_result = (
            self.client.table("workflow_version")
            .select("*")
            .eq("id", str(version_id))
            .execute()
        )
        if not version_result.data:
            raise ValueError(f"Version {version_id} not found")

        version = version_result.data[0]
        workflow_id = version["workflow_id"]

        # Unpublish other versions
        self.client.table("workflow_version").update({"status": "archived"}).eq(
            "workflow_id", workflow_id
        ).eq("status", "published").execute()

        # Publish this version
        result = (
            self.client.table("workflow_version")
            .update({"status": "published", "published_at": datetime.utcnow().isoformat()})
            .eq("id", str(version_id))
            .execute()
        )

        return WorkflowVersionResponse(**result.data[0])

    async def update_version_config(
        self, version_id: UUID, config_updates: dict[str, Any]
    ) -> Optional[WorkflowVersionResponse]:
        """Merge updates into a workflow version's config."""
        current_result = (
            self.client.table("workflow_version")
            .select("config")
            .eq("id", str(version_id))
            .execute()
        )
        if not current_result.data:
            return None

        current_config = current_result.data[0].get("config") or {}
        merged_config = {**current_config, **config_updates}

        update_result = (
            self.client.table("workflow_version")
            .update({"config": merged_config})
            .eq("id", str(version_id))
            .execute()
        )
        if not update_result.data:
            return None
        return WorkflowVersionResponse(**update_result.data[0])

    # ==================== Agent Node Operations ====================

    async def create_agent(
        self, version_id: UUID, payload: AgentNodeCreateRequest
    ) -> AgentNodeResponse:
        """Create a new agent node in a workflow version."""
        agent_data = {
            "id": str(uuid4()),
            "workflow_version_id": str(version_id),
            "name": payload.name,
            "instructions": payload.instructions,
            "stt_config": payload.stt_config,
            "llm_config": payload.llm_config,
            "tts_config": payload.tts_config,
            "vad_config": payload.vad_config,
            "metadata": payload.metadata,
            "position": payload.position,
        }

        result = self.client.table("agent_node").insert(agent_data).execute()
        return AgentNodeResponse(**result.data[0])

    async def list_agents(self, version_id: UUID) -> list[AgentNodeResponse]:
        """List all agents in a workflow version."""
        result = (
            self.client.table("agent_node")
            .select("*")
            .eq("workflow_version_id", str(version_id))
            .execute()
        )
        return [AgentNodeResponse(**a) for a in result.data]

    async def get_agent(self, agent_id: UUID) -> Optional[AgentNodeResponse]:
        """Get a specific agent by ID."""
        result = (
            self.client.table("agent_node").select("*").eq("id", str(agent_id)).execute()
        )
        if not result.data:
            return None
        return AgentNodeResponse(**result.data[0])

    async def update_agent(
        self, agent_id: UUID, payload: AgentNodeCreateRequest
    ) -> AgentNodeResponse:
        """Update an existing agent node."""
        update_data = {
            "name": payload.name,
            "instructions": payload.instructions,
            "stt_config": payload.stt_config,
            "llm_config": payload.llm_config,
            "tts_config": payload.tts_config,
            "vad_config": payload.vad_config,
            "metadata": payload.metadata,
            "position": payload.position,
        }

        result = (
            self.client.table("agent_node")
            .update(update_data)
            .eq("id", str(agent_id))
            .execute()
        )
        return AgentNodeResponse(**result.data[0])

    async def delete_agent(self, agent_id: UUID) -> bool:
        """Delete an agent node and all associated data."""
        # Remove tools owned by the agent
        self.client.table("agent_tool").delete().eq("agent_id", str(agent_id)).execute()

        # Collect all paths (outgoing and incoming) to clean up related variables
        path_ids: set[str] = set()

        outgoing_result = (
            self.client.table("agent_path")
            .select("id")
            .eq("from_agent_id", str(agent_id))
            .execute()
        )
        for path in outgoing_result.data or []:
            path_ids.add(path["id"])

        incoming_result = (
            self.client.table("agent_path")
            .select("id")
            .eq("to_agent_id", str(agent_id))
            .execute()
        )
        for path in incoming_result.data or []:
            path_ids.add(path["id"])

        if path_ids:
            ids_list = list(path_ids)
            self.client.table("path_variable").delete().in_("path_id", ids_list).execute()
            self.client.table("agent_path").delete().in_("id", ids_list).execute()

        # Finally, delete the agent node itself
        result = (
            self.client.table("agent_node").delete().eq("id", str(agent_id)).execute()
        )
        return bool(result.data)

    # ==================== Agent Tool Operations ====================

    async def create_tool(
        self, agent_id: UUID, payload: AgentToolCreateRequest
    ) -> AgentToolResponse:
        """Add a tool to an agent."""
        tool_data = {
            "id": str(uuid4()),
            "agent_id": str(agent_id),
            "tool_type": payload.tool_type,
            "config": payload.config,
            "display_name": payload.display_name,
        }

        result = self.client.table("agent_tool").insert(tool_data).execute()
        return AgentToolResponse(**result.data[0])

    async def list_tools(self, agent_id: UUID) -> list[AgentToolResponse]:
        """List all tools for an agent."""
        result = (
            self.client.table("agent_tool")
            .select("*")
            .eq("agent_id", str(agent_id))
            .execute()
        )
        return [AgentToolResponse(**t) for t in result.data]

    async def update_tool(
        self, tool_id: UUID, payload: AgentToolUpdateRequest
    ) -> AgentToolResponse:
        """Update an existing tool."""
        update_data: dict[str, Any] = {}
        if payload.config is not None:
            update_data["config"] = payload.config
        if payload.display_name is not None:
            update_data["display_name"] = payload.display_name

        if not update_data:
            result = (
                self.client.table("agent_tool")
                .select("*")
                .eq("id", str(tool_id))
                .limit(1)
                .execute()
            )
            if not result.data:
                raise ValueError(f"Tool {tool_id} not found")
            return AgentToolResponse(**result.data[0])

        result = (
            self.client.table("agent_tool")
            .update(update_data)
            .eq("id", str(tool_id))
            .execute()
        )
        if not result.data:
            raise ValueError(f"Tool {tool_id} not found")
        return AgentToolResponse(**result.data[0])

    async def delete_tool(self, tool_id: UUID) -> bool:
        """Delete a tool."""
        result = self.client.table("agent_tool").delete().eq("id", str(tool_id)).execute()
        return len(result.data) > 0

    # ==================== Agent Path Operations ====================

    async def create_path(
        self, from_agent_id: UUID, payload: AgentPathCreateRequest
    ) -> AgentPathResponse:
        """Create a path between two agents."""
        path_data = {
            "id": str(uuid4()),
            "from_agent_id": str(from_agent_id),
            "to_agent_id": str(payload.to_agent_id),
            "name": payload.name,
            "description": payload.description,
            "guard_condition": payload.guard_condition,
            "metadata": payload.metadata,
        }

        result = self.client.table("agent_path").insert(path_data).execute()
        return AgentPathResponse(**result.data[0])

    async def list_paths(self, agent_id: UUID) -> list[AgentPathResponse]:
        """List all outgoing paths from an agent."""
        result = (
            self.client.table("agent_path")
            .select("*")
            .eq("from_agent_id", str(agent_id))
            .execute()
        )
        return [AgentPathResponse(**p) for p in result.data]

    async def delete_path(self, path_id: UUID) -> bool:
        """Delete a path."""
        result = self.client.table("agent_path").delete().eq("id", str(path_id)).execute()
        return len(result.data) > 0

    # ==================== Path Variable Operations ====================

    async def create_path_variable(
        self, path_id: UUID, payload: PathVariableCreateRequest
    ) -> PathVariableResponse:
        """Add a required variable to a path."""
        variable_data = {
            "id": str(uuid4()),
            "path_id": str(path_id),
            "name": payload.name,
            "description": payload.description,
            "is_required": payload.is_required,
            "data_type": payload.data_type,
        }

        result = self.client.table("path_variable").insert(variable_data).execute()
        return PathVariableResponse(**result.data[0])

    async def list_path_variables(self, path_id: UUID) -> list[PathVariableResponse]:
        """List all variables for a path."""
        result = (
            self.client.table("path_variable")
            .select("*")
            .eq("path_id", str(path_id))
            .execute()
        )
        return [PathVariableResponse(**v) for v in result.data]








