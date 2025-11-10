import { useEffect, useState } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Card } from "./ui/card"

interface Variable {
  id: string
  name: string
  description: string
  required: boolean
}

interface PathSheetProps {
  isOpen: boolean
  onCancel: () => void
  onSave: (path: {
    name: string
    description?: string
    transferMessage?: string
    variables: Variable[]
    targetAgentId: string
    hideEdge: boolean
  }) => Promise<boolean> | boolean
  agents: { id: string; name: string }[]
  defaultTargetAgentId?: string | null
}

export default function PathSheet({ isOpen, onCancel, onSave, agents, defaultTargetAgentId }: PathSheetProps) {
  const [pathName, setPathName] = useState("")
  const [description, setDescription] = useState("")
  const [transferMessage, setTransferMessage] = useState("")
  const [variables, setVariables] = useState<Variable[]>([])
  const [targetAgentId, setTargetAgentId] = useState<string>("")
  const [hideEdge, setHideEdge] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTargetAgentId(defaultTargetAgentId ?? "")
      setHideEdge(false)
    }
  }, [defaultTargetAgentId, isOpen])

  const handleAddVariable = () => {
    const newVariable: Variable = {
      id: Date.now().toString(),
      name: "",
      description: "",
      required: false,
    }
    setVariables([...variables, newVariable])
  }

  const handleRemoveVariable = (id: string) => {
    setVariables(variables.filter((v) => v.id !== id))
  }

  const handleUpdateVariable = (id: string, field: string, value: any) => {
    setVariables(variables.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
  }

  const handleSave = async () => {
    const success = await onSave({
      name: pathName,
      description,
      transferMessage,
      variables,
      targetAgentId,
      hideEdge,
    })
    if (success) {
      resetForm()
    }
  }

  const resetForm = () => {
    setPathName("")
    setDescription("")
    setTransferMessage("")
    setVariables([])
    setTargetAgentId("")
    setHideEdge(false)
  }

  if (!isOpen) return null

  const disableSave = !pathName || !targetAgentId

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          resetForm()
          onCancel()
        }}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-background border-l border-border flex flex-col h-full max-h-screen shadow-lg animate-in slide-in-from-right">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6">
          <h2 className="font-semibold text-text-primary">Configure Path</h2>
          <button
            onClick={() => {
              resetForm()
              onCancel()
            }}
            className="p-1 hover:bg-background-secondary rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Path Name */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Path Name</label>
            <Input
              value={pathName}
              onChange={(e) => setPathName(e.target.value)}
              placeholder="e.g., Transfer to Billing"
              className="mt-2 bg-background-secondary border-border text-text-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When should this path be used?"
              className="mt-2 bg-background-secondary border-border resize-none text-text-primary"
            />
          </div>

          {/* Transfer Message */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Transfer Message</label>
            <Textarea
              value={transferMessage}
              onChange={(e) => setTransferMessage(e.target.value)}
              placeholder="What should the agent say when transferring?"
              className="mt-2 bg-background-secondary border-border resize-none text-text-primary"
            />
          </div>

          {/* Target Agent */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Target Agent</label>
            <select
              value={targetAgentId}
              onChange={(e) => setTargetAgentId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary shadow-sm"
            >
              <option value="" disabled>
                Select an agent
              </option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="hide-edge"
              type="checkbox"
              checked={hideEdge}
              onChange={(e) => setHideEdge(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="hide-edge" className="text-sm text-text-primary">
              Hide this connection on the canvas
            </label>
          </div>

          {/* Required Variables */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-text-secondary uppercase">Required Variables</label>
              <button
                onClick={handleAddVariable}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-accent hover:bg-background-secondary transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Variable
              </button>
            </div>

            <div className="space-y-3">
              {variables.map((variable) => (
                <Card key={variable.id} className="p-4 bg-background-secondary border-border">
                  <div className="space-y-3">
                    <Input
                      value={variable.name}
                      onChange={(e) => handleUpdateVariable(variable.id, "name", e.target.value)}
                      placeholder="Variable name (e.g., account_id)"
                      className="bg-background border-border text-xs text-text-primary"
                    />
                    <Textarea
                      value={variable.description}
                      onChange={(e) => handleUpdateVariable(variable.id, "description", e.target.value)}
                      placeholder="Description"
                      className="bg-background border-border resize-none text-xs text-text-primary"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-text-primary">
                        <input
                          type="checkbox"
                          checked={variable.required}
                          onChange={(e) => handleUpdateVariable(variable.id, "required", e.target.checked)}
                          className="rounded"
                        />
                        Required
                      </label>
                      <button
                        onClick={() => handleRemoveVariable(variable.id)}
                        className="p-1 hover:bg-background rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-error" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 border-t border-border flex items-center justify-end gap-3 px-6">
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              onCancel()
            }}
            className="border-border text-text-primary bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleSave()
            }}
            disabled={disableSave}
            className="bg-button-primary-bg text-button-primary-text hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Path
          </Button>
        </div>
      </div>
    </div>
  )
}








