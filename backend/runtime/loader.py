"""Workflow loader that fetches and transforms configuration from Supabase."""

from typing import Optional
from uuid import UUID

from ..repositories.supabase_repo import SupabaseWorkflowRepository
from .config import (
    AgentConfig,
    PathConfig,
    PathVariableConfig,
    RuntimeToolParameterConfig,
    ToolConfig,
    WorkflowRuntimeConfig,
)


class WorkflowLoader:
    """Loads workflow configuration from Supabase and transforms to runtime format."""

    def __init__(self, repository: SupabaseWorkflowRepository):
        self.repository = repository

    async def load_workflow(
        self, workflow_id: UUID, use_draft: bool = False
    ) -> Optional[WorkflowRuntimeConfig]:
        """Load the published or latest draft workflow configuration."""

        workflow = await self.repository.get_workflow(workflow_id)
        if not workflow:
            return None

        version = (
            await self.repository.get_latest_draft(workflow_id)
            if use_draft
            else await self.repository.get_published_version(workflow_id)
        )
        if not version:
            return None

        return await self._build_runtime_config(workflow, version)

    async def load_workflow_version(self, version_id: UUID) -> Optional[WorkflowRuntimeConfig]:
        """Load a specific workflow version by its identifier."""

        version = await self.repository.get_version(version_id)
        if not version:
            return None

        workflow = await self.repository.get_workflow(version.workflow_id)
        if not workflow:
            return None

        return await self._build_runtime_config(workflow, version)

    async def _build_runtime_config(
        self, workflow, version
    ) -> Optional[WorkflowRuntimeConfig]:
        agent_rows = await self.repository.list_agents(version.id)
        if not agent_rows:
            return None

        agents = {}
        for agent_row in agent_rows:
            tool_rows = await self.repository.list_tools(agent_row.id)
            tools = []
            for tool_row in tool_rows:
                raw_config = tool_row.config or {}
                config_dict = raw_config if isinstance(raw_config, dict) else {}
                llm_description = config_dict.get("llmDescription")
                runtime_params_raw = config_dict.get("runtimeParameters")

                runtime_parameters: list[RuntimeToolParameterConfig] = []
                if isinstance(runtime_params_raw, list):
                    for item in runtime_params_raw:
                        if not isinstance(item, dict):
                            continue
                        name = item.get("name")
                        if not isinstance(name, str) or not name.strip():
                            continue
                        description = item.get("llmDescription")
                        required = bool(item.get("required", False))
                        data_type = item.get("dataType")
                        runtime_parameters.append(
                            RuntimeToolParameterConfig(
                                name=name.strip(),
                                description=description if isinstance(description, str) else "",
                                required=required,
                                data_type=data_type if isinstance(data_type, str) else "string",
                            )
                        )

                cleaned_config = {
                    key: value
                    for key, value in config_dict.items()
                    if key not in {"llmDescription", "runtimeParameters"}
                }

                tools.append(
                    ToolConfig(
                        id=tool_row.id,
                        tool_type=tool_row.tool_type,
                        config=cleaned_config,
                        display_name=tool_row.display_name,
                        llm_description=llm_description if isinstance(llm_description, str) else "",
                        runtime_parameters=runtime_parameters,
                    )
                )

            path_rows = await self.repository.list_paths(agent_row.id)
            paths = []
            for path_row in path_rows:
                var_rows = await self.repository.list_path_variables(path_row.id)
                variables = [
                    PathVariableConfig(
                        name=v.name,
                        description=v.description,
                        data_type=v.data_type,
                    )
                    for v in var_rows
                ]

                paths.append(
                    PathConfig(
                        id=path_row.id,
                        target_agent_id=path_row.to_agent_id,
                        name=path_row.name,
                        description=path_row.description,
                        guard_condition=path_row.guard_condition,
                        required_variables=variables,
                        metadata=path_row.metadata,
                    )
                )

            agents[str(agent_row.id)] = AgentConfig(
                id=agent_row.id,
                name=agent_row.name,
                instructions=agent_row.instructions,
                stt_config=agent_row.stt_config,
                llm_config=agent_row.llm_config,
                tts_config=agent_row.tts_config,
                vad_config=agent_row.vad_config,
                tools=tools,
                paths=paths,
                metadata=agent_row.metadata,
                position=agent_row.position,
            )

        version_config = version.config or {}

        entry_agent_id = None
        for agent_config in agents.values():
            if agent_config.metadata and agent_config.metadata.get("is_entry"):
                entry_agent_id = str(agent_config.id)
                break

        if not entry_agent_id and agents:
            entry_agent_id = next(iter(agents.keys()))

        if not entry_agent_id:
            return None

        return WorkflowRuntimeConfig(
            workflow_id=workflow.id,
            organization_id=workflow.organization_id,
            workflow_name=workflow.name,
            version_id=version.id,
            version_number=version.version,
            agents=agents,
            entry_agent_id=entry_agent_id,
            start_position=version_config.get("start_position"),
        )










