import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createWorkflow, fetchWorkflows } from "@/lib/api"
import type { WorkflowSummary, WorkflowSummaryResponse } from "@/types/workflow"

export const WORKFLOWS_QUERY_KEY = ["workflows"] as const

const mapWorkflowToSummary = (workflow: WorkflowSummaryResponse): WorkflowSummary => ({
  id: workflow.id,
  name: workflow.name,
  description: workflow.description ?? undefined,
  status: workflow.status,
  updatedAt: workflow.updated_at,
  latestPublishedVersionId: workflow.latest_published_version_id ?? undefined,
  latestDraftVersionId: workflow.latest_draft_version_id ?? undefined,
  organizationId: workflow.organization_id,
})

export function useWorkflowsQuery() {
  return useQuery({
    queryKey: WORKFLOWS_QUERY_KEY,
    queryFn: async () => {
      const results = await fetchWorkflows()
      return results.map(mapWorkflowToSummary)
    },
  })
}

export function useCreateWorkflowMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => createWorkflow({ name: "New Workflow", description: "Untitled workflow" }),
    onSuccess: (created) => {
      queryClient.setQueryData(WORKFLOWS_QUERY_KEY, (previous?: WorkflowSummary[]) => {
        const summary: WorkflowSummary = {
          id: created.workflow.id,
          name: created.workflow.name,
          description: created.workflow.description,
          status: created.version.status,
          updatedAt: created.workflow.updated_at,
          latestPublishedVersionId: created.version.status === "published" ? created.version.id : undefined,
          latestDraftVersionId: created.version.status === "draft" ? created.version.id : undefined,
          organizationId: created.workflow.organization_id,
        }

        if (!previous) {
          return [summary]
        }

        const withoutDuplicate = previous.filter((workflow) => workflow.id !== summary.id)
        return [summary, ...withoutDuplicate]
      })

      void queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY })
    },
  })
}
