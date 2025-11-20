import React, { useMemo } from "react"

import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { CallLogsTable } from "../components/call-logs/CallLogsTable"
import { CallSessionDetailView } from "../components/call-logs/CallSessionDetailView"
import { useCallLogs } from "../hooks/useCallLogs"
import { MainLayout } from "@/components/layout/MainLayout"

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
    <MainLayout 
      title="Call Logs" 
      subtitle="Review recent calls, transcripts, and agent behavior across your workflows."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-muted-foreground bg-background/50">
            {filterDescription}
          </Badge>
          <Button variant="outline" size="sm" className="text-xs shadow-none" disabled>
            Export
          </Button>
        </div>
      }
    >
      <div className="flex-1 flex flex-col bg-background rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-card/50">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Channel</span>
          <div className="inline-flex rounded-md bg-secondary/50 p-1 text-[11px]">
            {(["all", "voice", "test"] as CallChannelFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilters({ channel: value })}
                className={`rounded px-2 py-1 capitalize transition-all font-medium ${
                  filters.channel === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "all" ? "All" : value === "voice" ? "Voice" : "Test/Text"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Status</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            <span className="text-muted-foreground font-medium">Date range</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
      <div className="flex flex-1 h-[600px] overflow-hidden">
        {selectedSession ? (
          <>
            <div className="flex flex-col border-r border-border bg-background w-[65%]">
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
    </MainLayout>
  )
}


