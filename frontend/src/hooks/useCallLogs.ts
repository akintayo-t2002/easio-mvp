import { useCallback, useEffect, useMemo, useState } from "react"

import type { CallSessionDetail, CallSessionSummary } from "../types/logs"
import { mockSessions, getMockSessionDetail } from "../lib/mockCallLogs"

export type CallLogFilters = {
  channel?: "all" | "voice" | "test"
  status?: "all" | "completed" | "dropped" | "failed"
  dateRange?: "24h" | "7d" | "30d"
  workflowVersionId?: string
}

export interface UseCallLogsState {
  sessions: CallSessionSummary[]
  selectedSession: CallSessionSummary | null
  details: CallSessionDetail | null
  detailsLoading: boolean
  loading: boolean
  error: string | null
  filters: CallLogFilters
  setFilters: (next: CallLogFilters) => void
  selectSession: (id: string) => void
}

// NOTE: This hook currently operates entirely on synchronous mock data.
// It is intentionally shaped so that it can later call real backend APIs:
// - GET /call-sessions?workflow_version_id=...
// - GET /call-sessions/{id}
// To integrate with the backend, replace the mockSessions/getMockSessionDetail
// usage with API functions in `lib/api.ts` while keeping the hook signature.

export function useCallLogs(initialFilters?: CallLogFilters): UseCallLogsState {
  const [filters, setFiltersState] = useState<CallLogFilters>({
    channel: "all",
    status: "all",
    dateRange: "24h",
    ...initialFilters,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<CallSessionDetail | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const loading = false

  const sessions = useMemo<CallSessionSummary[]>(() => {
    return mockSessions.filter((session) => {
      if (filters.channel && filters.channel !== "all" && session.channel !== filters.channel) {
        return false
      }
      if (filters.status && filters.status !== "all" && session.status !== filters.status) {
        return false
      }
      // Date range filtering is intentionally light in the mock:
      // production implementation should filter on startedAt timestamps.
      return true
    })
  }, [filters.channel, filters.status])

  const selectedSession = useMemo<CallSessionSummary | null>(() => {
    if (!selectedId || !sessions.length) {
      return null
    }
    return sessions.find((session) => session.id === selectedId) ?? null
  }, [selectedId, sessions])

  useEffect(() => {
    let cancelled = false

    if (!selectedSession) {
      setDetails(null)
      setDetailsLoading(false)
      return () => {
        cancelled = true
      }
    }

    const fetchDetails = async () => {
      setDetailsLoading(true)
      try {
        const result = await Promise.resolve(getMockSessionDetail(selectedSession.id))
        if (!cancelled) {
          setDetails(result)
          setError(null)
        }
      } catch (err) {
        console.error("Failed to load mock session detail", err)
        if (!cancelled) {
          setError("Failed to load session details")
          setDetails(null)
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false)
        }
      }
    }

    void fetchDetails()

    return () => {
      cancelled = true
    }
  }, [selectedSession])

  const selectSession = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const setFilters = useCallback((next: CallLogFilters) => {
    setFiltersState((prev) => ({
      ...prev,
      ...next,
    }))
  }, [])

  return {
    sessions,
    selectedSession,
    details,
    detailsLoading,
    loading,
    error,
    filters,
    setFilters,
    selectSession,
  }
}


