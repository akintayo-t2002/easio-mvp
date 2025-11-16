export type SessionChannel = "voice" | "test"

export type SessionStatus = "active" | "completed" | "dropped" | "failed"

export interface CallSessionSummary {
  id: string
  workflowVersionId?: string | null
  workflowName?: string | null
  phoneNumber?: string | null
  startedAt: string
  endedAt?: string | null
  status: SessionStatus
  channel: SessionChannel
  entryAgentId?: string | null
  durationSeconds?: number | null
  summary?: string | null
}

export type ChatRole = "user" | "agent" | "system" | "tool"

export interface CallLogMessage {
  id: string
  timestamp: string
  role: ChatRole
  text: string
  agentId?: string | null
  pathId?: string | null
  toolName?: string | null
  variables?: Record<string, string>
  metadata?: Record<string, unknown>
}

export type TimelineEventType = "path_transition" | "tool_call" | "variable_collected" | "system"

export interface CallLogTimelineEventPayload {
  pathName?: string
  fromAgentId?: string
  toAgentId?: string
  toolName?: string
  toolResultSummary?: string
  variables?: Record<string, string>
  messageId?: string
  [key: string]: unknown
}

export interface CallLogTimelineEvent {
  id: string
  timestamp: string
  type: TimelineEventType
  payload: CallLogTimelineEventPayload
}

export interface CallSessionDetail {
  session: CallSessionSummary
  messages: CallLogMessage[]
  events: CallLogTimelineEvent[]
}


