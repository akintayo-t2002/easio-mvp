export type WorkflowStatus = "draft" | "published"

export interface WorkflowResponse {
  id: string
  organization_id: string
  name: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowSummaryResponse extends WorkflowResponse {
  status: WorkflowStatus
  latest_published_version_id?: string | null
  latest_draft_version_id?: string | null
}

export interface WorkflowSummary {
  id: string
  name: string
  description?: string | null
  status: WorkflowStatus
  updatedAt: string
  latestPublishedVersionId?: string | null
  latestDraftVersionId?: string | null
  organizationId: string
}

export interface WorkflowVersionResponse {
  id: string
  workflow_id: string
  version: number
  status: WorkflowStatus
  published_at?: string | null
  config: Record<string, unknown>
  created_at: string
}

export interface AgentNodeResponse {
  id: string
  workflow_version_id: string
  name: string
  instructions: string
  stt_config?: Record<string, unknown> | null
  llm_config?: Record<string, unknown> | null
  tts_config?: Record<string, unknown> | null
  vad_config?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  position?: Record<string, unknown> | null
  created_at: string
}

export interface AgentNodeCreatePayload {
  name: string
  instructions: string
  stt_config?: Record<string, unknown> | null
  llm_config?: Record<string, unknown> | null
  tts_config?: Record<string, unknown> | null
  vad_config?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  position?: Record<string, unknown> | null
}

export interface AgentToolResponse {
  id: string
  agent_id: string
  tool_type: string
  config: Record<string, unknown>
  display_name?: string | null
  created_at: string
}

export interface AgentPathResponse {
  id: string
  from_agent_id: string
  to_agent_id: string
  name: string
  description?: string | null
  guard_condition?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

export interface PathVariableResponse {
  id: string
  path_id: string
  name: string
  description?: string | null
  is_required: boolean
  data_type: string
  created_at: string
}

export interface WorkflowConfigResponse {
  workflow: WorkflowResponse
  version: WorkflowVersionResponse
  agents: AgentNodeResponse[]
  tools: Record<string, AgentToolResponse[]>
  paths: Record<string, AgentPathResponse[]>
  path_variables: Record<string, PathVariableResponse[]>
  start_position?: { x: number; y: number } | null
}

export interface WorkflowWithVersionResponse {
  workflow: WorkflowResponse
  version: WorkflowVersionResponse
}

export interface WorkflowTestSessionResponse {
  room_url: string
  room_name: string
  token: string
  participant_identity: string
}

export interface PathVariable {
  id: string
  name: string
  description?: string | null
  required: boolean
  dataType: string
}

export interface Path {
  id: string
  fromAgentId: string
  targetAgentId: string
  name: string
  description?: string | null
  guardCondition?: string | null
  transferMessage?: string
  variables: PathVariable[]
  hideEdge?: boolean
}

export interface RuntimeParameter {
  name: string
  llmDescription: string
  required: boolean
  dataType: string
}

export type ToolConfiguration = Record<string, unknown>

export interface ToolOperation {
  id: string
  integrationId: string
  operationId: string
  operationName: string
  llmDescription: string
  config: ToolConfiguration
  runtimeParameters: RuntimeParameter[]
}

export interface Agent {
  id: string
  name: string
  instructions: string
  toolCount: number
  pathCount: number
  paths?: Path[]
  model?: string
  tools?: ToolOperation[]
  toolIds?: string[]
  metadata?: Record<string, unknown> | null
  position?: { x: number; y: number } | null
  isNew?: boolean
}

export interface WorkflowNode {
  id: string
  type: "start" | "agent"
  data: Record<string, unknown>
  position: { x: number; y: number }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
}








