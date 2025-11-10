import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

export default function IntegrationsCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    const provider = params.get("provider") ?? undefined
    const error = params.get("error")
    const errorDescription = params.get("error_description")
    const email = params.get("connectedEmail") ?? undefined
    const originParam = params.get("origin")
    const targetOrigin = originParam && originParam.startsWith("http") ? originParam : window.location.origin

    const payload = {
      type: "integration_oauth_complete" as const,
      provider,
      success: !error,
      error: errorDescription ?? error ?? undefined,
      connectedEmail: email,
    }

    const legacyPayload = {
      type: "airtable_oauth_complete",
      provider,
      success: payload.success,
      error: payload.error,
      connectedEmail: email,
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, targetOrigin)

      // Backwards compatibility for existing Airtable listeners
      window.opener.postMessage(legacyPayload, targetOrigin)
      window.close()
    } else {
      navigate("/integrations", { replace: true })
    }
  }, [navigate, params])

  return null
}
