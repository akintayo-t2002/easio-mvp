import React, { useMemo } from "react"

import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { CallLogsTable } from "../components/call-logs/CallLogsTable"
import { CallSessionDetailView } from "../components/call-logs/CallSessionDetailView"
import { useCallLogs } from "../hooks/useCallLogs"

export type CallChannelFilter = "all" | "voice" | "test"
export type CallStatusFilter = "all" | "completed" | "dropped" | "failed"
export type DateRangeFilter = "24h" | "7d" | "30d"

export function CallLogsPage(): React.JSX.Element {
  const {
    sessions,
    selectedSession,
    details,
    detailsLoading,
    filters,
    setFilters,
    selectSession,
    loading,
    error,
  } = useCallLogs()

  const filterDescription = useMemo(() => {
    const rangeLabel =
      filters.dateRange === "24h" ? "Last 24 hours" : filters.dateRange === "7d" ? "Last 7 days" : "Last 30 days"
    return rangeLabel
  }, [filters.dateRange])

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header section */}
      <div className="flex h-20 items-center justify-between border-b border-border bg-background px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-text-primary">Call Logs</h1>
          <p className="text-xs text-text-secondary">
            Review recent calls, transcripts, and agent behavior across your workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-text-secondary">
            {filterDescription}
          </Badge>
          <Button variant="outline" size="sm" className="text-xs" disabled>
            Export
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-secondary">Channel</span>
          <div className="inline-flex rounded-full bg-background-secondary p-1 text-[11px]">
            {(["all", "voice", "test"] as CallChannelFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilters({ channel: value })}
                className={`rounded-full px-2 py-1 capitalize transition-colors ${
                  filters.channel === value
                    ? "bg-black text-white"
                    : "text-text-secondary hover:bg-background hover:text-text-primary"
                }`}
              >
                {value === "all" ? "All" : value === "voice" ? "Voice" : "Test/Text"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Status</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-text-primary"
              value={filters.status}
              onChange={(event) => setFilters({ status: event.target.value as CallStatusFilter })}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Date range</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-text-primary"
              value={filters.dateRange}
              onChange={(event) => setFilters({ dateRange: event.target.value as DateRangeFilter })}
            >
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table layout - full width until a row is selected */}
      <div className="flex flex-1 overflow-hidden">
        {selectedSession ? (
          <>
            <div className="flex flex-col border-r border-border bg-background" style={{ width: "65%" }}>
              <CallLogsTable
                sessions={sessions}
                selectedSessionId={selectedSession.id}
                onSelect={selectSession}
                isLoading={loading}
                error={error}
              />
            </div>
            <div className="flex flex-1 flex-col bg-background">
              <CallSessionDetailView details={details} isLoading={detailsLoading} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col bg-background">
            <CallLogsTable
              sessions={sessions}
              selectedSessionId={null}
              onSelect={selectSession}
              isLoading={loading}
              error={error}
            />
          </div>
        )}
      </div>
    </div>
  )
}


