import { X, Edit2 } from "lucide-react"
import { Button } from "./ui/button"
import type { Agent, Path } from "../types/workflow"

interface ConfigPanelProps {
  agent: Agent
  onEditAgent: () => void
  onAddPath: () => void
  onEditPath: (path: Path) => void
  onDeletePath: (pathId: string | number) => void
  paths: Path[]
  onClose: () => void
}

export default function ConfigPanel({ agent, onEditAgent, onAddPath, onEditPath, onDeletePath, paths, onClose }: ConfigPanelProps) {
  return (
    <div className="w-96 bg-background border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6">
        <h2 className="font-semibold text-text-primary">Agent Configuration</h2>
        <button onClick={onClose} className="p-1 hover:bg-background-secondary rounded transition-colors">
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Agent Name Section */}
        <div className="pb-4 border-b border-border">
          <label className="text-xs font-semibold text-text-secondary uppercase">Agent Name</label>
          <p className="text-text-primary font-semibold mt-2">{agent.name}</p>
        </div>

        {/* Paths Section */}
        <div className="py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-text-secondary uppercase">Paths ({paths.length})</label>
            <button onClick={onAddPath} className="text-text-secondary hover:text-text-primary text-sm font-semibold">
              +
            </button>
          </div>

          <div className="space-y-0">
            {paths.length === 0 ? (
              <p className="text-xs text-text-tertiary py-2">No paths configured</p>
            ) : (
              paths.map((path) => (
                <div
                  key={path.id}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-background-secondary transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onDeletePath(path.id)}
                    aria-label={`Delete path ${path.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-error text-error text-lg leading-none hover:bg-error/10"
                  >
                    &minus;
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {path.name}
                      {path.hideEdge ? " (hidden)" : ""}
                    </p>
                    {path.description && (
                      <p className="text-xs text-text-tertiary truncate">{path.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditPath(path)}
                    aria-label={`Edit path ${path.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-text-secondary hover:text-text-primary"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer - Edit Agent Button */}
      <div className="h-16 border-t border-border flex items-center px-6">
        <Button onClick={onEditAgent} className="w-full bg-button-primary-bg text-button-primary-text hover:opacity-90">
          <Edit2 className="w-4 h-4 mr-2" />
          Edit Agent
        </Button>
      </div>
    </div>
  )
}
