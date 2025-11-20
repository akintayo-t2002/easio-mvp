import type React from "react"
import { useParams } from "react-router-dom"

import TopBar from "@/components/topbar"
import { WorkflowCanvas } from "@/sections/WorkflowCanvas"
import ConfigPanel from "@/components/config-panel"
import EditAgentModal from "@/components/edit-agent-modal"
import PathSheet, { type PathSheetPayload } from "@/components/path-sheet"
import LoadingSpinner from "@/components/LoadingSpinner"
import { TestChatModal } from "@/components/test-chat/TestChatModal"
import { useWorkflowCanvasState } from "@/hooks/useWorkflowCanvasState"

export default function WorkflowCanvasPage(): React.JSX.Element {
  const { workflowId } = useParams<{ workflowId: string }>()
  const canvas = useWorkflowCanvasState(workflowId)

  const selectedAgentPaths = canvas.selectedAgent?.paths ?? []

  const handlePathSheetSave = async (payload: PathSheetPayload, options: { mode: "create" } | { mode: "edit"; pathId: string }) => {
    if (options.mode === "edit") {
      const success = await canvas.handleUpdatePath(options.pathId, payload)
      if (success) {
        canvas.closePathSheet()
      }
      return success
    }

    const success = await canvas.handleSavePath(payload)
    if (success) {
      canvas.closePathSheet()
    }
    return success
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <TopBar
        onAddAgent={canvas.handleAddAgent}
        workflowName={canvas.workflow?.name}
        workflowId={canvas.workflow?.id}
        workflowStatus={canvas.workflow?.status}
        onPublish={canvas.currentVersionId ? canvas.handlePublish : undefined}
        isPublishing={canvas.publishing}
        onNameChange={canvas.handleWorkflowNameChange}
        onTest={canvas.currentVersionId ? canvas.handleTestWorkflow : undefined}
        isTesting={canvas.isTesting}
      />

      {!canvas.currentVersionId && !canvas.isLoadingWorkflow && (
        <div className="px-6 py-3 text-sm text-amber-900 bg-amber-50 border-b border-amber-200">
          Save or load a workflow version to enable testing and publishing.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          {canvas.canvasError && <div className="p-4 text-sm text-error">{canvas.canvasError}</div>}
          {canvas.isLoadingWorkflow ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner message="Loading workflow..." size="lg" />
            </div>
          ) : (
            <WorkflowCanvas
              nodes={canvas.nodes}
              edges={canvas.edges}
              onNodesChange={canvas.handleNodesChange}
              onEdgesChange={canvas.onEdgesChange}
              onNodeClick={canvas.handleNodeClick}
              onPaneClick={canvas.handlePaneClick}
              onConnect={canvas.handleConnect}
            />
          )}
        </div>
        {canvas.selectedAgent && (
          <ConfigPanel
            agent={canvas.selectedAgent}
            onEditAgent={canvas.openEditModal}
            onAddPath={canvas.handleAddPathClick}
            onEditPath={(path) => {
              canvas.openPathSheetForEdit(path)
            }}
            onDeletePath={(pathId) => {
              void canvas.handleDeletePath(pathId)
            }}
            paths={selectedAgentPaths}
            onClose={canvas.handlePaneClick}
          />
        )}
      </div>

      {canvas.showEditModal && canvas.selectedAgent && (
        <EditAgentModal
          agent={canvas.selectedAgent}
          onClose={canvas.closeEditModal}
          onSave={(agent) => {
            void canvas.handleUpdateAgent(agent)
          }}
        />
      )}

      {canvas.showPathSheet && (
        <PathSheet
          isOpen={canvas.showPathSheet}
          mode={canvas.pathSheetMode}
          initialPath={canvas.pathSheetMode === "edit" ? canvas.pathBeingEdited : undefined}
          onCancel={canvas.closePathSheet}
          onSave={handlePathSheetSave}
          agents={canvas.candidateAgents}
          defaultTargetAgentId={canvas.pathSheetDefaultTargetId}
        />
      )}

      <TestChatModal
        open={canvas.showTestModal}
        onClose={canvas.handleCloseTestModal}
        workflowName={canvas.workflow?.name}
        workflowVersionId={canvas.showTestModal && canvas.currentVersionId ? canvas.currentVersionId : null}
      />
    </div>
  )
}
