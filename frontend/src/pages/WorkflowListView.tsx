import React, { useCallback } from "react"
import { MainLayout } from "@/components/layout/MainLayout"
import { Button } from "@/components/ui/button"
import WorkflowsList from "../components/workflow-list"
import { useWorkflowsQuery, useCreateWorkflowMutation } from "@/hooks/useWorkflows"
import type { WorkflowSummary } from "../types/workflow"
import { useNavigate } from "react-router-dom"

export default function WorkflowListView(): React.JSX.Element {
  const { data: workflows = [], isLoading, isError } = useWorkflowsQuery()
  const createWorkflowMutation = useCreateWorkflowMutation()
  const navigate = useNavigate()

  const handleCreateWorkflow = useCallback(async () => {
    try {
      const created = await createWorkflowMutation.mutateAsync()
      navigate(`/workflows/${created.workflow.id}`)
    } catch (error) {
      console.error("Failed to create workflow", error)
    }
  }, [createWorkflowMutation, navigate])

  const handleSelectWorkflow = useCallback(
    (workflow: WorkflowSummary) => {
      navigate(`/workflows/${workflow.id}`)
    },
    [navigate],
  )

  const workflowError = isError || createWorkflowMutation.isError ? "Something went wrong. Please try again." : null

  return (
    <MainLayout
      title="Workflows"
      subtitle="Manage your agent workflows."
      actions={
        <Button
          onClick={() => {
            void handleCreateWorkflow()
          }}
          disabled={createWorkflowMutation.isPending}
          className="flex items-center gap-2"
        >
          New Workflow
        </Button>
      }
    >
      <div className="flex-1 flex flex-col">
        {workflowError && <div className="p-4 text-sm text-error">{workflowError}</div>}
        <WorkflowsList
          onCreateWorkflow={() => {
            void handleCreateWorkflow()
          }}
          onSelectWorkflow={handleSelectWorkflow}
          workflows={workflows}
          isLoading={isLoading}
          isCreating={createWorkflowMutation.isPending}
        />
      </div>
    </MainLayout>
  )
}
