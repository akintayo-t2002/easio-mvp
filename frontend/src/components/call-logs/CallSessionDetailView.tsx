import React, { useMemo, useRef, useEffect } from "react"
import { MessageSquare } from "lucide-react"

import type { CallLogMessage, CallSessionDetail } from "../../types/logs"
import { Skeleton } from "../ui/skeleton"

interface CallSessionDetailViewProps {
  details: CallSessionDetail | null
  isLoading?: boolean
}

function groupEventsByMessageId(
  detail: CallSessionDetail | null,
): Record<string, { type: string; label: string }[]> {
  if (!detail) {
    return {}
  }
  const map: Record<string, { type: string; label: string }[]> = {}
  for (const event of detail.events) {
    const messageId = event.payload.messageId
    if (!messageId) continue
    const label =
      event.type === "path_transition"
        ? `Path: ${event.payload.pathName ?? "Transition"}`
        : event.type === "tool_call"
          ? `Tool: ${event.payload.toolName ?? "Tool call"}`
          : event.type === "variable_collected"
            ? "Variables collected"
            : "System event"
    map[messageId] = [...(map[messageId] ?? []), { type: event.type, label }]
  }
  return map
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function isUserMessage(message: CallLogMessage): boolean {
  return message.role === "user"
}

export function CallSessionDetailView({ details, isLoading = false }: CallSessionDetailViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const eventsByMessageId = useMemo(() => groupEventsByMessageId(details), [details])

  useEffect(() => {
    if (!containerRef.current) return
    const node = containerRef.current
    node.scrollTop = node.scrollHeight
  }, [details])

  if (isLoading) {
    return <CallSessionDetailSkeleton />
  }

  if (!details) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background-secondary text-text-secondary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">No call selected</p>
          <p className="text-xs text-text-secondary">Choose a session on the left to review its transcript.</p>
        </div>
      </div>
    )
  }

  const { session, messages } = details

  // TODO: Once backend tracking for call sessions is available, augment this
  // header with actions like "Open workflow", "Download audio", and "View analytics"
  // using the workflow / version identifiers included in the session payload.

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-text-primary">Call transcript</h2>
          <p className="text-xs text-text-secondary">
            {new Date(session.startedAt).toLocaleString()} ·{" "}
            {session.channel === "voice" ? "Voice" : "Test/Text"} · {session.status}
          </p>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto bg-background px-6 py-4">
        {messages.map((message) => {
          const user = isUserMessage(message)
          const label =
            message.role === "user"
              ? "Caller"
              : message.role === "agent"
                ? "Agent"
                : message.role === "tool"
                  ? "Tool"
                  : "System"
          const linkedEvents = eventsByMessageId[message.id] ?? []

          return (
            <div
              key={message.id}
              className={`flex flex-col ${user ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold ${
                    user ? "text-text-secondary" : "text-blue-600"
                  }`}
                >
                  {label}
                </span>
                <span className="text-[10px] text-text-tertiary">{formatTime(message.timestamp)}</span>
              </div>
              <div
                className={`mt-1 max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  user
                    ? "bg-background-secondary text-text-primary"
                    : "bg-background text-text-primary border border-border"
                }`}
              >
                {message.text}
              </div>
              {message.toolName && (
                <div className="mt-1 text-[10px] text-text-secondary">
                  Tool: {message.toolName}
                </div>
              )}
              {message.variables && Object.keys(message.variables).length > 0 && (
                <div className="mt-1 text-[10px] text-text-secondary">
                  Vars:{" "}
                  {Object.entries(message.variables)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(", ")}
                </div>
              )}
              {linkedEvents.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {linkedEvents.map((event) => (
                    <span
                      key={`${event.type}-${event.label}`}
                      className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] text-text-secondary"
                    >
                      {event.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CallSessionDetailSkeleton() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-48" />
      </div>
      <div className="flex-1 space-y-4 overflow-hidden px-6 py-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-10 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}


