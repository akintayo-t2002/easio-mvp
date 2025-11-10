import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface BuildAuthorizeUrlsOptions {
  provider: string
  redirectPath?: string
  origin?: string
}

export function buildIntegrationAuthorizeUrls({
  provider,
  redirectPath = "/integrations/callback",
  origin = window.location.origin,
}: BuildAuthorizeUrlsOptions) {
  const normalizedRedirectPath = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`
  const callbackUrl = `${origin}${normalizedRedirectPath}?provider=${provider}&origin=${encodeURIComponent(origin)}`

  const apiBaseEnv = import.meta.env.VITE_API_BASE_URL ?? "/api"
  const apiBase = apiBaseEnv.endsWith("/") ? apiBaseEnv.slice(0, -1) : apiBaseEnv
  const organizationId =
    import.meta.env.VITE_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000000"

  const authorizeUrl = `${apiBase}/oauth/${provider}/authorize?redirect=${encodeURIComponent(
    callbackUrl,
  )}&org_id=${encodeURIComponent(organizationId)}`

  return { authorizeUrl, callbackUrl }
}









