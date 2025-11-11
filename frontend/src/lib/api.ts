import type {
  AgentNodeResponse,
  AgentPathResponse,
  AgentToolResponse,
  PathVariableResponse,
  RuntimeParameter,
  ToolOperation,
  ToolConfiguration,
  WorkflowConfigResponse,
  WorkflowSummaryResponse,
  WorkflowVersionResponse,
  WorkflowWithVersionResponse,
  WorkflowTestSessionResponse,
} from '../types/workflow';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const ORGANIZATION_ID =
  import.meta.env.VITE_ORGANIZATION_ID ?? '00000000-0000-0000-0000-000000000000';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const targetPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${base}${targetPath}`, {
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'X-Organization-ID': ORGANIZATION_ID,
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { ApiError };

export interface WorkflowCreatePayload {
  name: string;
  description?: string | null;
}

export interface AgentPayload {
  name: string;
  instructions: string;
  stt_config?: Record<string, unknown> | null;
  llm_config?: Record<string, unknown> | null;
  tts_config?: Record<string, unknown> | null;
  vad_config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  position?: Record<string, unknown> | null;
}

export interface PathPayload {
  to_agent_id: string;
  name: string;
  description?: string | null;
  guard_condition?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PathVariablePayload {
  name: string;
  description?: string | null;
  is_required: boolean;
  data_type: string;
}

export interface ToolPayload {
  tool_type: string;
  config: Record<string, unknown>;
  display_name?: string;
}

export interface ConnectionStatusResponse {
  connected: boolean;
  connectionId?: string;
  connectedAt?: string;
  scope?: string | null;
  email?: string | null;
}

// Helper to convert ToolOperation to ToolPayload for backend
export function toolOperationToPayload(toolOp: ToolOperation): ToolPayload {
  return {
    tool_type: `${toolOp.integrationId}.${toolOp.operationId}`,
    display_name: toolOp.operationName,
    config: {
      ...toolOp.config,
      llmDescription: toolOp.llmDescription,
      runtimeParameters: toolOp.runtimeParameters,
    },
  };
}

export function parseToolResponse(apiTool: AgentToolResponse): ToolOperation {
  const configRaw = (apiTool.config || {}) as Record<string, unknown>;
  const llmDescriptionValue =
    typeof configRaw.llmDescription === 'string' ? configRaw.llmDescription : '';

  const runtimeParametersRaw = Array.isArray(configRaw.runtimeParameters)
    ? (configRaw.runtimeParameters as unknown[])
    : [];

  const runtimeParameters: RuntimeParameter[] = runtimeParametersRaw
    .map((param) => {
      if (typeof param !== 'object' || param === null) {
        return null;
      }
      const obj = param as Record<string, unknown>;
      const name = typeof obj.name === 'string' ? obj.name : '';
      if (!name) {
        return null;
      }
      return {
        name,
        llmDescription: typeof obj.llmDescription === 'string' ? obj.llmDescription : '',
        required: Boolean(obj.required),
        dataType: typeof obj.dataType === 'string' ? obj.dataType : 'string',
      };
    })
    .filter((param): param is RuntimeParameter => Boolean(param));

  const configEntries: ToolConfiguration = { ...configRaw };
  delete configEntries.llmDescription;
  delete configEntries.runtimeParameters;

  const [rawIntegration, rawOperation] = apiTool.tool_type.split('.', 2);
  const integrationId = rawOperation ? rawIntegration : rawIntegration || 'custom';
  const operationId = rawOperation || rawIntegration || apiTool.tool_type;

  return {
    id: apiTool.id,
    integrationId,
    operationId,
    operationName: apiTool.display_name || operationId,
    llmDescription: llmDescriptionValue,
    config: configEntries,
    runtimeParameters,
  };
}

export async function fetchWorkflows() {
  return request<WorkflowSummaryResponse[]>('/workflows');
}

export async function createWorkflow(payload: WorkflowCreatePayload) {
  return request<WorkflowWithVersionResponse>('/workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateWorkflow(workflowId: string, payload: Partial<WorkflowCreatePayload>) {
  return request<WorkflowWithVersionResponse['workflow']>(`/workflows/${workflowId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getWorkflowConfig(versionId: string) {
  return request<WorkflowConfigResponse>(`/workflow-versions/${versionId}/config`);
}

export async function createAgent(versionId: string, payload: AgentPayload) {
  return request<AgentNodeResponse>(`/workflow-versions/${versionId}/agents`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAgent(agentId: string, payload: AgentPayload) {
  return request<AgentNodeResponse>(`/agents/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAgent(agentId: string) {
  await request<void>(`/agents/${agentId}`, {
    method: 'DELETE',
  });
}

export async function createTool(agentId: string, payload: ToolPayload) {
  return request<AgentToolResponse>(`/agents/${agentId}/tools`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTool(toolId: string, payload: ToolPayload) {
  return request<AgentToolResponse>(`/tools/${toolId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTool(toolId: string) {
  await request<void>(`/tools/${toolId}`, {
    method: 'DELETE',
  });
}

export async function fetchIntegrationStatus(integrationId: string) {
  return request<ConnectionStatusResponse>(`/integrations/${integrationId}/status`);
}

export async function disconnectIntegration(integrationId: string) {
  await request<void>(`/integrations/${integrationId}`, {
    method: 'DELETE',
  });
}

export async function createPath(agentId: string, payload: PathPayload) {
  return request<AgentPathResponse>(`/agents/${agentId}/paths`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deletePath(pathId: string) {
  await request<void>(`/paths/${pathId}`, {
    method: 'DELETE',
  });
}

export async function createPathVariable(pathId: string, payload: PathVariablePayload) {
  return request<PathVariableResponse>(`/paths/${pathId}/variables`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function publishVersion(versionId: string) {
  return request<WorkflowVersionResponse>(`/workflow-versions/${versionId}/publish`, {
    method: 'POST',
  });
}

export async function createTestSession(versionId: string) {
  return request<WorkflowTestSessionResponse>(`/workflow-versions/${versionId}/test-session`, {
    method: 'POST',
  });
}

export async function updateWorkflowVersionConfig(
  versionId: string,
  config: Record<string, unknown>
) {
  return request<WorkflowVersionResponse>(`/workflow-versions/${versionId}/config`, {
    method: 'PATCH',
    body: JSON.stringify({ config }),
  });
}
