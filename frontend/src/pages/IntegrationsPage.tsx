import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { FaGoogle, FaSalesforce, FaSlack } from "react-icons/fa"
import { SiZendesk, SiAirtable, SiGooglesheets } from "react-icons/si"
import type { IconType } from "react-icons"
import { useIntegrationStatus } from "../hooks/useIntegrationStatus"
import { disconnectIntegration } from "../lib/api"
import { buildIntegrationAuthorizeUrls } from "../lib/utils"
import { Card } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { IntegrationCardSkeleton } from "../components/integrations/IntegrationCardSkeleton"

interface Integration {
  id: string
  name: string
  description: string
  icon: IconType
  iconColor: string
  status: "live" | "coming-soon"
}

const INTEGRATIONS: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Enable your AI worker send and manage messages",
    icon: FaGoogle,
    iconColor: "text-red-500",
    status: "live",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Keep your data and deals flowing with real-time updates",
    icon: FaSalesforce,
    iconColor: "text-blue-500",
    status: "coming-soon",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Sync every call, log, update directly into your sheets",
    icon: SiGooglesheets,
    iconColor: "text-green-500",
    status: "coming-soon",
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Query records and create entries from calls",
    icon: SiAirtable,
    iconColor: "text-yellow-600",
    status: "live",
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Create tickets and log resolutions from calls",
    icon: SiZendesk,
    iconColor: "text-green-600",
    status: "coming-soon",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Notify your team with call summaries and alerts instantly",
    icon: FaSlack,
    iconColor: "text-purple-500",
    status: "coming-soon",
  },
]

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const airtableStatus = useIntegrationStatus("airtable")
  const gmailStatus = useIntegrationStatus("gmail")
  const [airtableActionPending, setAirtableActionPending] = useState(false)
  const [airtableActionError, setAirtableActionError] = useState<string | null>(null)
  const [gmailActionPending, setGmailActionPending] = useState(false)
  const [gmailActionError, setGmailActionError] = useState<string | null>(null)
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(null)

  useEffect(() => {
    if (airtableStatus.status?.connected) {
      setAirtableActionError(null)
    }
    if (gmailStatus.status?.connected) {
      setGmailActionError(null)
    }
    if (gmailStatus.status?.email) {
      setGmailConnectedEmail(gmailStatus.status.email)
    }
  }, [airtableStatus.status?.connected, gmailStatus.status?.connected, gmailStatus.status?.email])

  const filteredIntegrations = useMemo(
    () =>
      INTEGRATIONS.filter(
        (integration) =>
          integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          integration.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery],
  )

  const handleToggle = async (integrationId: string) => {
    const integrationMeta = INTEGRATIONS.find((integration) => integration.id === integrationId)
    if (!integrationMeta || integrationMeta.status === "coming-soon") {
      return
    }

    if (integrationId === "airtable") {
      const currentlyConnected = Boolean(airtableStatus.status?.connected)

      if (currentlyConnected) {
        const confirmed = window.confirm("Disconnect Airtable for this workspace?")
        if (!confirmed) {
          return
        }

        try {
          setAirtableActionPending(true)
          setAirtableActionError(null)
          await disconnectIntegration("airtable")
          await airtableStatus.refresh()
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to disconnect Airtable"
          setAirtableActionError(message)
        } finally {
          setAirtableActionPending(false)
        }
        return
      }

      setAirtableActionError(null)
      const { authorizeUrl } = buildIntegrationAuthorizeUrls({ provider: integrationId })

      window.location.href = authorizeUrl
      return
    }

    if (integrationId === "gmail") {
      const currentlyConnected = Boolean(gmailStatus.status?.connected)

      if (currentlyConnected) {
        const confirmed = window.confirm("Disconnect Gmail for this workspace?")
        if (!confirmed) {
          return
        }

        try {
          setGmailActionPending(true)
          setGmailActionError(null)
          await disconnectIntegration("gmail")
          await gmailStatus.refresh()
          setGmailConnectedEmail(null)
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to disconnect Gmail"
          setGmailActionError(message)
        } finally {
          setGmailActionPending(false)
        }
        return
      }

      setGmailActionError(null)
      const { authorizeUrl } = buildIntegrationAuthorizeUrls({ provider: integrationId })
      window.location.href = authorizeUrl
      return
    }

    return
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-8 py-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Integrations</h1>

        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search integrations....."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Integration Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((integration) => {
            const Icon = integration.icon
            const isAirtable = integration.id === "airtable"
            const isGmail = integration.id === "gmail"
            const integrationStatus = isAirtable ? airtableStatus : isGmail ? gmailStatus : null
            const isComingSoon = integration.status === "coming-soon"
            const isLoadingStatus = Boolean(integrationStatus?.isLoading)
            const hasStatus = Boolean(integrationStatus?.status)
            const showSkeleton = !isComingSoon && isLoadingStatus && !hasStatus

            if (showSkeleton) {
              return <IntegrationCardSkeleton key={integration.id} />
            }

            const isConnected = integrationStatus ? Boolean(integrationStatus.status?.connected) : false
            const isBusy = isAirtable
              ? airtableStatus.isLoading || airtableActionPending
              : isGmail
                ? gmailStatus.isLoading || gmailActionPending
                : false
            const errorMessage = isAirtable
              ? airtableActionError
              : isGmail
                ? gmailActionError
                : null
            const connectedSubtitle =
              isGmail && isConnected ? gmailStatus.status?.email ?? gmailConnectedEmail : null

            return (
              <Card
                key={integration.id}
                className="p-6 hover:border-accent transition-colors flex flex-col gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 flex items-center justify-center ${integration.iconColor}`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  {isComingSoon ? (
                    <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                      Coming Soon
                    </Badge>
                  ) : (
                    <button
                      onClick={() => void handleToggle(integration.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isConnected ? "bg-green-500" : "bg-gray-300"
                      }`}
                      aria-label={`Toggle ${integration.name} connection`}
                      disabled={isBusy}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isConnected ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">{integration.name}</h3>
                  <p className="text-sm text-text-secondary">{integration.description}</p>
                  {connectedSubtitle ? (
                    <p className="mt-2 text-xs text-text-secondary">Connected as {connectedSubtitle}</p>
                  ) : null}
                  {errorMessage ? (
                    <p className="mt-2 text-sm text-error">{errorMessage}</p>
                  ) : null}
                  {isComingSoon ? (
                    <p className="mt-2 text-xs text-text-tertiary">
                      This integration is on our roadmap. Stay tuned!
                    </p>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}



