import { useEffect, useMemo, useState } from "react"
import { Search, Check } from "lucide-react"
import { FaGoogle, FaSalesforce, FaSlack } from "react-icons/fa"
import { SiZendesk, SiAirtable, SiGooglesheets } from "react-icons/si"
import type { IconType } from "react-icons"
import { useIntegrationStatus } from "../hooks/useIntegrationStatus"
import { disconnectIntegration } from "../lib/api"
import { buildIntegrationAuthorizeUrls } from "../lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IntegrationCardSkeleton } from "../components/integrations/IntegrationCardSkeleton"
import { MainLayout } from "@/components/layout/MainLayout"

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
    <MainLayout 
      title="Integrations" 
      subtitle="Connect your agents to the outside world."
    >
      <div className="mb-8 relative max-w-md">
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
         <input
           type="text"
           placeholder="Search integrations..."
           value={searchQuery}
           onChange={(e) => setSearchQuery(e.target.value)}
           className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
         />
      </div>

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
            <div key={integration.id} className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6 flex flex-col h-full bg-white dark:bg-card hover:shadow-md transition-all">
               {/* Header */}
               <div className="flex justify-between items-start mb-4">
                  <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl ${integration.iconColor}`}>
                     <Icon />
                  </div>
                  {isConnected ? (
                    <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20 shadow-none">
                       <Check size={12} className="mr-1" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground bg-secondary/50 border-border">
                       {isComingSoon ? "Coming Soon" : "Not Connected"}
                    </Badge>
                  )}
               </div>
               
               {/* Content */}
               <div className="mb-4 flex-1">
                  <h3 className="font-heading font-semibold text-base mb-1">{integration.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{integration.description}</p>
                  {connectedSubtitle && <p className="mt-2 text-xs text-muted-foreground">Connected as {connectedSubtitle}</p>}
                  {errorMessage && <p className="mt-2 text-sm text-destructive">{errorMessage}</p>}
               </div>

               {/* Footer / Action */}
               <div className="pt-4 mt-auto border-t border-border/50">
                  {isComingSoon ? (
                     <Button variant="outline" className="w-full shadow-none" disabled>Coming Soon</Button>
                  ) : (
                     <Button 
                       variant={isConnected ? "outline" : "default"} 
                       className={`w-full shadow-none ${!isConnected && "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                       size="sm"
                       onClick={() => void handleToggle(integration.id)}
                       disabled={isBusy}
                     >
                       {isConnected ? "Disconnect" : "Connect"}
                     </Button>
                  )}
               </div>
            </div>
          )
        })}
      </div>
    </MainLayout>
  )
}
