import { useEffect, useState } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Card } from "./ui/card"
import type { Path, PathVariableDataType } from "../types/workflow"

export type VariableDataType = PathVariableDataType

export interface VariableFormValue {
  id: string
  name: string
  description: string
  dataType: VariableDataType
}

export interface PathSheetPayload {
  name: string
  description?: string
  transferMessage?: string
  variables: VariableFormValue[]
  targetAgentId: string
  hideEdge: boolean
}

interface PathSheetProps {
  isOpen: boolean
  mode: "create" | "edit"
  initialPath?: Path | null
  defaultTargetAgentId?: string | null
  agents: { id: string; name: string }[]
  onCancel: () => void
  onSave: (
    payload: PathSheetPayload,
    options: { mode: "create" } | { mode: "edit"; pathId: string }
  ) => Promise<boolean> | boolean
}

export default function PathSheet({
  isOpen,
  mode,
  initialPath,
  defaultTargetAgentId,
  agents,
  onCancel,
  onSave,
}: PathSheetProps) {
  const [pathName, setPathName] = useState("")
  const [description, setDescription] = useState("")
  const [transferMessage, setTransferMessage] = useState("")
  const [variables, setVariables] = useState<VariableFormValue[]>([])
  const [targetAgentId, setTargetAgentId] = useState<string>("")
  const [hideEdge, setHideEdge] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (mode === "edit" && initialPath) {
      setPathName(initialPath.name)
      setDescription(initialPath.description ?? "")
      setTransferMessage(initialPath.transferMessage ?? "")
      setTargetAgentId(initialPath.targetAgentId)
      setHideEdge(Boolean(initialPath.hideEdge))
      setVariables(
        initialPath.variables.map((variable) => ({
          id: variable.id,
          name: variable.name,
          description: variable.description ?? "",
          dataType: (variable.dataType as VariableDataType) ?? "string",
        }))
      )
      return
    }

    // Create mode defaults
    setPathName("")
    setDescription("")
    setTransferMessage("")
    setVariables([])
    setTargetAgentId(defaultTargetAgentId ?? "")
    setHideEdge(false)
  }, [defaultTargetAgentId, initialPath, isOpen, mode])

  const handleAddVariable = () => {
    setVariables((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        name: "",
        description: "",
        dataType: "string",
      },
    ])
  }

  const handleRemoveVariable = (id: string) => {
    setVariables((prev) => prev.filter((variable) => variable.id !== id))
  }

  const handleUpdateVariable = (id: string, field: keyof VariableFormValue, value: string) => {
    setVariables((prev) => prev.map((variable) => (variable.id === id ? { ...variable, [field]: value } : variable)))
  }

  const handleSave = async () => {
    const payload: PathSheetPayload = {
      name: pathName.trim(),
      description,
      transferMessage,
      variables,
      targetAgentId,
      hideEdge,
    }

    const context =
      mode === "edit" && initialPath
        ? ({ mode: "edit", pathId: initialPath.id } as const)
        : ({ mode: "create" } as const)

    const success = await onSave(payload, context)
    if (success && mode === "create") {
      setPathName("")
      setDescription("")
      setTransferMessage("")
      setVariables([])
      setTargetAgentId(defaultTargetAgentId ?? "")
      setHideEdge(false)
    }
  }

  if (!isOpen) {
    return null
  }

  const disableSave = !pathName.trim() || !targetAgentId || variables.some((variable) => !variable.name.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          onCancel()
        }}
      />

      <div className="relative w-full max-w-md bg-background border-l border-border flex flex-col h-full max-h-screen shadow-lg animate-in slide-in-from-right">
        <div className="h-16 border-b border-border flex items-center justify-between px-6">
          <h2 className="font-semibold text-text-primary">
            {mode === "edit" ? "Edit Path" : "Configure Path"}
          </h2>
          <button
            onClick={() => {
              onCancel()
            }}
            className="p-1 hover:bg-background-secondary rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Path Name</label>
            <Input
              value={pathName}
              onChange={(e) => setPathName(e.target.value)}
              placeholder="e.g., Transfer to Billing"
              className="mt-2 bg-background-secondary border-border text-text-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When should this path be used?"
              className="mt-2 bg-background-secondary border-border resize-none text-text-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Transfer Message</label>
            <Textarea
              value={transferMessage}
              onChange={(e) => setTransferMessage(e.target.value)}
              placeholder="What should the agent say when transferring?"
              className="mt-2 bg-background-secondary border-border resize-none text-text-primary"
            />
          </div>

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
                      <select
                        value={variable.dataType}
                        onChange={(e) => handleUpdateVariable(variable.id, "dataType", e.target.value as VariableDataType)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs text-text-primary"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="integer">Integer</option>
                        <option value="boolean">Boolean</option>
                      </select>
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
              {variables.length === 0 && (
                <p className="text-xs text-text-tertiary">Add variables when the destination agent needs extra context; otherwise leave this empty.</p>
              )}
            </div>
          </div>
        </div>

        <div className="h-16 border-t border-border flex items-center justify-end gap-3 px-6">
          <Button
            variant="outline"
            onClick={() => {
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
            {mode === "edit" ? "Save Changes" : "Save Path"}
          </Button>
        </div>
      </div>
    </div>
  )
}
