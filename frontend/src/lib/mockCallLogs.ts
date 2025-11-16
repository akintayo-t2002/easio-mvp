import type {
  CallLogMessage,
  CallLogTimelineEvent,
  CallSessionDetail,
  CallSessionSummary,
  SessionChannel,
  SessionStatus,
} from "../types/logs"

const now = new Date()

function minutesAgo(mins: number): string {
  const d = new Date(now.getTime() - mins * 60 * 1000)
  return d.toISOString()
}

function duration(startIso: string, endIso?: string | null): number | null {
  if (!endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.max(0, Math.round((end - start) / 1000))
}

function makeSummary(
  id: string,
  channel: SessionChannel,
  status: SessionStatus,
  startedMinutesAgo: number,
  durationMinutes: number,
  summary: string,
  phoneNumber: string,
  workflowName: string,
  entryAgentId?: string,
): CallSessionSummary {
  const startedAt = minutesAgo(startedMinutesAgo)
  const endedAt = durationMinutes > 0 ? minutesAgo(startedMinutesAgo - durationMinutes) : null

  return {
    id,
    workflowVersionId: null,
    workflowName,
    phoneNumber,
    startedAt,
    endedAt,
    status,
    channel,
    entryAgentId: entryAgentId ?? null,
    durationSeconds: duration(startedAt, endedAt),
    summary,
  }
}

export const mockSessions: CallSessionSummary[] = [
  makeSummary(
    "session-1",
    "voice",
    "completed",
    15,
    4,
    "Billing question about an invoice; collected customer id and open balance.",
    "(505) 555-0125",
    "Customer Support",
    "agent-billing",
  ),
  makeSummary(
    "session-2",
    "test",
    "completed",
    35,
    3,
    "Text-based test of intake and transfer to scheduling specialist.",
    "(316) 555-0116",
    "Scheduling Workflow",
    "agent-intake",
  ),
  makeSummary(
    "session-3",
    "voice",
    "dropped",
    90,
    1,
    "Call dropped before identification; agent introduced the workflow.",
    "(270) 555-0117",
    "Customer Support",
    "agent-intake",
  ),
]

const sessionDetailsMap: Record<string, CallSessionDetail> = {}

function addSessionDetail(detail: CallSessionDetail): void {
  sessionDetailsMap[detail.session.id] = detail
}

const session1Messages: CallLogMessage[] = [
  {
    id: "m1",
    timestamp: minutesAgo(19),
    role: "system",
    text: "Call started and routed to Intake agent.",
  },
  {
    id: "m2",
    timestamp: minutesAgo(19),
    role: "agent",
    text: "Thanks for calling Acme. How can I help you today?",
    agentId: "agent-intake",
  },
  {
    id: "m3",
    timestamp: minutesAgo(18.7),
    role: "user",
    text: "Hi, I have a question about a charge on my invoice.",
  },
  {
    id: "m4",
    timestamp: minutesAgo(18.3),
    role: "agent",
    text: "I can help with that. May I have your customer ID?",
    agentId: "agent-intake",
  },
  {
    id: "m5",
    timestamp: minutesAgo(18),
    role: "user",
    text: "It's 45219.",
  },
  {
    id: "m6",
    timestamp: minutesAgo(17.7),
    role: "agent",
    text: "Thank you. I see an open balance of $42.17 on your last invoice. Would you like me to walk through the line items?",
    agentId: "agent-billing",
    pathId: "path-to-billing",
  },
  {
    id: "m7",
    timestamp: minutesAgo(17.2),
    role: "user",
    text: "Yes, please.",
  },
  {
    id: "m8",
    timestamp: minutesAgo(16.5),
    role: "agent",
    text: "Most of the charge is for your standard subscription. I also see a prorated upgrade fee for last month. The details are in the email we sent on May 2nd.",
    agentId: "agent-billing",
    toolName: "billing.lookup_invoice",
    variables: { customer_id: "45219", invoice_id: "inv-2024-05-02" },
  },
]

const session1Events: CallLogTimelineEvent[] = [
  {
    id: "e1",
    timestamp: session1Messages[0]?.timestamp ?? minutesAgo(19),
    type: "system",
    payload: {
      message: "Call connected",
    },
  },
  {
    id: "e2",
    timestamp: session1Messages[4]?.timestamp ?? minutesAgo(18),
    type: "variable_collected",
    payload: {
      variables: { customer_id: "45219" },
      messageId: "m5",
    },
  },
  {
    id: "e3",
    timestamp: session1Messages[5]?.timestamp ?? minutesAgo(17.7),
    type: "path_transition",
    payload: {
      pathName: "To Billing",
      fromAgentId: "agent-intake",
      toAgentId: "agent-billing",
      messageId: "m6",
    },
  },
  {
    id: "e4",
    timestamp: session1Messages[7]?.timestamp ?? minutesAgo(16.5),
    type: "tool_call",
    payload: {
      toolName: "billing.lookup_invoice",
      toolResultSummary: "Fetched open balance and invoice line items.",
      messageId: "m8",
    },
  },
]

addSessionDetail({
  session: mockSessions[0],
  messages: session1Messages,
  events: session1Events,
})

const session2Messages: CallLogMessage[] = [
  {
    id: "t1",
    timestamp: minutesAgo(36),
    role: "system",
    text: "Text test started for workflow \"Customer Support\".",
  },
  {
    id: "t2",
    timestamp: minutesAgo(36),
    role: "agent",
    text: "Hi there! What can I help you with today?",
    agentId: "agent-intake",
  },
  {
    id: "t3",
    timestamp: minutesAgo(35.7),
    role: "user",
    text: "I need to reschedule my appointment for next week.",
  },
  {
    id: "t4",
    timestamp: minutesAgo(35.3),
    role: "agent",
    text: "Sure, I can help reschedule. What day and time works best?",
    agentId: "agent-scheduling",
    pathId: "path-to-scheduling",
  },
]

const session2Events: CallLogTimelineEvent[] = [
  {
    id: "te1",
    timestamp: session2Messages[0]?.timestamp ?? minutesAgo(36),
    type: "system",
    payload: {
      message: "Test session started",
    },
  },
  {
    id: "te2",
    timestamp: session2Messages[3]?.timestamp ?? minutesAgo(35.3),
    type: "path_transition",
    payload: {
      pathName: "To Scheduling",
      fromAgentId: "agent-intake",
      toAgentId: "agent-scheduling",
      messageId: "t4",
    },
  },
]

addSessionDetail({
  session: mockSessions[1],
  messages: session2Messages,
  events: session2Events,
})

const session3Messages: CallLogMessage[] = [
  {
    id: "d1",
    timestamp: minutesAgo(92),
    role: "system",
    text: "Call started and routed to Intake agent.",
  },
  {
    id: "d2",
    timestamp: minutesAgo(92),
    role: "agent",
    text: "Thanks for calling Acme. This is the virtual assistant. How can I help?",
    agentId: "agent-intake",
  },
]

const session3Events: CallLogTimelineEvent[] = [
  {
    id: "de1",
    timestamp: minutesAgo(91.5),
    type: "system",
    payload: {
      message: "Call dropped by caller.",
    },
  },
]

addSessionDetail({
  session: mockSessions[2],
  messages: session3Messages,
  events: session3Events,
})

export function getMockSessionDetail(id: string): CallSessionDetail | null {
  return sessionDetailsMap[id] ?? null
}


