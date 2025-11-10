import React, { useState, useRef, useEffect } from "react"
import { ChevronDown, Play, Share2, Plus, Pencil, Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import type { WorkflowStatus } from "../types/workflow"

interface TopBarProps {
  onAddAgent?: () => void
  workflowName?: string
  workflowId?: string
  workflowStatus?: WorkflowStatus
  onPublish?: () => Promise<void> | void
  isPublishing?: boolean
  onNameChange?: (name: string) => Promise<void>
  onTest?: () => void
  isTesting?: boolean
}

export default function TopBar({
  onAddAgent,
  workflowName,
  workflowId,
  workflowStatus,
  onPublish,
  isPublishing = false,
  onNameChange,
  onTest,
  isTesting = false,
}: TopBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayName = workflowName?.trim() ? workflowName : "Untitled Workflow"
  const statusLabel = workflowStatus === "published" ? "Published" : "Draft"
  const statusClass =
    workflowStatus === "published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"

  const canEdit = Boolean(workflowId && onNameChange && !isPublishing)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (!canEdit) return
    setEditValue(workflowName || "")
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!onNameChange || !editValue.trim()) {
      setIsEditing(false)
      return
    }

    if (editValue.trim() === workflowName?.trim()) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onNameChange(editValue.trim())
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to update workflow name", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  return (
    <div className="h-20 bg-background border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 group relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => void handleSave()}
                className="font-semibold text-text-primary bg-background-secondary border border-border rounded px-2 py-1 focus:outline-none focus:border-accent"
                disabled={isSaving}
              />
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />}
            </div>
          ) : (
            <button
              onClick={handleStartEdit}
              disabled={!canEdit}
              className={`flex items-center gap-2 text-text-primary transition-opacity ${
                canEdit ? "hover:opacity-80 cursor-pointer" : "cursor-default"
              }`}
            >
              <span className="font-semibold">{displayName}</span>
              {canEdit && isHovered && <Pencil className="w-3 h-3 text-text-secondary" />}
              {!isEditing && <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusClass}>{statusLabel}</Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={onAddAgent}
          variant="ghost"
          size="sm"
          className="text-text-primary hover:bg-background-secondary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Agent
        </Button>
        <Button
          onClick={() => {
            if (onTest) {
              onTest()
            }
          }}
          variant="ghost"
          size="sm"
          disabled={!onTest || isTesting}
          className="text-text-primary hover:bg-background-secondary disabled:opacity-60"
        >
          {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {isTesting ? "Testing…" : "Test"}
        </Button>
        <Button variant="ghost" size="sm" className="text-text-primary hover:bg-background-secondary">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
        <Button
          disabled={!onPublish || isPublishing}
          size="sm"
          className="bg-button-primary-bg text-button-primary-text hover:opacity-90 border border-text-primary"
          onClick={() => {
            if (onPublish) {
              void onPublish()
            }
          }}
        >
          {isPublishing ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  )
}








