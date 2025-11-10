import { Wrench, GitBranch } from "lucide-react"

export default function AgentNode({ data, selected }: any) {
  const isConfigured = data.name && data.instructions

  if (!isConfigured) {
    return (
      <div
        className={`w-48 px-4 py-3 rounded-lg bg-background border-2 transition-all ${
          selected ? "border-accent shadow-lg shadow-accent/50" : "border-border hover:border-border-hover"
        }`}
      >
        <div className="text-center">
          <p className="font-semibold text-text-primary">Untitled Agent</p>
          <p className="text-xs text-text-secondary mt-1">Click to configure</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`w-64 rounded-lg bg-background border-2 overflow-hidden transition-all ${
        selected ? "border-accent shadow-lg shadow-accent/50" : "border-border hover:shadow-md"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
            👤
          </div>
          <p className="font-semibold text-text-primary text-sm truncate">{data.name}</p>
        </div>
      </div>

      {/* Instructions Preview */}
      <div className="px-4 py-3">
        <p className="text-xs text-text-secondary line-clamp-3">{data.instructions}</p>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-background-secondary">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Wrench className="w-3 h-3" />
            <span>{data.toolCount}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <GitBranch className="w-3 h-3" />
            <span>{data.pathCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}









