import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Sidebar from "./components/sidebar"
import PlaceholderView from "./components/placeholder-view"
import { WorkflowsPage } from "./pages/WorkflowsPage"
import IntegrationsPage from "./pages/IntegrationsPage"
import IntegrationsCallbackPage from "./pages/IntegrationsCallbackPage"
import { CallLogsPage } from "./pages/CallLogsPage"

export function AppRouter() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-canvas-bg">
        <Sidebar />
        <Routes>
          <Route path="/" element={<PlaceholderView title="Dashboard" />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/integrations/callback" element={<IntegrationsCallbackPage />} />
          <Route path="/analytics" element={<PlaceholderView title="Analytics" />} />
          <Route path="/call-logs" element={<CallLogsPage />} />
          <Route path="/settings" element={<PlaceholderView title="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}



