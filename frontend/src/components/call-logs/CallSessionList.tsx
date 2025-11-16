import React from "react"

import type { CallSessionSummary } from "../../types/logs"
import { Badge } from "../ui/badge"
import { cn } from "../../lib/utils"

interface CallSessionListProps {
  sessions: CallSessionSummary[]
  selectedSessionId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
  error: string | null
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatDuration(seconds?: number | null): string {
  if (!seconds && seconds !== 0) {
    return ""
  }
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

export function CallSessionList({
  sessions,
  selectedSessionId,
  onSelect,
  isLoading,
  error,
}: CallSessionListProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-text-secondary">
        Loading call sessions…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-xs text-error">
        <p>Unable to load call logs.</p>
        <p className="mt-1 text-[11px] text-text-secondary">{error}</p>
      </div>
    )
  }

  if (!sessions.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-xs text-text-secondary">
        <p>No calls match the current filters.</p>
        <p className="mt-1 text-[11px]">New calls will appear here as they are completed.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2">
        <p className="text-[11px] font-medium text-text-secondary">Recent calls</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-border">
          {sessions.map((session) => {
            const isActive = session.id === selectedSessionId
            const statusLabel =
              session.status === "completed"
                ? "Completed"
                : session.status === "dropped"
                  ? "Dropped"
                  : session.status === "failed"
                    ? "Failed"
                    : "Active"

            const statusClass =
              session.status === "completed"
                ? "bg-green-50 text-green-700 border-green-100"
                : session.status === "dropped"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-100"
                  : session.status === "failed"
                    ? "bg-red-50 text-red-700 border-red-100"
                    : "bg-blue-50 text-blue-700 border-blue-100"

            const channelLabel = session.channel === "voice" ? "Voice" : "Test/Text"

            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 px-4 py-3 text-left text-xs transition-colors",
                    isActive
                      ? "bg-background text-text-primary"
                      : "hover:bg-background-secondary/80 text-text-secondary",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium text-text-primary">
                      {formatTime(session.startedAt) || "Unknown time"}
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      {formatDuration(session.durationSeconds) || "—"}
                    </span>
                  </div>
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border px-2 py-0.5 text-[10px] font-medium",
                          session.channel === "voice"
                            ? "border-blue-200 text-blue-700 bg-blue-50"
                            : "border-purple-200 text-purple-700 bg-purple-50",
                        )}
                      >
                        {channelLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("border px-2 py-0.5 text-[10px] font-medium", statusClass)}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    {session.entryAgentId && (
                      <span className="text-[10px] text-text-tertiary">Entry agent</span>
                    )}
                  </div>
                  {session.summary && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-text-secondary">{session.summary}</p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}


