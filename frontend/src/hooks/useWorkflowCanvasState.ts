import type React from "react"
import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useNodesState, useEdgesState, type Connection, type NodeChange } from "@xyflow/react"
import type { PathSheetPayload } from "@/components/path-sheet"
import { useAsyncAction } from "@/hooks/useAsyncAction"
import { useWorkflowsQuery } from "@/hooks/useWorkflows"
import {
  createAgent as apiCreateAgent,
  createPath as apiCreatePath,
  createTool as apiCreateTool,
  createPathVariable,
  deleteAgent as apiDeleteAgent,
  deletePath as apiDeletePath,
  deleteTool as apiDeleteTool,
  deletePathVariable,
  getWorkflowConfig,
  publishVersion as apiPublishVersion,
  updateAgent as apiUpdateAgent,
  updatePath,
  updatePathVariable,
  updateWorkflow as apiUpdateWorkflow,
  updateWorkflowVersionConfig,
  toolOperationToPayload,
  parseToolResponse,
  updateTool as apiUpdateTool,
} from "@/lib/api"
import type {
  Agent,
  AgentNodeResponse,
  AgentPathResponse,
  AgentToolResponse,
  Path,
  PathVariable,
  PathVariableResponse,
  ToolOperation,
  WorkflowConfigResponse,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSummary,
} from "@/types/workflow"

type PendingEdge = {
  edgeId: string
  sourceId: string
  targetId: string | null
}

type ConnectionDraft = {
  edgeId: string
  sourceId: string
  targetId: string
}

const START_NODE_ID = "start"
const DEFAULT_START_POSITION = { x: 100, y: 100 }

const CANVAS_ERRORS = {
  saveStartPosition: "Failed to save start position",
  saveAgentPosition: "Failed to save agent position",
  updateStartAgent: "Failed to update start agent",
  missingWorkflowForTest: "Select a workflow before testing",
} as const

const EDGE_PREFIX = "edge-"

const buildPathMetadata = (payload: PathSheetPayload): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {}
  const trimmedTransferMessage = payload.transferMessage?.trim()

  if (trimmedTransferMessage) {
    metadata.transferMessage = trimmedTransferMessage
  }

  if (payload.hideEdge) {
    metadata.hideEdge = true
  }

  return metadata
}

const mapPathVariableResponse = (variable: PathVariableResponse): PathVariable => ({
  id: variable.id,
  name: variable.name,
  description: variable.description ?? undefined,
  dataType: variable.data_type as PathVariable["dataType"],
})

const mapPathResponseToPath = (path: AgentPathResponse, variables: PathVariable[]): Path => {
  const metadataRecord =
    path.metadata && typeof path.metadata === "object"
      ? (path.metadata as Record<string, unknown>)
      : undefined

  return {
    id: path.id,
    fromAgentId: path.from_agent_id,
    targetAgentId: path.to_agent_id,
    name: path.name,
    description: path.description ?? undefined,
    guardCondition: path.guard_condition ?? undefined,
    transferMessage: extractTransferMessage(path.metadata ?? undefined),
    variables,
    hideEdge: Boolean(metadataRecord?.hideEdge),
    metadata: path.metadata ?? null,
  }
}

const createStartNode = (position: { x: number; y: number } = DEFAULT_START_POSITION): WorkflowNode => ({
  id: START_NODE_ID,
  type: "start",
  data: { label: "Start" },
  position,
})

const defaultPosition = (index: number): { x: number; y: number } => {
  const columns = 3
  const column = index % columns
  const row = Math.floor(index / columns)
  return {
    x: 200 + column * 260,
    y: 140 + row * 220,
  }
}

const parsePosition = (
  value?: Record<string, unknown> | null,
  fallback: { x: number; y: number } | null = null,
  fallbackIndex = 0,
) => {
  if (value && typeof value === "object" && "x" in value && "y" in value) {
    const x = Number((value as { x: unknown }).x)
    const y = Number((value as { y: unknown }).y)
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      return { x, y }
    }
  }
  if (fallback) {
    return fallback
  }
  return defaultPosition(fallbackIndex)
}

const mapAgentResponse = (agent: AgentNodeResponse, index: number): WorkflowNode => ({
  id: agent.id,
  type: "agent",
  data: {
    name: agent.name,
    instructions: agent.instructions,
    toolCount: 0,
    pathCount: 0,
    llmModel: typeof agent.llm_config === "object" ? (agent.llm_config as Record<string, unknown>).model : undefined,
    isNew: false,
  },
  position: parsePosition(agent.position, null, index),
})

const extractTransferMessage = (metadata?: Record<string, unknown> | null): string | undefined => {
  if (metadata && typeof metadata === "object" && "transferMessage" in metadata) {
    const value = (metadata as { transferMessage?: unknown }).transferMessage
    return typeof value === "string" ? value : undefined
  }
  return undefined
}

export function useWorkflowCanvasState(workflowId?: string) {
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflowsQuery()
  const workflowSummary = useMemo(
    () => workflows.find((workflow) => workflow.id === workflowId) ?? null,
    [workflows, workflowId],
  )
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowSummary | null>(null)
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [canvasLoading, setCanvasLoading] = useState<boolean>(false)
  const [canvasError, setCanvasError] = useState<string | null>(null)
  const { loading: publishing, run: runPublish } = useAsyncAction()
  const { run: runWorkflowMutation } = useAsyncAction()
  const [showTestModal, setShowTestModal] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const isLoadingWorkflow = canvasLoading || (workflowsLoading && !currentWorkflow)

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([createStartNode()])
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [agentPaths, setAgentPaths] = useState<Record<string, Path[]>>({})
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPathSheet, setShowPathSheet] = useState(false)
  const [pathSheetMode, setPathSheetMode] = useState<"create" | "edit">("create")
  const [pathBeingEdited, setPathBeingEdited] = useState<Path | null>(null)
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null)
  const [entryAgentId, setEntryAgentId] = useState<string | null>(null)
  const pendingEdgesRef = useRef<PendingEdge[]>([])

  const updatePendingEdges = useCallback((updater: (prev: PendingEdge[]) => PendingEdge[]) => {
    pendingEdgesRef.current = updater(pendingEdgesRef.current)
  }, [])

  const updateAgentMetadata = useCallback(
    async (
      agentId: string,
      updater: (current: Record<string, unknown>) => Record<string, unknown>,
    ): Promise<boolean> => {
      if (agentId.startsWith("temp-")) {
        setCanvasError("Save the agent before configuring metadata")
        return false
      }

      const node = nodes.find((item) => item.id === agentId)
      if (!node || node.type !== "agent") {
        return false
      }

      const data = node.data as Record<string, unknown>
      const currentMetadataRaw = (data.metadata as Record<string, unknown> | null | undefined) ?? {}
      const nextMetadata = updater({ ...currentMetadataRaw })

      const clean = Object.entries(nextMetadata).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value
        }
        return acc
      }, {})

      const currentClean = Object.entries(currentMetadataRaw).reduce<Record<string, unknown>>(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = value
          }
          return acc
        },
        {},
      )

      const hasChanged = JSON.stringify(currentClean) !== JSON.stringify(clean)
      if (!hasChanged) {
        return true
      }

      try {
        await apiUpdateAgent(agentId, {
          name: data.name as string,
          instructions: data.instructions as string,
          llm_config: data.llmModel ? { provider: "openai", model: data.llmModel as string } : undefined,
          metadata: Object.keys(clean).length ? clean : undefined,
          position: node.position,
        })

        setNodes((prev) =>
          prev.map((item) =>
            item.id === agentId
              ? {
                  ...item,
                  data: {
                    ...item.data,
                    metadata: Object.keys(clean).length ? clean : null,
                  },
                }
              : item,
          ),
        )

        setCanvasError(null)
        return true
      } catch (error) {
        console.error("Failed to update agent metadata", error)
        setCanvasError("Failed to update agent metadata")
        return false
      }
    },
    [nodes, setNodes, setCanvasError],
  )

  const resetCanvas = useCallback(() => {
    setNodes([createStartNode()])
    setEdges([])
    setAgentPaths({})
    setSelectedNodeId(null)
    updatePendingEdges(() => [])
    setConnectionDraft(null)
    setShowPathSheet(false)
    setEntryAgentId(null)
  }, [setNodes, setEdges, updatePendingEdges, setConnectionDraft, setShowPathSheet])

  const selectAgentById = useCallback(
    (nodeId: string) => {
      const node = nodes.find((item) => item.id === nodeId)
      if (!node || node.type !== "agent") {
        setSelectedNodeId(null)
        return
      }
      setSelectedNodeId(node.id)
    },
    [nodes],
  )

  const availableAgentsForPaths = useMemo(() => {
    const agents = nodes.filter((node) => node.type === "agent")
    return agents.map((node) => ({ id: node.id, name: (node.data as Record<string, unknown>).name as string }))
  }, [nodes])

  const candidateAgents = useMemo(
    () => availableAgentsForPaths.filter((agent) => agent.id !== selectedNodeId),
    [availableAgentsForPaths, selectedNodeId],
  )

  const selectedAgent = useMemo<Agent | null>(() => {
    if (!selectedNodeId) {
      return null
    }
    const node = nodes.find((item) => item.id === selectedNodeId && item.type === "agent")
    if (!node) {
      return null
    }
    const data = node.data as Record<string, unknown>
    const paths = agentPaths[selectedNodeId] ?? []

    return {
      id: node.id,
      name: (data.name as string) ?? "",
      instructions: (data.instructions as string) ?? "",
      toolCount: (data.toolCount as number) ?? 0,
      tools: data.tools as ToolOperation[] | undefined,
      toolIds: data.toolIds as string[] | undefined,
      pathCount: paths.length,
      paths,
      model: (data.llmModel as string | undefined) ?? undefined,
      metadata: (data.metadata as Record<string, unknown> | null | undefined) ?? null,
      position: node.position,
      isNew: Boolean(data.isNew),
    }
  }, [agentPaths, nodes, selectedNodeId])

  const transformConfigToCanvas = useCallback((config: WorkflowConfigResponse) => {
    const startPosition = parsePosition(config.start_position ?? null, DEFAULT_START_POSITION)
    const newNodes: WorkflowNode[] = [createStartNode(startPosition)]
    const newEdges: WorkflowEdge[] = []
    const newAgentPaths: Record<string, Path[]> = {}

    let detectedEntryAgentId: string | null = null

    config.agents.forEach((agent, index) => {
      const node = mapAgentResponse(agent, index)
      const toolResponses = (config.tools[agent.id] ?? []) as AgentToolResponse[]
      const parsedTools = toolResponses.map((tool) => parseToolResponse(tool))
      const toolIds = toolResponses.map((tool) => tool.id)
      const paths = config.paths[agent.id] ?? []
      const nodeWithCounts: WorkflowNode = {
        ...node,
        data: {
          ...node.data,
          toolCount: parsedTools.length,
          tools: parsedTools,
          toolIds: toolIds,
          pathCount: paths.length,
          metadata: agent.metadata ?? null,
          position: node.position,
          llmModel:
            agent.llm_config && typeof agent.llm_config === "object"
              ? (agent.llm_config as Record<string, unknown>).model
              : undefined,
        },
      }
      newNodes.push(nodeWithCounts)

      const mappedPaths: Path[] = paths.map((path) => {
        const variables = (config.path_variables[path.id] ?? []).map(mapPathVariableResponse)
        const mapped = mapPathResponseToPath(path, variables)
        if (!mapped.hideEdge) {
          newEdges.push({ id: `${EDGE_PREFIX}${path.id}`, source: path.from_agent_id, target: path.to_agent_id })
        }
        return mapped
      })

      newAgentPaths[agent.id] = mappedPaths

      if (agent.metadata && typeof agent.metadata === "object" && (agent.metadata as Record<string, unknown>).is_entry) {
        detectedEntryAgentId = agent.id
      }
    })

    if (config.agents.length === 0) {
      const tempId = `temp-${Date.now()}`
      newNodes.push({
        id: tempId,
        type: "agent",
        data: {
          name: "New Agent",
          instructions: "",
          toolCount: 0,
          pathCount: 0,
          isNew: true,
        },
        position: defaultPosition(0),
      })
      newAgentPaths[tempId] = []
    }

    if (detectedEntryAgentId) {
      newEdges.push({ id: "start-edge", source: START_NODE_ID, target: detectedEntryAgentId })
    }

    setNodes(newNodes)
    setEdges(newEdges)
    setAgentPaths(newAgentPaths)
    setEntryAgentId(detectedEntryAgentId)
  }, [setNodes, setEdges])

  const loadWorkflowIntoCanvas = useCallback(
    async () => {
      if (!workflowId) {
        setCanvasError("No workflow ID provided")
        return
      }

      if (!workflowSummary) {
        if (!workflowsLoading) {
          setCanvasError("Workflow not found")
          resetCanvas()
        }
        return
      }

      setCanvasLoading(true)
      setCanvasError(null)
      setSelectedNodeId(null)
      updatePendingEdges(() => [])
      setConnectionDraft(null)

      try {
        setCurrentWorkflow(workflowSummary)

        let versionId =
          workflowSummary.latestDraftVersionId ??
          workflowSummary.latestPublishedVersionId ??
          null

        if (!versionId) {
          resetCanvas()
          return
        }

        setCurrentVersionId(versionId)

        const config = await getWorkflowConfig(versionId)
        transformConfigToCanvas(config)
      } catch (error) {
        console.error("Failed to load workflow", error)
        setCanvasError("Failed to load workflow configuration")
        resetCanvas()
      } finally {
        setCanvasLoading(false)
      }
    },
    [workflowId, workflowSummary, workflowsLoading, resetCanvas, transformConfigToCanvas, updatePendingEdges],
  )

  useEffect(() => {
    void loadWorkflowIntoCanvas()
  }, [loadWorkflowIntoCanvas])

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: WorkflowNode) => {
      event.stopPropagation()
      if (node.type !== "agent") return

      selectAgentById(node.id)
    },
    [selectAgentById],
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const handleAddAgent = useCallback(() => {
    const tempId = `temp-${Date.now()}`
    const agentCount = nodes.filter((node) => node.type === "agent").length
    const newNode: WorkflowNode = {
      id: tempId,
      type: "agent",
      data: {
        name: "New Agent",
        instructions: "",
        toolCount: 0,
        pathCount: 0,
        isNew: true,
      },
      position: defaultPosition(agentCount),
    }

    setNodes((prev) => [...prev, newNode])
    setAgentPaths((prev) => ({ ...prev, [tempId]: [] }))
    setSelectedNodeId(tempId)
    setShowEditModal(true)
  }, [nodes, setAgentPaths, setNodes, setSelectedNodeId, setShowEditModal])

  const handleAddPathClick = useCallback(() => {
    if (!selectedNodeId) {
      return
    }
    if (candidateAgents.length === 0) {
      setCanvasError("Add another agent before creating a path")
      return
    }
    if (selectedAgent?.isNew) {
      setCanvasError("Save this agent before creating paths")
      return
    }
    setCanvasError(null)
    setConnectionDraft(null)
    setPathSheetMode("create")
    setPathBeingEdited(null)
    setShowPathSheet(true)
  }, [candidateAgents, selectedAgent, selectedNodeId, setCanvasError, setConnectionDraft, setPathBeingEdited, setPathSheetMode, setShowPathSheet])

  const ensureStartEdge = useCallback(
    (targetId: string | null) => {
      setEdges((prev) => {
        const withoutStart = prev.filter((edge) => edge.source !== START_NODE_ID)
        if (!targetId) {
          return withoutStart
        }
        return [...withoutStart, { id: "start-edge", source: START_NODE_ID, target: targetId }]
      })
    },
    [setEdges],
  )

  const syncAgentTools = useCallback(
    async (
      agentId: string,
      newTools: Array<string | ToolOperation>,
      existingToolIds?: string[],
      existingTools?: Array<string | ToolOperation>,
    ): Promise<{ operations: ToolOperation[]; toolIds: string[] }> => {
      try {
        if (newTools.length > 0 && typeof newTools[0] === "string") {
          console.warn("Skipping tool sync for legacy tool format")
          return { operations: [], toolIds: [] }
        }

        const newToolOps = newTools as ToolOperation[]
        const existingToolOps = (existingTools || []) as ToolOperation[]

        const newOpsMap = new Map<string, ToolOperation>(newToolOps.map((op) => [op.id, op]))
        const idMap = new Map<string, string>()

        if (existingToolIds && existingToolOps.length > 0) {
          for (let i = 0; i < existingToolOps.length; i++) {
            const existingOp = existingToolOps[i]
            const backendId = existingToolIds[i]
            if (!backendId) {
              continue
            }

            if (newOpsMap.has(existingOp.id)) {
              const incoming = newOpsMap.get(existingOp.id)
              if (incoming) {
                await apiUpdateTool(backendId, toolOperationToPayload(incoming))
                idMap.set(incoming.id, backendId)
              }
              newOpsMap.delete(existingOp.id)
            } else {
              await apiDeleteTool(backendId)
            }
          }
        }

        for (const [opId, op] of newOpsMap.entries()) {
          const created = await apiCreateTool(agentId, toolOperationToPayload(op))
          idMap.set(opId, created.id)
        }

        const finalOperations: ToolOperation[] = []
        const finalToolIds: string[] = []

        for (const op of newToolOps) {
          const backendId = idMap.get(op.id)
          if (!backendId) {
            continue
          }
          finalOperations.push({ ...op, id: backendId })
          finalToolIds.push(backendId)
        }

        return { operations: finalOperations, toolIds: finalToolIds }
      } catch (error) {
        console.error("Failed to sync tools", error)
        throw error
      }
    },
    [],
  )

  const handleUpdateAgent = useCallback(
    async (updatedAgent: Agent) => {
      if (!selectedNodeId) return

      const node = nodes.find((item) => item.id === selectedNodeId)
      if (!node) return

      try {
        const payload = {
          name: updatedAgent.name,
          instructions: updatedAgent.instructions,
          llm_config: updatedAgent.model
            ? { provider: "openai", model: updatedAgent.model }
            : undefined,
          metadata: updatedAgent.metadata ?? undefined,
          position: node.position,
        }

        let response: AgentNodeResponse

        if (updatedAgent.isNew) {
          if (!currentVersionId) {
            throw new Error("No draft version available for agent creation")
          }
          response = await apiCreateAgent(currentVersionId, payload)
          const tempId = selectedNodeId

          // Sync tools with backend
          let syncedTools: ToolOperation[] = []
          let syncedToolIds: string[] = []
          if (updatedAgent.tools && updatedAgent.tools.length > 0) {
            const result = await syncAgentTools(response.id, updatedAgent.tools)
            syncedTools = result.operations
            syncedToolIds = result.toolIds
          }

          setNodes((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    id: response.id,
                    data: {
                      ...item.data,
                      name: response.name,
                      instructions: response.instructions,
                      isNew: false,
                      llmModel: updatedAgent.model,
                      toolCount: syncedTools.length,
                      tools: syncedTools,
                      toolIds: syncedToolIds,
                    },
                  }
                : item,
            ),
          )

          setAgentPaths((prev) => {
            const currentPaths = prev[tempId] ?? []
            const next = { ...prev }
            delete next[tempId]
            return { ...next, [response.id]: currentPaths }
          })

          setEdges((prev) =>
            prev.map((edge) => {
              if (edge.source === tempId) {
                return { ...edge, source: response.id }
              }
              if (edge.target === tempId) {
                return { ...edge, target: response.id }
              }
              return edge
            }),
          )

          let readyConnection: PendingEdge | null = null
          updatePendingEdges((prev) => {
            const updated = prev
              .map((edge) => {
                const sourceId = edge.sourceId === tempId ? response.id : edge.sourceId
                const targetId =
                  edge.targetId && edge.targetId === tempId ? response.id : edge.targetId

                const nextEdge: PendingEdge = {
                  edgeId: edge.edgeId,
                  sourceId,
                  targetId,
                }

                if (
                  !readyConnection &&
                  !sourceId.startsWith("temp-") &&
                  targetId &&
                  !targetId.startsWith("temp-")
                ) {
                  readyConnection = nextEdge
                  return null
                }

                return nextEdge
              })
              .filter((edge): edge is PendingEdge => edge !== null)
            return updated
          })

          setSelectedNodeId(response.id)

          if (entryAgentId === tempId) {
            const baseMetadata =
              response.metadata && typeof response.metadata === "object"
                ? { ...(response.metadata as Record<string, unknown>) }
                : {}
            const nextMetadata = { ...baseMetadata, is_entry: true }
            const llmConfigPayload =
              payload.llm_config ??
              (response.llm_config && typeof response.llm_config === "object"
                ? (response.llm_config as Record<string, unknown>)
                : undefined)
            const positionPayload =
              response.position && typeof response.position === "object"
                ? (response.position as Record<string, unknown>)
                : node.position
            try {
              await apiUpdateAgent(response.id, {
                name: response.name,
                instructions: response.instructions,
                llm_config: llmConfigPayload,
                metadata: nextMetadata,
                position: positionPayload,
              })
              setEntryAgentId(response.id)
              ensureStartEdge(response.id)
              setNodes((prev) =>
                prev.map((item) =>
                  item.id === response.id
                    ? {
                        ...item,
                        data: {
                          ...item.data,
                          metadata: nextMetadata,
                        },
                      }
                    : item,
                ),
              )
              setCanvasError(null)
            } catch (error) {
              console.error("Failed to update start agent metadata", error)
              setCanvasError(CANVAS_ERRORS.updateStartAgent)
            }
          }

          if (readyConnection) {
            const resolvedConnection = readyConnection as PendingEdge
            setConnectionDraft({
              edgeId: resolvedConnection.edgeId,
              sourceId: resolvedConnection.sourceId,
              targetId: resolvedConnection.targetId as string,
            })
            selectAgentById(resolvedConnection.sourceId)
            setShowPathSheet(true)
          }
        } else {
          response = await apiUpdateAgent(selectedNodeId, payload)

          // Sync tools with backend
          const existingToolIds = (node.data as Record<string, unknown>).toolIds as string[] | undefined
          const existingTools = (node.data as Record<string, unknown>).tools as Array<string | ToolOperation> | undefined
          const { operations: syncedToolsExisting, toolIds: syncedIdsExisting } = await syncAgentTools(
            selectedNodeId,
            updatedAgent.tools ?? [],
            existingToolIds,
            existingTools,
          )

          setNodes((prev) =>
            prev.map((item) =>
              item.id === selectedNodeId
                ? {
                    ...item,
                    data: {
                      ...item.data,
                      name: response.name,
                      instructions: response.instructions,
                      llmModel: updatedAgent.model,
                      toolCount: syncedToolsExisting.length,
                      tools: syncedToolsExisting,
                      toolIds: syncedIdsExisting,
                    },
                  }
                : item,
            ),
          )

        }
        setCanvasError(null)
        setShowEditModal(false)
      } catch (error) {
        console.error("Failed to save agent", error)
        setCanvasError("Failed to save agent")
      }
    },
    [
      currentVersionId,
      entryAgentId,
      ensureStartEdge,
      nodes,
      selectedNodeId,
      selectAgentById,
      setAgentPaths,
      setCanvasError,
      setConnectionDraft,
      setEdges,
      setNodes,
      updatePendingEdges,
      setEntryAgentId,
      setShowEditModal,
      syncAgentTools,
    ],
  )

  const handleSavePath = useCallback(
    async (pathPayload: PathSheetPayload): Promise<boolean> => {
      const fromAgentId = connectionDraft?.sourceId ?? selectedNodeId
      if (!fromAgentId || fromAgentId.startsWith("temp-")) {
        setCanvasError("Save the agent before adding paths")
        return false
      }

      if (!pathPayload.targetAgentId || pathPayload.targetAgentId.startsWith("temp-")) {
        setCanvasError("Select a saved agent as the target")
        return false
      }

      const trimmedName = pathPayload.name.trim()
      if (!trimmedName) {
        setCanvasError("Provide a path name")
        return false
      }

      try {
        const metadata = buildPathMetadata(pathPayload)
        const descriptionValue = pathPayload.description?.trim()
        const createdPath = await apiCreatePath(fromAgentId, {
          to_agent_id: pathPayload.targetAgentId,
          name: trimmedName,
          description: descriptionValue ? descriptionValue : undefined,
          metadata: Object.keys(metadata).length ? metadata : null,
        })

        const createdVariables: PathVariable[] = []
        for (const variable of pathPayload.variables) {
          const variableName = variable.name.trim()
          const variableDescription = variable.description?.trim() ?? ""
          const response = await createPathVariable(createdPath.id, {
            name: variableName,
            description: variableDescription ? variableDescription : undefined,
            data_type: variable.dataType,
          })
          createdVariables.push(mapPathVariableResponse(response))
        }

        const mappedPath = mapPathResponseToPath(createdPath, createdVariables)
        const edgeId = `${EDGE_PREFIX}${createdPath.id}`

        if (connectionDraft) {
          setEdges((prev) =>
            prev
              .map((edge) => {
                if (edge.id !== connectionDraft.edgeId) {
                  return edge
                }
                if (mappedPath.hideEdge) {
                  return null
                }
                return {
                  id: edgeId,
                  source: createdPath.from_agent_id,
                  target: createdPath.to_agent_id,
                }
              })
              .filter((edge): edge is WorkflowEdge => edge !== null),
          )
          updatePendingEdges((prev) => prev.filter((edge) => edge.edgeId !== connectionDraft.edgeId))
        } else if (!mappedPath.hideEdge) {
          setEdges((prev) => [
            ...prev,
            { id: edgeId, source: createdPath.from_agent_id, target: createdPath.to_agent_id },
          ])
        }

        setAgentPaths((prev) => ({
          ...prev,
          [fromAgentId]: [...(prev[fromAgentId] ?? []), mappedPath],
        }))

        setNodes((prev) =>
          prev.map((node) =>
            node.id === fromAgentId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    pathCount: ((node.data as Record<string, unknown>).pathCount as number) + 1,
                  },
                }
              : node,
          ),
        )

        setCanvasError(null)
        setConnectionDraft(null)
        if (fromAgentId !== START_NODE_ID) {
          selectAgentById(fromAgentId)
        }
        return true
      } catch (error) {
        console.error("Failed to save path", error)
        setCanvasError("Failed to save path")
        if (connectionDraft) {
          setEdges((prev) => prev.filter((edge) => edge.id !== connectionDraft.edgeId))
          updatePendingEdges((prev) => prev.filter((edge) => edge.edgeId !== connectionDraft.edgeId))
          setConnectionDraft(null)
        }
        return false
      }
    },
    [
      connectionDraft,
      selectAgentById,
      selectedNodeId,
      setAgentPaths,
      setCanvasError,
      setConnectionDraft,
      setEdges,
      setNodes,
      updatePendingEdges,
    ],
  )

  const handleUpdatePath = useCallback(
    async (pathId: string, pathPayload: PathSheetPayload): Promise<boolean> => {
      const currentAgentId = selectedNodeId
      if (!currentAgentId) {
        setCanvasError("Select an agent before editing paths")
        return false
      }

      const existingPaths = agentPaths[currentAgentId] ?? []
      const existingPath = existingPaths.find((path) => path.id === pathId)
      if (!existingPath) {
        setCanvasError("Path not found")
        return false
      }

      const trimmedName = pathPayload.name.trim()
      if (!trimmedName) {
        setCanvasError("Provide a path name")
        return false
      }

      if (!pathPayload.targetAgentId || pathPayload.targetAgentId.startsWith("temp-")) {
        setCanvasError("Select a saved agent as the target")
        return false
      }

      const syncVariables = async (): Promise<PathVariable[]> => {
        const previousById = new Map(existingPath.variables.map((variable) => [variable.id, variable]))
        const retainedIds = new Set<string>()
        const nextVariables: PathVariable[] = []

        for (const variable of pathPayload.variables) {
          const variableName = variable.name.trim()
          const variableDescription = variable.description?.trim() ?? ""
          const payload = {
            name: variableName,
            description: variableDescription ? variableDescription : undefined,
            data_type: variable.dataType,
          }

          const previous = variable.id.startsWith("temp-") ? undefined : previousById.get(variable.id)
          if (!previous) {
            const created = await createPathVariable(pathId, payload)
            nextVariables.push(mapPathVariableResponse(created))
            continue
          }

          retainedIds.add(previous.id)
          const previousDescription = previous.description ?? ""
          const hasChanges =
            payload.name !== previous.name ||
            (payload.description ?? "") !== previousDescription ||
            variable.dataType !== previous.dataType

          if (hasChanges) {
            const updated = await updatePathVariable(previous.id, payload)
            nextVariables.push(mapPathVariableResponse(updated))
          } else {
            nextVariables.push(previous)
          }
        }

        for (const previous of existingPath.variables) {
          if (!retainedIds.has(previous.id)) {
            await deletePathVariable(previous.id)
          }
        }

        return nextVariables
      }

      try {
        const metadata = buildPathMetadata(pathPayload)
        const descriptionValue = pathPayload.description?.trim()
        const updatedPath = await updatePath(pathId, {
          to_agent_id: pathPayload.targetAgentId,
          name: trimmedName,
          description: descriptionValue ? descriptionValue : undefined,
          metadata: Object.keys(metadata).length ? metadata : null,
        })

        const syncedVariables = await syncVariables()
        const mappedPath = mapPathResponseToPath(updatedPath, syncedVariables)
        const fromAgentId = existingPath.fromAgentId
        const edgeId = `${EDGE_PREFIX}${pathId}`

        setEdges((prev) => {
          const withoutEdge = prev.filter((edge) => edge.id !== edgeId)
          if (mappedPath.hideEdge) {
            return withoutEdge
          }
          return [
            ...withoutEdge,
            { id: edgeId, source: updatedPath.from_agent_id, target: updatedPath.to_agent_id },
          ]
        })

        setAgentPaths((prev) => ({
          ...prev,
          [fromAgentId]: (prev[fromAgentId] ?? []).map((path) => (path.id === pathId ? mappedPath : path)),
        }))

        setCanvasError(null)
        return true
      } catch (error) {
        console.error("Failed to update path", error)
        setCanvasError("Failed to update path")
        return false
      }
    },
    [agentPaths, selectedNodeId, setAgentPaths, setCanvasError, setEdges],
  )

  const handleDeletePath = useCallback(
    async (pathId: string | number) => {
      if (!selectedNodeId) {
        return
      }
      const id = String(pathId)
      try {
        await apiDeletePath(id)
        setAgentPaths((prev) => ({
          ...prev,
          [selectedNodeId]: (prev[selectedNodeId] ?? []).filter((path) => path.id !== id),
        }))
        setEdges((prev) => prev.filter((edge) => edge.id !== `${EDGE_PREFIX}${id}`))
        setNodes((prev) =>
          prev.map((node) =>
            node.id === selectedNodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    pathCount: Math.max(
                      0,
                      ((node.data as Record<string, unknown>).pathCount as number) - 1,
                    ),
                  },
                }
              : node,
          ),
        )

        if (selectedNodeId) {
          selectAgentById(selectedNodeId)
        }
        setCanvasError(null)
      } catch (error) {
        console.error("Failed to delete path", error)
        setCanvasError("Failed to delete path")
      }
    },
    [selectedNodeId, selectAgentById, setAgentPaths, setCanvasError, setEdges, setNodes],
  )

  const assignEntryAgent = useCallback(
    async (agentId: string) => {
      if (entryAgentId === agentId) {
        ensureStartEdge(agentId)
        setCanvasError(null)
        return
      }

      const previousId = entryAgentId
      ensureStartEdge(agentId)
      setEntryAgentId(agentId)
      setCanvasError(null)

      if (previousId && !previousId.startsWith("temp-") && previousId !== agentId) {
        const removed = await updateAgentMetadata(previousId, (metadata) => {
          const next = { ...metadata }
          delete next.is_entry
          return next
        })
        if (!removed) {
          ensureStartEdge(previousId)
          setEntryAgentId(previousId)
          setCanvasError(CANVAS_ERRORS.updateStartAgent)
          return
        }
      }

      if (agentId.startsWith("temp-")) {
        return
      }

      const added = await updateAgentMetadata(agentId, (metadata) => ({ ...metadata, is_entry: true }))
      if (!added) {
        if (previousId && !previousId.startsWith("temp-")) {
          void updateAgentMetadata(previousId, (metadata) => ({ ...metadata, is_entry: true }))
        }
        ensureStartEdge(previousId ?? null)
        setEntryAgentId(previousId ?? null)
        setCanvasError(CANVAS_ERRORS.updateStartAgent)
      }
    },
    [entryAgentId, ensureStartEdge, setCanvasError, updateAgentMetadata],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }

      const sourceNode = nodes.find((node) => node.id === connection.source)
      if (!sourceNode || !["agent", "start"].includes(sourceNode.type)) {
        return
      }

      if (sourceNode.type === "start") {
        const targetNode = nodes.find((node) => node.id === connection.target)
        if (!targetNode || targetNode.type !== "agent") {
          setCanvasError("Connect Start to a saved agent")
          return
        }
        void assignEntryAgent(targetNode.id)
        return
      }

      const tempEdgeId = `temp-edge-${Date.now()}`

      const targetNode = nodes.find((node) => node.id === connection.target)
      const targetIsAgent = targetNode?.type === "agent"
      const targetId = targetIsAgent ? (targetNode!.id as string) : null

      setEdges((prev) => [
        ...prev,
        { id: tempEdgeId, source: connection.source as string, target: connection.target as string },
      ])

      const sourceIsNew = Boolean((sourceNode.data as Record<string, unknown>)?.isNew)
      const targetIsNew = targetIsAgent
        ? Boolean((targetNode!.data as Record<string, unknown>)?.isNew)
        : false

      if (sourceIsNew || targetIsNew || !targetIsAgent) {
        setCanvasError("Save both agents before configuring this path.")
        updatePendingEdges((prev) => {
          const exists = prev.some((edge) => edge.sourceId === connection.source && edge.targetId === targetId)
          if (exists) {
            return prev
          }
          return [...prev, { edgeId: tempEdgeId, sourceId: connection.source as string, targetId }]
        })
        return
      }

      setConnectionDraft({
        edgeId: tempEdgeId,
        sourceId: connection.source as string,
        targetId: targetId as string,
      })
      setSelectedNodeId(connection.source as string)
      selectAgentById(connection.source as string)
      setPathSheetMode("create")
      setPathBeingEdited(null)
      setShowPathSheet(true)
    },
    [assignEntryAgent, nodes, selectAgentById, setCanvasError, setConnectionDraft, setEdges, setPathBeingEdited, setPathSheetMode, updatePendingEdges, setSelectedNodeId, setShowPathSheet],
  )

  const persistAgentPosition = useCallback(
    async (agentId: string, position: { x: number; y: number }) => {
      if (agentId.startsWith("temp-")) {
        return
      }
      const node = nodes.find((item) => item.id === agentId)
      if (!node || node.type !== "agent") {
        return
      }
      const data = node.data as Record<string, unknown>

      try {
        const metadataValue = data.metadata as Record<string, unknown> | null | undefined
        await apiUpdateAgent(agentId, {
          name: data.name as string,
          instructions: data.instructions as string,
          llm_config: data.llmModel ? { provider: "openai", model: data.llmModel as string } : undefined,
          metadata: metadataValue ? metadataValue : undefined,
          position,
        })
        setCanvasError(null)
      } catch (error) {
        console.error("Failed to persist agent position", error)
        setCanvasError(CANVAS_ERRORS.saveAgentPosition)
      }
    },
    [nodes, setCanvasError],
  )

  const persistStartPosition = useCallback(
    async (position: { x: number; y: number }) => {
      if (!currentVersionId) {
        return
      }

      try {
        await updateWorkflowVersionConfig(currentVersionId, { start_position: position })
        setCanvasError(null)
      } catch (error) {
        console.error("Failed to persist start position", error)
        setCanvasError(CANVAS_ERRORS.saveStartPosition)
      }
    },
    [currentVersionId, setCanvasError],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      onNodesChange(changes)

      const removedIdsSet = new Set<string>()
      for (const change of changes) {
        if (change.type === "remove" && change.id && change.id !== START_NODE_ID) {
          removedIdsSet.add(change.id)
        }
      }

      if (removedIdsSet.size > 0) {
        const removedIds = Array.from(removedIdsSet)
        let updatedAgentPaths: Record<string, Path[]> | null = null
        setAgentPaths((prev) => {
          const next: Record<string, Path[]> = {}
          for (const [agentId, paths] of Object.entries(prev)) {
            if (removedIds.includes(agentId)) {
              continue
            }
            next[agentId] = paths.filter((path) => !removedIds.includes(path.targetAgentId))
          }
          updatedAgentPaths = next
          return next
        })

        if (updatedAgentPaths) {
          const pathMap: Record<string, Path[]> = updatedAgentPaths
          setNodes((prev) =>
            prev.map((node) => {
              if (removedIds.includes(node.id)) {
                return node
              }
              if (node.type === "agent") {
                const pathCount = pathMap[node.id]?.length ?? 0
                return {
                  ...node,
                  data: {
                    ...node.data,
                    pathCount,
                  },
                }
              }
              return node
            }),
          )
        }

        setEdges((prev) =>
          prev.filter((edge) => !removedIds.includes(edge.source) && !removedIds.includes(edge.target)),
        )

        if (
          connectionDraft &&
          (removedIds.includes(connectionDraft.sourceId) || removedIds.includes(connectionDraft.targetId))
        ) {
          setShowPathSheet(false)
        }

        setConnectionDraft((prev) => {
          if (!prev) {
            return prev
          }
          if (removedIds.includes(prev.sourceId) || removedIds.includes(prev.targetId)) {
            return null
          }
          return prev
        })

        updatePendingEdges((prev) =>
          prev.filter(
            (edge) =>
              !removedIds.includes(edge.sourceId) && (!edge.targetId || !removedIds.includes(edge.targetId)),
          ),
        )

        setSelectedNodeId((prev) => (prev && removedIds.includes(prev) ? null : prev))

        if (entryAgentId && removedIds.includes(entryAgentId)) {
          setEntryAgentId(null)
          ensureStartEdge(null)
        }

        removedIds
          .filter((id) => !id.startsWith("temp-"))
          .forEach((id) => {
            void (async () => {
              try {
                await apiDeleteAgent(id)
              } catch (error) {
                console.error("Failed to delete agent", error)
                setCanvasError("Failed to delete agent")
              }
            })()
          })
      }

      for (const change of changes) {
        if (change.type !== "position" || change.dragging !== false || !change.position) {
          continue
        }
        const { x, y } = change.position
        if (change.id === START_NODE_ID) {
          void persistStartPosition({ x, y })
          continue
        }
        if (change.id) {
          void persistAgentPosition(change.id, { x, y })
        }
      }
    },
    [
      connectionDraft,
      ensureStartEdge,
      entryAgentId,
      onNodesChange,
      persistAgentPosition,
      persistStartPosition,
      setAgentPaths,
      setCanvasError,
      setConnectionDraft,
      setEdges,
      setEntryAgentId,
      setNodes,
      updatePendingEdges,
      setSelectedNodeId,
      setShowPathSheet,
    ],
  )

  const handlePublish = useCallback(async () => {
    if (!currentWorkflow || !currentVersionId) {
      setCanvasError("Select a workflow before publishing")
      return
    }

    setCanvasError(null)
    try {
      const published = await runPublish(() => apiPublishVersion(currentVersionId))

      setCurrentWorkflow((prev) =>
        prev
          ? {
              ...prev,
              status: "published",
              latestPublishedVersionId: published.id,
              latestDraftVersionId:
                prev.latestDraftVersionId === published.id ? null : prev.latestDraftVersionId,
            }
          : prev,
      )

      setCanvasError(null)
    } catch (error) {
      console.error("Failed to publish workflow", error)
      setCanvasError("Failed to publish workflow")
    }
  }, [currentVersionId, currentWorkflow, runPublish, setCanvasError])

  const handleWorkflowNameChange = useCallback(
    async (name: string) => {
      if (!currentWorkflow) {
        return
      }

      try {
        const updated = await runWorkflowMutation(() => apiUpdateWorkflow(currentWorkflow.id, { name }))

        setCurrentWorkflow((prev) =>
          prev
            ? {
                ...prev,
                name: updated.name,
                description: updated.description ?? prev.description,
              }
            : prev,
        )

        setCanvasError(null)
      } catch (error) {
        console.error("Failed to update workflow name", error)
        setCanvasError("Failed to update workflow name")
        throw error
      }
    },
    [currentWorkflow, runWorkflowMutation, setCanvasError],
  )

  const handleTestWorkflow = useCallback(() => {
    if (!currentVersionId) {
      setCanvasError(CANVAS_ERRORS.missingWorkflowForTest)
      return
    }

    setCanvasError(null)
    setIsTesting(true)
    setShowTestModal(true)
  }, [currentVersionId, setCanvasError])

  const handleCloseTestModal = useCallback(() => {
    setShowTestModal(false)
    setIsTesting(false)
  }, [])

  const openEditModal = useCallback(() => {
    setShowEditModal(true)
  }, [])

  const closeEditModal = useCallback(() => {
    setShowEditModal(false)
  }, [])

  const openPathSheetForEdit = useCallback((path: Path) => {
    setPathSheetMode("edit")
    setPathBeingEdited(path)
    setShowPathSheet(true)
  }, [])

  const closePathSheet = useCallback(() => {
    setShowPathSheet(false)
    setPathBeingEdited(null)
    setPathSheetMode("create")
    if (connectionDraft) {
      setEdges((prev) => prev.filter((edge) => edge.id !== connectionDraft.edgeId))
      updatePendingEdges((prev) => prev.filter((edge) => edge.edgeId !== connectionDraft.edgeId))
      setConnectionDraft(null)
    }
  }, [connectionDraft, setConnectionDraft, setEdges, updatePendingEdges])

  return {
    workflow: currentWorkflow,
    currentVersionId,
    nodes,
    edges,
    onEdgesChange,
    isLoadingWorkflow,
    canvasError,
    publishing,
    handleAddAgent,
    handleNodeClick,
    handlePaneClick,
    handleConnect,
    handleNodesChange,
    selectedAgent,
    selectedNodeId,
    showEditModal,
    openEditModal,
    closeEditModal,
    handleUpdateAgent,
    handleAddPathClick,
    openPathSheetForEdit,
    closePathSheet,
    showPathSheet,
    pathSheetMode,
    pathBeingEdited,
    candidateAgents,
    pathSheetDefaultTargetId: connectionDraft?.targetId ?? null,
    handleSavePath,
    handleUpdatePath,
    handleDeletePath,
    handlePublish,
    handleWorkflowNameChange,
    handleTestWorkflow,
    handleCloseTestModal,
    showTestModal,
    isTesting,
  }
}
