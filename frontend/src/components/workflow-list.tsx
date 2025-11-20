import { useState } from "react"
import { Plus, Zap, Clock } from "lucide-react"
import { Button } from "./ui/button"
import type { WorkflowSummary } from "../types/workflow"

interface WorkflowsListProps {
  onCreateWorkflow: () => void
  onSelectWorkflow: (workflow: WorkflowSummary) => void
  workflows?: WorkflowSummary[]
  isLoading?: boolean
  isCreating?: boolean
}

export default function WorkflowsList({ onCreateWorkflow, onSelectWorkflow, workflows = [], isLoading = false, isCreating = false }: WorkflowsListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const hasWorkflows = workflows.length > 0
  const showSkeletonGrid = isLoading && !hasWorkflows

  return (
    <div className="workflow-fade-enter flex-1 flex flex-col bg-white relative">
      {/* Creation Overlay */}
      {isCreating && (
        <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center text-sm font-medium text-text-secondary">
          Creating workflow...
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {!hasWorkflows ? (
          showSkeletonGrid ? (
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`workflow-skeleton-${index}`}
                    className="h-48 rounded-lg border border-border bg-background-secondary/60 animate-pulse"
                  >
                    <div className="h-full w-full p-6 space-y-4">
                      <div className="h-4 w-24 rounded bg-background" />
                      <div className="h-5 w-3/4 rounded bg-background" />
                      <div className="space-y-2">
                        <div className="h-3 w-full rounded bg-background" />
                        <div className="h-3 w-5/6 rounded bg-background" />
                      </div>
                      <div className="h-4 w-1/2 rounded bg-background" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          // Empty State
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-background-tertiary rounded-full flex items-center justify-center">
                  <Zap size={40} className="text-text-tertiary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">No workflows yet</h2>
              <p className="text-text-secondary mb-8">
                Create your first workflow to start building intelligent voice agent conversations
              </p>
              <Button
                onClick={onCreateWorkflow}
                className="flex items-center gap-2 bg-accent hover:bg-blue-600 text-white px-8 py-3 rounded-lg transition-colors mx-auto"
              >
                <Plus size={20} />
                Create Your First Workflow
              </Button>
            </div>
          </div>
          )
        ) : (
          // Workflows Grid
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onMouseEnter={() => setHoveredId(workflow.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelectWorkflow(workflow)}
                  className="workflow-slide-enter group cursor-pointer"
                >
                  <div
                    className={`h-full border border-workflow-card-border rounded-lg p-6 transition-all duration-200 ${
                      hoveredId === workflow.id
                        ? "bg-workflow-card-hover shadow-lg border-accent"
                        : "bg-workflow-card-bg hover:shadow-md"
                    }`}
                  >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          workflow.status === "published"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {workflow.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>

                    {/* Workflow Name */}
                    <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-accent transition-colors">
                      {workflow.name}
                    </h3>

                    {/* Description */}
                    <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                      {workflow.description || "No description provided"}
                    </p>

                    {/* Metadata */}
                    <div className="space-y-2 mb-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-text-secondary text-sm">
                        <Clock size={16} />
                        <span>Updated {new Date(workflow.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Hover Action */}
                    {hoveredId === workflow.id && (
                      <div className="pt-4 border-t border-border">
                        <Button className="w-full bg-accent hover:bg-blue-600 text-white py-2 rounded transition-colors">
                          Open Workflow
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
