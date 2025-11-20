import { useCallback, useState } from "react"

export function useAsyncAction() {
  const [loading, setLoading] = useState(false)

  const run = useCallback(async <T>(operation: () => Promise<T>) => {
    setLoading(true)
    try {
      return await operation()
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, run }
}
