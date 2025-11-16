import React from "react"

import type { CallSessionSummary } from "../../types/logs"
import { Badge } from "../ui/badge"
import { cn } from "../../lib/utils"

interface CallLogsTableProps {
  sessions: CallSessionSummary[]
  selectedSessionId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
  error: string | null
}

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return { date: "", time: "" }
  }
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  return { date, time }
}

function formatDuration(seconds?: number | null): string {
  if (!seconds && seconds !== 0) {
    return "—"
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-green-50 text-green-700 border-green-200",
      }
    case "dropped":
      return {
        label: "Voicemail",
        className: "bg-orange-50 text-orange-700 border-orange-200",
      }
    case "failed":
      return {
        label: "Failed",
        className: "bg-red-50 text-red-700 border-red-200",
      }
    case "active":
      return {
        label: "Call Again",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      }
    default:
      return {
        label: status,
        className: "bg-gray-50 text-gray-700 border-gray-200",
      }
  }
}

export function CallLogsTable({
  sessions,
  selectedSessionId,
  onSelect,
  isLoading,
  error,
}: CallLogsTableProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
        Loading call sessions…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-sm text-error">
        <p>Unable to load call logs.</p>
        <p className="mt-1 text-xs text-text-secondary">{error}</p>
      </div>
    )
  }

  if (!sessions.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-sm text-text-secondary">
        <p>No calls match the current filters.</p>
        <p className="mt-1 text-xs">New calls will appear here as they are completed.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <colgroup>
          <col style={{ width: "60px" }} />
          <col style={{ width: "180px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "180px" }} />
          <col style={{ width: "100px" }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: "120px" }} />
        </colgroup>
        <thead className="sticky top-0 bg-background-secondary backdrop-blur-sm">
          <tr className="border-b-2 border-border">
            <th className="px-4 py-4 text-left text-xs font-semibold text-text-secondary">#</th>
            <th className="px-4 py-4 text-left text-xs font-semibold text-text-secondary">Date</th>
            <th className="px-4 py-4 text-left text-xs font-semibold text-text-secondary">Contact</th>
            <th className="px-4 py-4 text-left text-xs font-semibold text-text-secondary">Workflow</th>
            <th className="px-4 py-4 text-left text-xs font-semibold text-text-secondary">Duration</th>
            <th className="px-4 py-4 text-left text-xs font-semibold text-text-secondary">Call Summary</th>
            <th className="px-4 py-4 text-left text-xs font-semibold text-text-secondary">Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session, index) => {
            const isSelected = session.id === selectedSessionId
            const { date, time } = formatDate(session.startedAt)
            const statusBadge = getStatusBadge(session.status)

            return (
              <tr
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={cn(
                  "cursor-pointer border-b border-border transition-all duration-150",
                  isSelected
                    ? "bg-background-secondary/80 border-l-4 border-l-primary shadow-sm"
                    : "hover:bg-background-secondary/50 border-l-4 border-l-transparent",
                )}
              >
                <td className="px-4 py-5 text-[11px] text-text-tertiary">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="px-4 py-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-text-primary">{date}</span>
                    <span className="text-[11px] text-text-secondary">{time}</span>
                  </div>
                </td>
                <td className="px-4 py-5">
                  <span className="text-base font-medium text-text-primary">
                    {session.phoneNumber || "Unknown"}
                  </span>
                </td>
                <td className="px-4 py-5 text-sm text-text-primary">
                  {session.workflowName || "—"}
                </td>
                <td className="px-4 py-5 text-sm text-text-primary">
                  {formatDuration(session.durationSeconds)}
                </td>
                <td className="px-4 py-5 text-sm text-text-secondary leading-relaxed">
                  <span className="line-clamp-2">{session.summary || "—"}</span>
                </td>
                <td className="px-4 py-5">
                  <Badge
                    variant="outline"
                    className={cn("border px-2 py-1 text-xs font-medium", statusBadge.className)}
                  >
                    {statusBadge.label}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

