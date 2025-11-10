import { useCallback, useState } from "react"

import { ApiError, createTestSession } from "../lib/api"
import type { WorkflowTestSessionResponse } from "../types/workflow"

export type TestSessionStatus = "idle" | "starting" | "ready" | "error"

export interface TestSessionState {
  status: TestSessionStatus
  session: WorkflowTestSessionResponse | null
  shouldConnect: boolean
  error: string | null
  start: (versionId: string) => Promise<WorkflowTestSessionResponse | void>
  stop: () => void
  clearError: () => void
}

export function useTestSession(): TestSessionState {
  const [status, setStatus] = useState<TestSessionStatus>("idle")
  const [session, setSession] = useState<WorkflowTestSessionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shouldConnect, setShouldConnect] = useState(false)

  const start = useCallback(async (versionId: string) => {
    setStatus("starting")
    setError(null)

    try {
      const result = await createTestSession(versionId)
      setSession(result)
      setShouldConnect(true)
      setStatus("ready")
      return result
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to start test session"
      setError(message)
      setShouldConnect(false)
      setSession(null)
      setStatus("error")
      return undefined
    }
  }, [])

  const stop = useCallback(() => {
    setShouldConnect(false)
    setSession(null)
    setStatus("idle")
    setError(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    status,
    session,
    shouldConnect,
    error,
    start,
    stop,
    clearError,
  }
}
