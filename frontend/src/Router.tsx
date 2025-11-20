import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppSidebar } from "@/components/layout/AppSidebar"
import DashboardPage from "@/pages/DashboardPage"
import AnalyticsPage from "@/pages/AnalyticsPage"
import WorkflowListView from "@/pages/WorkflowListView"
import WorkflowCanvasPage from "@/pages/WorkflowCanvasPage"
import IntegrationsPage from "./pages/IntegrationsPage"
import IntegrationsCallbackPage from "./pages/IntegrationsCallbackPage"
import { CallLogsPage } from "./pages/CallLogsPage"
import ComingSoonPage from "@/pages/ComingSoonPage"

export function AppRouter() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-background font-sans">
        <AppSidebar />
        <main className="flex-1 relative bg-background/50 flex flex-col overflow-hidden">
          {/* Subtle pattern from Reference 1 - Very faint */}
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.3] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] pointer-events-none" />
          
          <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/workflows" element={<WorkflowListView />} />
              <Route path="/workflows/:workflowId" element={<WorkflowCanvasPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/integrations/callback" element={<IntegrationsCallbackPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/call-logs" element={<CallLogsPage />} />
              <Route path="/settings" element={<ComingSoonPage title="Settings" />} />
              <Route path="/support" element={<ComingSoonPage title="Help & Support" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
