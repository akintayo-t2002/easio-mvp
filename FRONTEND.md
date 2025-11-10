# Frontend Documentation

**Voice Agent Platform - Frontend Architecture & Developer Guide**

---

## Table of Contents

1. [Introduction & Architecture](#introduction--architecture)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)
4. [Core Pages & Routing](#core-pages--routing)
5. [State Management](#state-management)
6. [Key Components](#key-components)
7. [API Integration](#api-integration)
8. [Type System](#type-system)
9. [Integration System](#integration-system)
10. [Styling & Theming](#styling--theming)
11. [Key Features Implementation](#key-features-implementation)
12. [Testing Infrastructure](#testing-infrastructure)
13. [Development Workflow](#development-workflow)
14. [Common Patterns & Best Practices](#common-patterns--best-practices)
15. [Known Issues & Future Work](#known-issues--future-work)

---

## Introduction & Architecture

### What is This Platform?

The Voice Agent Platform is a **visual workflow builder** that enables non-technical users to create, configure, and deploy intelligent voice agent systems powered by LiveKit. Instead of rigid IVR trees, users design flexible agent networks where each agent is a configurable node with:

- **Instructions**: Natural language behavior definitions
- **Tools**: Actions the agent can perform (Airtable queries, API calls, etc.)
- **Paths**: Transfers to other agents with context preservation
- **LLM Configuration**: Model selection and provider settings

### Frontend Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                        App Router                            │
│                     (BrowserRouter)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
    ┌──▼───┐    ┌─────▼─────┐   ┌────▼────┐
    │ List │    │  Canvas   │   │  Others │
    │ View │    │   View    │   │         │
    └──────┘    └─────┬─────┘   └─────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
    ┌───▼────┐   ┌───▼────┐   ┌───▼────┐
    │ Canvas │   │ Modals │   │ Panels │
    │Section │   │        │   │        │
    └────────┘   └────────┘   └────────┘
```

**Architecture Principles:**
- **Page-based routing** with React Router
- **Section components** for major UI areas (Canvas, Sidebar, Header)
- **Reusable components** for modals, forms, and UI primitives
- **Hooks for logic** (useIntegrationStatus, useTestSession)
- **API layer abstraction** in `lib/api.ts`
- **Type-safe** throughout with TypeScript

---

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx                    # App entry point
│   ├── Router.tsx                  # Route definitions
│   ├── styles.css                  # Global styles + Tailwind
│   │
│   ├── pages/                      # Top-level route components
│   │   ├── WorkflowsPage.tsx       # Main workflow canvas page (1200+ lines)
│   │   ├── IntegrationsPage.tsx    # OAuth integrations management
│   │   └── IntegrationsCallbackPage.tsx # OAuth callback handler
│   │
│   ├── sections/                   # Major UI sections
│   │   ├── WorkflowCanvas.tsx      # XYFlow canvas wrapper
│   │   ├── WorkflowSidebar.tsx     # Left navigation (planned)
│   │   └── SectionHeader.tsx       # Page headers
│   │
│   ├── components/                 # Reusable components
│   │   ├── nodes/                  # XYFlow node wrappers
│   │   │   ├── AgentNodeWrapper.tsx
│   │   │   └── StartNodeWrapper.tsx
│   │   ├── ui/                     # Base UI primitives (Shadcn-style)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   └── accordion.tsx
│   │   ├── test-chat/              # LiveKit testing components
│   │   │   ├── TestChatModal.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── edit-agent-modal.tsx    # Agent configuration modal
│   │   ├── path-sheet.tsx          # Path configuration sheet
│   │   ├── config-panel.tsx        # Right sidebar agent details
│   │   ├── operation-selector-modal.tsx  # Tool selection
│   │   ├── operation-config-panel.tsx    # Tool configuration
│   │   ├── workflow-list.tsx       # Workflow grid view
│   │   ├── sidebar.tsx             # Left navigation
│   │   ├── topbar.tsx              # Canvas toolbar
│   │   └── LoadingSpinner.tsx      # Loading states
│   │
│   ├── lib/                        # Utilities and API
│   │   ├── api.ts                  # Backend API client (500+ lines)
│   │   └── utils.ts                # Helper functions
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useIntegrationStatus.ts # OAuth connection status
│   │   └── useTestSession.ts       # LiveKit session management
│   │
│   ├── config/                     # Configuration files
│   │   └── operations.ts           # Tool/integration registry (335+ lines)
│   │
│   └── types/                      # TypeScript definitions
│       └── workflow.ts             # Domain types
│
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── tailwind.config.js              # Tailwind + theme tokens
├── vite.config.ts                  # Vite bundler config
└── index.html                      # HTML entry point
```

### Directory Purposes

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `pages/` | Route-level components that map to URLs | `WorkflowsPage.tsx` (main UI) |
| `sections/` | Major UI regions used within pages | `WorkflowCanvas.tsx` |
| `components/` | Reusable UI components, modals, forms | 15+ components |
| `components/ui/` | Base primitives (button, input, etc.) | Radix UI wrappers |
| `lib/` | API client, utilities, helpers | `api.ts` (all endpoints) |
| `hooks/` | Custom React hooks for logic reuse | Integration status, testing |
| `config/` | Static configuration and registries | Tool definitions |
| `types/` | TypeScript type definitions | API types, domain models |

---

## Tech Stack

### Core Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.5.4 | Type safety |
| **Vite** | 5.4.8 | Build tool and dev server |
| **React Router** | 7.9.5 | Client-side routing |
| **@xyflow/react** | 12.2.1 | Visual workflow canvas (formerly React Flow) |
| **@tanstack/react-query** | 5.51.9 | Server state management (not fully integrated yet) |
| **Tailwind CSS** | 3.4.13 | Utility-first styling |
| **Radix UI** | Various | Accessible UI primitives |
| **axios** | 1.7.7 | HTTP client (not currently used, fetch preferred) |
| **react-hook-form** | 7.65.0 | Form state management |
| **zod** | 3.23.8 | Schema validation |
| **lucide-react** | 0.546.0 | Icon library |
| **react-icons** | 5.5.0 | Additional icons |
| **livekit-client** | 2.15.13 | LiveKit client SDK |
| **@livekit/components-react** | 2.9.15 | LiveKit UI components |

### Development Dependencies

- **ESLint**: Code linting with TypeScript support
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixes

---

## Core Pages & Routing

### Router Configuration (`Router.tsx`)

```typescript
export function AppRouter() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-canvas-bg">
        <Sidebar />
        <Routes>
          <Route path="/" element={<PlaceholderView title="Dashboard" />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/integrations/callback" element={<IntegrationsCallbackPage />} />
          <Route path="/analytics" element={<PlaceholderView title="Analytics" />} />
          <Route path="/call-logs" element={<PlaceholderView title="Call Logs" />} />
          <Route path="/settings" element={<PlaceholderView title="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

### Pages Overview

#### 1. **WorkflowsPage** (`pages/WorkflowsPage.tsx`)

**Status**: ✅ Fully implemented (1,200+ lines)

The primary interface where users build and manage voice agent workflows.

**Features:**
- Workflow list view with create/select
- Visual canvas with XYFlow for agent nodes
- Agent creation and configuration
- Path creation with variables
- Tool attachment and configuration
- Live testing with LiveKit
- Publishing workflows

**State Management:**
```typescript
// Canvas state (XYFlow)
const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([])
const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([])

// Selection state
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

// Modal state
const [showEditModal, setShowEditModal] = useState(false)
const [showPathSheet, setShowPathSheet] = useState(false)
const [showTestModal, setShowTestModal] = useState(false)

// Connection drafts for unsaved paths
const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null)
const [pendingEdges, setPendingEdges] = useState<PendingEdge[]>([])

// Workflow context
const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowSummary | null>(null)
const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
```

**View Modes:**
- **List View**: Grid of workflow cards with status badges
- **Canvas View**: Visual editor with toolbar, canvas, and config panel

#### 2. **IntegrationsPage** (`pages/IntegrationsPage.tsx`)

**Status**: ✅ Implemented

Manages OAuth connections to external services (currently Airtable).

**Features:**
- Display integration connection status
- Connect/disconnect flows
- OAuth window management
- Connection details (email, scope, connected date)

#### 3. **IntegrationsCallbackPage** (`pages/IntegrationsCallbackPage.tsx`)

**Status**: ✅ Implemented

OAuth callback handler that receives authorization codes and completes the OAuth flow.

**Flow:**
1. Parse URL query params (`code`, `state`)
2. Exchange code for tokens via backend
3. Post message to opener window
4. Redirect back to integrations page

---

## State Management

### Current Strategy: Local React State

The application currently uses React's built-in state management:

**1. XYFlow State (Canvas)**
```typescript
// Nodes and edges managed by XYFlow hooks
const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([])
const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([])
```

**2. UI State (Modals, Panels)**
```typescript
const [showEditModal, setShowEditModal] = useState(false)
const [showPathSheet, setShowPathSheet] = useState(false)
const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
```

**3. API State (Manual)**
```typescript
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

### Future: TanStack Query Migration

TanStack Query is installed but not yet integrated. Future refactoring will use:

```typescript
// Workflows query
const { data: workflows, isLoading, error } = useQuery({
  queryKey: ['workflows', orgId],
  queryFn: () => fetchWorkflows(),
})

// Workflow config query
const { data: config } = useQuery({
  queryKey: ['workflow-config', versionId],
  queryFn: () => getWorkflowConfig(versionId),
})

// Mutations
const createAgentMutation = useMutation({
  mutationFn: (payload) => createAgent(versionId, payload),
  onSuccess: () => queryClient.invalidateQueries(['workflow-config']),
})
```

### State Synchronization Pattern

**Canvas ↔ Backend Synchronization:**

1. **Optimistic UI Update** → Update local state immediately
2. **API Call** → Persist to backend
3. **Handle Response** → Update with server data (UUIDs, timestamps)
4. **Error Recovery** → Revert on failure

Example: Creating an agent
```typescript
// 1. Add temp node to canvas
setNodes(prev => [...prev, { id: `temp-${Date.now()}`, ...data }])

// 2. Save to backend
const response = await createAgent(versionId, payload)

// 3. Replace temp ID with real UUID
setNodes(prev => prev.map(node => 
  node.id === tempId ? { ...node, id: response.id } : node
))
```

---

## Key Components

### Visual Canvas Components

#### **WorkflowCanvas** (`sections/WorkflowCanvas.tsx`)

XYFlow wrapper that renders the visual workflow editor.

```typescript
interface WorkflowCanvasProps {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onNodeClick: (event: React.MouseEvent, node: WorkflowNode) => void
  onPaneClick: () => void
  onConnect: (connection: Connection) => void
}
```

**Features:**
- Background grid pattern
- Minimap for navigation
- Zoom/pan controls
- Drag-and-drop node positioning
- Edge creation via handles

**Node Types:**
- `start` → StartNodeWrapper (entry point indicator)
- `agent` → AgentNodeWrapper (configurable agent node)

#### **AgentNodeWrapper** (`components/nodes/AgentNodeWrapper.tsx`)

Visual representation of an agent on the canvas.

**Display:**
- Agent name
- LLM model badge
- Tool count
- Path count
- Hover highlight

**Interactions:**
- Click to select (opens ConfigPanel)
- Drag to reposition (persists to backend)
- Delete key removes node

#### **StartNodeWrapper** (`components/nodes/StartNodeWrapper.tsx`)

Special node representing the workflow entry point. Connected to the entry agent.

---

### Modal Components

#### **EditAgentModal** (`components/edit-agent-modal.tsx`)

**Status**: ✅ Fully implemented (485 lines)

Full-screen modal for configuring agent properties.

**Tabs:**
1. **Instructions** - Name, instructions, model selection
2. **Tools** - Attach integrations and configure operations

**Instructions Tab:**
- Agent name input
- Multi-line instructions textarea
- LLM model dropdown (GPT-4o, GPT-4o-mini, etc.)
- Template prompt suggestions

**Tools Tab:**
- Integration card grid (Airtable, etc.)
- Connection status indicators
- OAuth connect/disconnect
- Add operation button → OperationSelectorModal
- Tool list with edit/delete actions

**State:**
```typescript
const [agentName, setAgentName] = useState(agent.name)
const [instructions, setInstructions] = useState(agent.instructions)
const [model, setModel] = useState(agent.model)
const [tools, setTools] = useState<ToolOperation[]>(agent.tools || [])
```

**Save Flow:**
1. Validate inputs
2. If new agent (temp ID) → `createAgent()`
3. If existing → `updateAgent()`
4. Sync tools (create/update/delete operations)
5. Close modal and refresh canvas

#### **PathSheet** (`components/path-sheet.tsx`)

**Status**: ✅ Implemented

Slide-out sheet for configuring transfer paths between agents.

**Fields:**
- **Name**: Path identifier (e.g., "To Billing Agent")
- **Description**: When to use this path
- **Target Agent**: Dropdown of available agents
- **Transfer Message**: Optional message before transfer
- **Hide Edge**: Don't show visual connection on canvas
- **Variables**: Collect context before transfer
  - Variable name
  - Description (for LLM)
  - Required checkbox

**Use Cases:**
1. **Connection Draft**: User draws edge on canvas → Sheet opens
2. **Add Path Button**: User clicks "Add Path" in ConfigPanel

**Save Logic:**
```typescript
const handleSavePath = async (payload: PathSheetPayload) => {
  // 1. Validate source and target agents are saved
  // 2. Create path via API
  const createdPath = await apiCreatePath(fromAgentId, {...})
  
  // 3. Create path variables
  for (const variable of payload.variables) {
    await createPathVariable(createdPath.id, {...})
  }
  
  // 4. Update canvas edges (unless hideEdge is true)
  // 5. Update agent path count
  // 6. Close sheet
}
```

#### **OperationSelectorModal** (`components/operation-selector-modal.tsx`)

**Status**: ✅ Implemented

Modal for selecting a specific operation from an integration.

**Flow:**
```
EditAgentModal (Tools tab) 
  → Click "Add Operation" on integration card
  → OperationSelectorModal opens
  → User selects operation
  → OperationConfigPanel opens
```

**Display:**
- Integration icon and name
- Operation cards with descriptions
- Back button to close

#### **OperationConfigPanel** (`components/operation-config-panel.tsx`)

**Status**: ✅ Implemented (368 lines)

Modal for configuring a tool operation.

**Sections:**

1. **LLM Description**
   - Natural language description for function calling
   - Pre-filled with defaults, user can customize

2. **Configuration Fields** (static, defined at setup time)
   - Example: Airtable base ID, table ID, field name
   - Specific to each operation type

3. **Runtime Parameters** (collected during conversation)
   - Parameters the LLM needs to collect from the user
   - Example: Search value, email address, order ID
   - Each parameter has:
     - Name
     - LLM description (how to collect it)
     - Required checkbox
     - Data type

**Special Case: Airtable Find Record**
Always enforces a `searchValue` parameter as the first runtime parameter.

**Save Logic:**
```typescript
const handleSave = () => {
  const toolOperation: ToolOperation = {
    id: existingConfig?.id || `temp-${Date.now()}`,
    integrationId: integration.id,
    operationId: operation.id,
    operationName: operation.name,
    llmDescription,
    config: configValues,
    runtimeParameters,
  }
  onSave(toolOperation)
}
```

---

### Panel Components

#### **ConfigPanel** (`components/config-panel.tsx`)

**Status**: ✅ Implemented

Right sidebar that appears when an agent is selected on the canvas.

**Sections:**
1. **Header**: Agent name, close button
2. **Instructions**: Read-only preview with edit button
3. **Tools**: List of configured tools with counts
4. **Paths**: List of outgoing paths with delete buttons

**Actions:**
- **Edit Agent** → Opens EditAgentModal
- **Add Path** → Opens PathSheet
- **Delete Path** → Confirms and removes path

#### **TopBar** (`components/topbar.tsx`)

**Status**: ✅ Implemented

Canvas toolbar with workflow actions.

**Left Side:**
- Editable workflow name (click to rename)
- Status badge (draft/published)

**Right Side:**
- **+ Add Agent** button
- **Test** button → Opens TestChatModal
- **Publish** button → Publishes draft version

**Publishing Logic:**
```typescript
const handlePublish = async () => {
  const published = await apiPublishVersion(currentVersionId)
  // Update workflow status to "published"
  // Refresh workflow list
}
```

---

### Testing Components

#### **TestChatModal** (`components/test-chat/TestChatModal.tsx`)

**Status**: ✅ Implemented

LiveKit-powered testing interface for voice and text interactions.

**Features:**
- Mode selection: Voice or Text
- LiveKit room connection
- Real-time transcription display
- Chat message history
- Voice activity indicator
- Agent status display

**Connection Flow:**
```typescript
// 1. Create test session
const session = await createTestSession(versionId)

// 2. Connect to LiveKit room
const room = new Room()
await room.connect(session.room_url, session.token)

// 3. Start agent dispatch
// (LiveKit worker receives room join event and loads workflow)

// 4. Enable microphone for voice mode
await room.localParticipant.setMicrophoneEnabled(true)
```

#### **ChatPanel** (`components/test-chat/ChatPanel.tsx`)

Message display area within TestChatModal.

**Message Types:**
- User messages (right-aligned, blue)
- Agent messages (left-aligned, gray)
- System messages (center, muted)
- Typing indicators

---

## API Integration

### API Client (`lib/api.ts`)

Centralized API layer with typed request/response functions.

**Configuration:**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"
const ORGANIZATION_ID = import.meta.env.VITE_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000000"
```

**Base Request Function:**
```typescript
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Organization-ID": ORGANIZATION_ID,
      ...options.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }
  
  return response.json()
}
```

### API Functions

#### Workflows
```typescript
fetchWorkflows() → WorkflowSummaryResponse[]
createWorkflow(payload) → WorkflowWithVersionResponse
updateWorkflow(workflowId, payload) → WorkflowResponse
getWorkflowConfig(versionId) → WorkflowConfigResponse
publishVersion(versionId) → WorkflowVersionResponse
```

#### Agents
```typescript
createAgent(versionId, payload) → AgentNodeResponse
updateAgent(agentId, payload) → AgentNodeResponse
deleteAgent(agentId) → void
```

#### Tools
```typescript
createTool(agentId, payload) → AgentToolResponse
updateTool(toolId, payload) → AgentToolResponse
deleteTool(toolId) → void
```

#### Paths
```typescript
createPath(agentId, payload) → AgentPathResponse
deletePath(pathId) → void
createPathVariable(pathId, payload) → PathVariableResponse
```

#### Testing
```typescript
createTestSession(versionId) → WorkflowTestSessionResponse
```

#### Integrations
```typescript
fetchIntegrationStatus(integrationId) → ConnectionStatusResponse
disconnectIntegration(integrationId) → void
```

### Type Transformations

**Backend → Frontend:**
```typescript
// Parse tool response from backend format
export function parseToolResponse(apiTool: AgentToolResponse): ToolOperation {
  const config = apiTool.config || {}
  const [integrationId, operationId] = apiTool.tool_type.split(".", 2)
  
  return {
    id: apiTool.id,
    integrationId,
    operationId,
    operationName: apiTool.display_name || operationId,
    llmDescription: config.llmDescription || "",
    config: { ...config, llmDescription: undefined, runtimeParameters: undefined },
    runtimeParameters: config.runtimeParameters || [],
  }
}
```

**Frontend → Backend:**
```typescript
// Convert tool operation to API payload
export function toolOperationToPayload(toolOp: ToolOperation): ToolPayload {
  return {
    tool_type: `${toolOp.integrationId}.${toolOp.operationId}`,
    display_name: toolOp.operationName,
    config: {
      ...toolOp.config,
      llmDescription: toolOp.llmDescription,
      runtimeParameters: toolOp.runtimeParameters,
    },
  }
}
```

---

## Type System

### Core Types (`types/workflow.ts`)

#### Workflow Types
```typescript
export interface WorkflowSummary {
  id: string
  name: string
  description?: string | null
  status: WorkflowStatus  // "draft" | "published"
  updatedAt: string
  latestPublishedVersionId?: string | null
  latestDraftVersionId?: string | null
  organizationId: string
}

export interface WorkflowVersionResponse {
  id: string
  workflow_id: string
  version: number
  status: WorkflowStatus
  published_at?: string | null
  config: Record<string, unknown>
  created_at: string
}
```

#### Agent Types
```typescript
export interface Agent {
  id: string
  name: string
  instructions: string
  toolCount: number
  pathCount: number
  paths?: Path[]
  model?: string
  tools?: ToolOperation[]
  toolIds?: string[]  // Backend UUIDs for tools
  metadata?: Record<string, unknown> | null
  position?: { x: number; y: number } | null
  isNew?: boolean  // Temp node not yet saved
}

export interface AgentNodeResponse {
  id: string
  workflow_version_id: string
  name: string
  instructions: string
  stt_config?: Record<string, unknown> | null
  llm_config?: Record<string, unknown> | null
  tts_config?: Record<string, unknown> | null
  vad_config?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  position?: Record<string, unknown> | null
  created_at: string
}
```

#### Tool Types
```typescript
export interface ToolOperation {
  id: string  // Frontend temp ID or backend UUID
  integrationId: string  // "airtable"
  operationId: string  // "list_records"
  operationName: string  // Display name
  llmDescription: string  // Function calling description
  config: ToolConfiguration  // Static config (base ID, table ID, etc.)
  runtimeParameters: RuntimeParameter[]  // Collected at runtime
}

export interface RuntimeParameter {
  name: string
  llmDescription: string  // How to collect from user
  required: boolean
  dataType: string  // "string" | "number" | "boolean"
}

export type ToolConfiguration = Record<string, unknown>
```

#### Path Types
```typescript
export interface Path {
  id: string
  fromAgentId: string
  targetAgentId: string
  name: string
  description?: string | null
  guardCondition?: string | null  // Not yet used
  transferMessage?: string  // Message before transfer
  variables: PathVariable[]
  hideEdge?: boolean  // Don't show visual connection
}

export interface PathVariable {
  id: string
  name: string
  description?: string | null
  required: boolean
  dataType: string
}
```

#### Canvas Types
```typescript
export interface WorkflowNode {
  id: string
  type: "start" | "agent"
  data: Record<string, unknown>  // Varies by type
  position: { x: number; y: number }
}

export interface WorkflowEdge {
  id: string
  source: string  // Source node ID
  target: string  // Target node ID
}
```

---

## Integration System

### Tool Registry (`config/operations.ts`)

Defines all available integrations and their operations.

**Structure:**
```typescript
export interface IntegrationDefinition {
  id: string
  name: string
  icon: IconType  // React icon component
  color: string  // Tailwind color class
  operations: OperationDefinition[]
}

export interface OperationDefinition {
  id: string
  name: string
  description: string
  defaultLlmDescription: string
  configFields: ConfigField[]  // Static setup fields
  defaultRuntimeParameters: RuntimeParameter[]  // Dynamic collection
}
```

**Example: Airtable Integration**
```typescript
export const INTEGRATIONS = {
  airtable: {
    id: "airtable",
    name: "Airtable",
    icon: FaDatabase,
    color: "text-[#FCB400]",
    operations: [
      {
        id: "list_records",
        name: "List Records",
        description: "Get all records from a table",
        defaultLlmDescription: "Use this to retrieve all records from an Airtable table.",
        configFields: [
          { name: "baseId", label: "Base ID", placeholder: "app...", required: true },
          { name: "tableId", label: "Table ID", placeholder: "tbl...", required: true },
        ],
        defaultRuntimeParameters: [
          { name: "maxRecords", llmDescription: "Maximum records to return", required: false, dataType: "number" },
        ],
      },
      {
        id: "find_record_by_field",
        name: "Find Record by Field",
        // ... similar structure
      },
    ],
  },
}
```

### OAuth Flow

**Airtable OAuth Example:**

1. **Initiate Connection** (IntegrationsPage or EditAgentModal)
```typescript
const handleConnect = () => {
  const { authorizeUrl } = buildIntegrationAuthorizeUrls("airtable")
  const popup = window.open(authorizeUrl, "OAuth", "width=600,height=700")
  oauthWindowRef.current = popup
  setIsConnecting(true)
}
```

2. **OAuth Redirect** → Backend exchanges code for tokens

3. **Callback** (IntegrationsCallbackPage)
```typescript
// Parse query params
const code = searchParams.get("code")
const state = searchParams.get("state")

// Backend endpoint: POST /api/integrations/airtable/callback
// Exchanges code → access token, stores in Supabase Vault

// Post message to opener
window.opener.postMessage({
  type: "airtable_oauth_complete",
  provider: "airtable",
  success: true,
}, window.location.origin)
```

4. **Receive Message** (Opener window)
```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === "airtable_oauth_complete" && event.data.success) {
      // Refresh integration status
      airtableStatus.refresh()
      setConnectError(null)
    }
  }
  window.addEventListener("message", handleMessage)
  return () => window.removeEventListener("message", handleMessage)
}, [])
```

### Integration Status Hook

**useIntegrationStatus** (`hooks/useIntegrationStatus.ts`)

Polls integration connection status.

```typescript
export function useIntegrationStatus(integrationId: string) {
  const [status, setStatus] = useState<ConnectionStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  
  const refresh = useCallback(async () => {
    const data = await fetchIntegrationStatus(integrationId)
    setStatus(data)
    setLoading(false)
  }, [integrationId])
  
  useEffect(() => {
    refresh()
  }, [refresh])
  
  return { status, loading, refresh }
}
```

---

## Styling & Theming

### Tailwind Configuration

**File:** `tailwind.config.js`

**Color System:**

```javascript
colors: {
  // Shadcn HSL tokens
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
  accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
  
  // Custom hex tokens
  success: "var(--color-success, #10b981)",
  warning: "var(--color-warning, #f59e0b)",
  error: "var(--color-error, #ef4444)",
  "canvas-bg": "var(--color-canvas-bg)",
  "text-secondary": "var(--color-text-secondary)",
}
```

### CSS Variables (`styles.css`)

**Light Mode (default):**
```css
:root {
  /* Shadcn HSL values */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --accent: 221 83% 53%;  /* Blue */
  
  /* Custom hex values */
  --color-canvas-bg: #fafafa;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-success: #10b981;
  --color-error: #ef4444;
}
```

**Dark Mode:**
```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --accent: 221 83% 53%;
  
  --color-canvas-bg: #111827;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
}
```

### Common Utility Classes

| Class | Purpose |
|-------|---------|
| `bg-canvas-bg` | Canvas background (#fafafa) |
| `bg-card` | Card background (white) |
| `bg-accent` | Primary blue accent |
| `text-text-secondary` | Muted text color |
| `border-border` | Standard border color |
| `text-error` | Error text (red) |
| `text-success` | Success text (green) |

### Component Styling Patterns

**Button Variants:**
```typescript
// Primary button (dark background, white text)
<Button className="bg-button-primary-bg text-button-primary-text">

// Outline button
<Button variant="outline">

// Ghost button
<Button variant="ghost">
```

**Card Pattern:**
```tsx
<div className="bg-card border border-border rounded-lg p-4 hover:shadow-md">
  {/* Content */}
</div>
```

---

## Key Features Implementation

### 1. Workflow Management

#### Creating a Workflow

**Flow:**
```
User clicks "New Workflow" 
  → POST /api/workflows { name, description }
  → Creates workflow + initial draft version
  → Loads canvas view with empty state
```

**Code:**
```typescript
const handleCreateWorkflow = async () => {
  setCreatingWorkflow(true)
  const created = await createWorkflow({ 
    name: "New Workflow", 
    description: "Untitled workflow" 
  })
  
  const summary: WorkflowSummary = {
    id: created.workflow.id,
    name: created.workflow.name,
    status: created.version.status,
    latestDraftVersionId: created.version.id,
    // ...
  }
  
  await loadWorkflowIntoCanvas(summary, created.version.id)
}
```

#### Loading a Workflow

**Flow:**
```
Select workflow from list
  → GET /api/workflow-versions/{versionId}/config
  → Transform backend data to canvas nodes/edges
  → Render on XYFlow canvas
```

**Transformation:**
```typescript
const transformConfigToCanvas = (config: WorkflowConfigResponse) => {
  const newNodes: WorkflowNode[] = [createStartNode(config.start_position)]
  const newEdges: WorkflowEdge[] = []
  const newAgentPaths: Record<string, Path[]> = {}
  
  config.agents.forEach((agent, index) => {
    // Create node
    const node = mapAgentResponse(agent, index)
    newNodes.push(node)
    
    // Map tools
    const tools = (config.tools[agent.id] || []).map(parseToolResponse)
    
    // Map paths
    const paths = (config.paths[agent.id] || []).map(path => ({
      id: path.id,
      fromAgentId: path.from_agent_id,
      targetAgentId: path.to_agent_id,
      // ... map variables
    }))
    
    newAgentPaths[agent.id] = paths
    
    // Create edges for visible paths
    paths.forEach(path => {
      if (!path.hideEdge) {
        newEdges.push({ id: `edge-${path.id}`, source: path.fromAgentId, target: path.targetAgentId })
      }
    })
  })
  
  setNodes(newNodes)
  setEdges(newEdges)
  setAgentPaths(newAgentPaths)
}
```

#### Publishing a Workflow

**Flow:**
```
User clicks "Publish"
  → POST /api/workflow-versions/{versionId}/publish
  → Changes status from "draft" to "published"
  → Updates workflow list
```

**Code:**
```typescript
const handlePublish = async () => {
  setPublishing(true)
  const published = await apiPublishVersion(currentVersionId)
  
  setCurrentWorkflow(prev => ({
    ...prev,
    status: "published",
    latestPublishedVersionId: published.id,
  }))
  
  await loadWorkflows()  // Refresh list
}
```

---

### 2. Agent Configuration

#### Creating an Agent

**User Flow:**
1. Click "+ Add Agent" in toolbar
2. Temp node appears on canvas with `isNew: true`
3. EditAgentModal opens automatically
4. User fills name, instructions, model
5. User adds tools (optional)
6. Click "Save"
7. API creates agent → Returns UUID
8. Replace temp ID with UUID
9. Update all edges referencing temp ID

**Key Challenge: Temporary IDs**

Temp nodes use `temp-${timestamp}` IDs until saved. Must track and replace:

```typescript
// Create temp node
const tempId = `temp-${Date.now()}`
setNodes(prev => [...prev, { id: tempId, type: "agent", data: {...}, position }])

// Save to backend
const response = await apiCreateAgent(versionId, payload)

// Replace temp ID everywhere
setNodes(prev => prev.map(node => 
  node.id === tempId ? { ...node, id: response.id } : node
))

setEdges(prev => prev.map(edge => ({
  ...edge,
  source: edge.source === tempId ? response.id : edge.source,
  target: edge.target === tempId ? response.id : edge.target,
})))

setAgentPaths(prev => {
  const paths = prev[tempId] || []
  const next = { ...prev }
  delete next[tempId]
  next[response.id] = paths
  return next
})
```

#### Entry Agent Management

**Concept:** The entry agent is the first agent activated when a call starts. Visually, it's connected to the "Start" node.

**Implementation:**
- Entry agent has `metadata.is_entry = true`
- Start node connects to entry agent with a special edge
- Only one entry agent allowed per workflow

**Setting Entry Agent:**
```typescript
const assignEntryAgent = async (agentId: string) => {
  // 1. Update edge from start node
  ensureStartEdge(agentId)
  
  // 2. Remove is_entry from previous entry agent
  if (previousEntryAgentId) {
    await updateAgentMetadata(previousEntryAgentId, metadata => {
      delete metadata.is_entry
      return metadata
    })
  }
  
  // 3. Set is_entry on new entry agent
  await updateAgentMetadata(agentId, metadata => ({
    ...metadata,
    is_entry: true,
  }))
  
  setEntryAgentId(agentId)
}
```

**How it's triggered:**
- User drags connection from Start node to agent
- `onConnect` handler detects source === "start"
- Calls `assignEntryAgent(targetAgentId)`

#### Agent Position Persistence

**Flow:**
```
User drags node on canvas
  → onNodesChange fires with position change
  → When dragging === false (drop complete)
  → PUT /api/agents/{agentId} with new position
```

**Code:**
```typescript
const handleNodesChange = (changes: NodeChange[]) => {
  onNodesChange(changes)  // Update XYFlow state
  
  // Persist positions when drag ends
  changes
    .filter(change => change.type === "position" && change.dragging === false)
    .forEach(change => {
      if (change.id === "start") {
        persistStartPosition(change.position)
      } else {
        persistAgentPosition(change.id, change.position)
      }
    })
}
```

---

### 3. Tool System

#### Tool Attachment Flow

**User Journey:**
1. Open EditAgentModal → Tools tab
2. Click integration card (e.g., Airtable)
3. If not connected → OAuth flow
4. If connected → OperationSelectorModal opens
5. Select operation (e.g., "Find Record by Field")
6. OperationConfigPanel opens
7. Fill config fields (base ID, table ID, field name)
8. Customize LLM description
9. Configure runtime parameters
10. Save → Tool added to agent

**Tool Sync Algorithm:**

When saving an agent with tools, the frontend performs a diff:

```typescript
const syncAgentTools = async (
  agentId: string,
  newTools: ToolOperation[],
  existingToolIds?: string[],
  existingTools?: ToolOperation[],
) => {
  const newOpsMap = new Map(newTools.map(op => [op.id, op]))
  const idMap = new Map<string, string>()  // Frontend ID → Backend UUID
  
  // 1. Update or delete existing tools
  for (let i = 0; i < existingTools.length; i++) {
    const existingOp = existingTools[i]
    const backendId = existingToolIds[i]
    
    if (newOpsMap.has(existingOp.id)) {
      // Tool still exists → UPDATE
      const incoming = newOpsMap.get(existingOp.id)
      await apiUpdateTool(backendId, toolOperationToPayload(incoming))
      idMap.set(incoming.id, backendId)
      newOpsMap.delete(existingOp.id)
    } else {
      // Tool removed → DELETE
      await apiDeleteTool(backendId)
    }
  }
  
  // 2. Create new tools
  for (const [opId, op] of newOpsMap.entries()) {
    const created = await apiCreateTool(agentId, toolOperationToPayload(op))
    idMap.set(opId, created.id)
  }
  
  // 3. Return final tool list with backend UUIDs
  return {
    operations: newTools.map(op => ({ ...op, id: idMap.get(op.id)! })),
    toolIds: newTools.map(op => idMap.get(op.id)!),
  }
}
```

**Why this complexity?**
- Frontend uses temp IDs for new tools before save
- Backend needs UUIDs for updates/deletes
- Must maintain order and prevent duplicates

---

### 4. Path System

#### Path Creation Flow

**Method 1: Draw Connection on Canvas**
```
User drags from agent handle to another agent
  → onConnect fires
  → If source or target is unsaved (temp ID) → Add to pendingEdges
  → If both saved → Create connectionDraft and open PathSheet
  → User fills path details
  → Save → API creates path and path variables
```

**Method 2: Add Path Button**
```
User clicks "Add Path" in ConfigPanel
  → PathSheet opens with no target pre-selected
  → User selects target agent from dropdown
  → Fill path details
  → Save → API creates path
```

**Pending Edges Pattern:**

Problem: User draws edge before saving agents.

Solution: Store in `pendingEdges` state, resolve when agents are saved.

```typescript
type PendingEdge = {
  edgeId: string
  sourceId: string  // Might be temp ID
  targetId: string | null  // Might be temp ID or null
}

// When creating a new agent
const response = await apiCreateAgent(versionId, payload)

// Update pending edges
setPendingEdges(prev => {
  return prev.map(edge => {
    const sourceId = edge.sourceId === tempId ? response.id : edge.sourceId
    const targetId = edge.targetId === tempId ? response.id : edge.targetId
    
    // If both are now saved, promote to connectionDraft
    if (!sourceId.startsWith("temp-") && targetId && !targetId.startsWith("temp-")) {
      setConnectionDraft({ edgeId: edge.edgeId, sourceId, targetId })
      setShowPathSheet(true)
      return null  // Remove from pending
    }
    
    return { edgeId: edge.edgeId, sourceId, targetId }
  }).filter(Boolean)
})
```

#### Path Variables

Variables define context that must be collected before transferring.

**Example:**
```
Agent A (Sales) → Agent B (Support)
Required Variables:
  - customer_id (required)
  - order_id (optional)
```

During conversation, Agent A must collect these before calling the transfer tool.

**Backend Representation:**
```sql
CREATE TABLE path_variable (
  id UUID PRIMARY KEY,
  path_id UUID REFERENCES agent_path(id),
  name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT TRUE,
  data_type TEXT DEFAULT 'string'
);
```

**Frontend UI:**
In PathSheet, user clicks "+ Add Variable" and fills:
- Variable name
- Description (tells LLM what to collect)
- Required checkbox

**Runtime Behavior:**
The backend generates transfer tools with parameters for required variables. The LLM must call the tool with those parameters before transfer succeeds.

---

### 5. Testing Infrastructure

#### Test Session Creation

**Flow:**
```
User clicks "Test" button
  → POST /api/workflow-versions/{versionId}/test-session
  → Backend creates LiveKit room with RoomAgentDispatch config
  → Returns: room_url, room_name, token, participant_identity
  → Frontend connects to room via LiveKit SDK
  → Worker (backend.worker.py) joins room and loads workflow
  → User can speak or type to test agents
```

**LiveKit Integration:**

```typescript
const handleTest = async () => {
  // 1. Create test session
  const session = await createTestSession(currentVersionId)
  
  // 2. Connect to room
  const room = new Room()
  await room.connect(session.room_url, session.token)
  
  // 3. Enable microphone for voice mode
  if (mode === "voice") {
    await room.localParticipant.setMicrophoneEnabled(true)
  }
  
  // 4. Listen for transcriptions and agent responses
  room.on("transcription_received", (transcription) => {
    // Display in chat panel
  })
  
  // 5. Send text messages (text mode)
  if (mode === "text") {
    room.localParticipant.publishData(JSON.stringify({ text: message }))
  }
}
```

**Worker Dispatch:**

Backend worker receives room connection and:
1. Extracts workflow_id from room metadata
2. Loads workflow configuration from Supabase
3. Instantiates all agents defined in workflow
4. Starts session with entry agent
5. Handles transfers via function tools

---

## Development Workflow

### Setup

1. **Install Dependencies:**
```bash
cd frontend
npm install
```

2. **Environment Variables:**
Create `frontend/.env.local`:
```bash
VITE_API_BASE_URL=http://localhost:8000/api
VITE_ORGANIZATION_ID=00000000-0000-0000-0000-000000000000
```

3. **Start Dev Server:**
```bash
npm run dev
```

Opens on `http://localhost:5173` (or 5174/5175 if port is taken)

### Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

### Hot Module Replacement (HMR)

Vite provides instant HMR for:
- React component changes
- CSS/Tailwind changes
- TypeScript changes

State is preserved during HMR when possible.

### Type Checking

**During Development:**
```bash
npx tsc --noEmit
```

**In CI:**
```bash
npm run build  # Includes type checking
```

### Debugging

**Browser DevTools:**
- React DevTools extension for component inspection
- Redux DevTools (when TanStack Query integrated)
- Network tab for API debugging

**Console Logging:**
```typescript
console.log("Node data:", node.data)
console.error("Failed to save agent:", error)
```

**Source Maps:**
Vite generates source maps in dev mode for accurate debugging.

---

## Common Patterns & Best Practices

### 1. Temporary Node IDs

**Pattern:**
```typescript
const tempId = `temp-${Date.now()}`

// Use temp ID immediately for optimistic UI
setNodes(prev => [...prev, { id: tempId, data, position }])

// Save to backend
const response = await createAgent(versionId, payload)

// Replace temp ID with real UUID
setNodes(prev => prev.map(node =>
  node.id === tempId ? { ...node, id: response.id } : node
))
```

**Why?**
- Users see immediate feedback (optimistic UI)
- Backend assigns real UUIDs
- Must synchronize after save

**Check if temp:**
```typescript
if (agentId.startsWith("temp-")) {
  // Agent not yet saved
}
```

### 2. Node Position Updates

**Pattern:**
```typescript
const persistAgentPosition = async (agentId: string, position: { x: number; y: number }) => {
  // Don't persist temp nodes
  if (agentId.startsWith("temp-")) return
  
  await apiUpdateAgent(agentId, {
    name: agent.name,
    instructions: agent.instructions,
    position,  // Include position in update payload
  })
}
```

**Called from:**
```typescript
onNodesChange={(changes) => {
  changes.forEach(change => {
    if (change.type === "position" && change.dragging === false) {
      persistAgentPosition(change.id, change.position)
    }
  })
}}
```

### 3. Error Handling

**Pattern:**
```typescript
const [error, setError] = useState<string | null>(null)

try {
  await someApiCall()
  setError(null)  // Clear previous errors
} catch (err) {
  console.error("Operation failed:", err)
  setError("Failed to perform operation")
}

// Display in UI
{error && <div className="p-4 text-sm text-error">{error}</div>}
```

**User-Friendly Messages:**
```typescript
const CANVAS_ERRORS = {
  saveAgent: "Failed to save agent",
  saveStartPosition: "Failed to save start position",
  missingWorkflow: "Select a workflow before testing",
} as const

setCanvasError(CANVAS_ERRORS.saveAgent)
```

### 4. Loading States

**Pattern:**
```typescript
const [loading, setLoading] = useState(false)

const handleAction = async () => {
  setLoading(true)
  try {
    await someApiCall()
  } finally {
    setLoading(false)  // Always reset, even on error
  }
}

// Display in UI
{loading ? <LoadingSpinner /> : <Content />}
```

**Multiple Loading States:**
```typescript
const [loadingWorkflows, setLoadingWorkflows] = useState(false)
const [creatingWorkflow, setCreatingWorkflow] = useState(false)
const [publishing, setPublishing] = useState(false)
```

### 5. Async Operation Patterns

**Sequential Operations:**
```typescript
// Create path, then create variables
const createdPath = await apiCreatePath(agentId, pathPayload)

for (const variable of variables) {
  await createPathVariable(createdPath.id, variable)
}
```

**Parallel Operations:**
```typescript
// Delete multiple paths at once
await Promise.all(
  pathIds.map(id => apiDeletePath(id))
)
```

### 6. Modal State Management

**Pattern:**
```typescript
const [showEditModal, setShowEditModal] = useState(false)
const [modalData, setModalData] = useState<Agent | null>(null)

// Open modal
const handleEdit = (agent: Agent) => {
  setModalData(agent)
  setShowEditModal(true)
}

// Close modal
const handleClose = () => {
  setShowEditModal(false)
  setModalData(null)
}

// Render
{showEditModal && modalData && (
  <EditAgentModal 
    agent={modalData} 
    onClose={handleClose}
    onSave={handleSave}
  />
)}
```

### 7. Form Validation

**Pattern with React Hook Form:**
```typescript
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  instructions: z.string().min(10, "Instructions too short"),
})

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
  defaultValues: { name: "", instructions: "" },
})

const onSubmit = handleSubmit(async (data) => {
  await createAgent(versionId, data)
})
```

---

## Known Issues & Future Work

### Known Issues

1. **No Undo/Redo** - Canvas changes are immediately persisted
2. **Limited Error Recovery** - Failed saves may leave inconsistent state
3. **No Offline Support** - Requires active backend connection
4. **Large Workflows** - Performance degrades with 50+ nodes
5. **No Collaboration** - Multiple users editing same workflow will conflict

### Future Enhancements

#### High Priority

1. **TanStack Query Migration**
   - Replace manual API state with React Query
   - Automatic cache invalidation
   - Optimistic updates with rollback
   - Better loading/error states

2. **Canvas State Refactoring**
   - Extract hooks: `useWorkflowCanvas`, `useAgentSelection`, `usePathManagement`
   - Reduce WorkflowsPage.tsx from 1200+ lines to ~400
   - Improve testability

3. **Form Improvements**
   - Validation for all modals
   - Better error messages
   - Autosave drafts

4. **Testing UI Enhancements**
   - Recording and playback
   - Conversation history export
   - Performance metrics
   - Multi-turn test scenarios

#### Medium Priority

5. **Additional Integrations**
   - HubSpot CRM
   - Salesforce
   - Google Sheets
   - Twilio
   - Custom webhooks

6. **Analytics Dashboard**
   - Call volume charts
   - Agent performance metrics
   - Path usage heatmaps
   - Error tracking

7. **Collaboration Features**
   - Real-time co-editing
   - Comments on nodes
   - Version history
   - User presence indicators

8. **Workflow Templates**
   - Pre-built workflows for common use cases
   - Import/export workflows
   - Workflow marketplace

#### Low Priority

9. **Advanced Canvas Features**
   - Grouping nodes
   - Subflows
   - Sticky notes
   - Custom node colors

10. **Performance Optimizations**
    - Virtual scrolling for large workflows
    - Lazy loading of agent details
    - Canvas rendering optimizations

### Technical Debt

1. **Type Safety Improvements**
   - Stricter types for `Record<string, unknown>`
   - Remove `any` types
   - Better error type definitions

2. **API Error Handling**
   - Standardized error responses
   - Retry logic
   - Network offline detection

3. **Code Organization**
   - Split large components into smaller modules
   - Extract business logic from UI components
   - Consistent naming conventions

4. **Testing**
   - Unit tests for utilities
   - Integration tests for API client
   - E2E tests for critical flows

---

## Conclusion

This frontend is the primary interface for building voice agent workflows. It provides a visual, drag-and-drop canvas powered by XYFlow, with modals for configuring agents, tools, and paths.

**Key architectural decisions:**
- **XYFlow for canvas** - Proven library for node-based editors
- **React hooks for state** - Simple, no Redux complexity
- **Type-safe API layer** - Catch errors at compile time
- **Modular components** - Easy to extend and maintain

**For new contributors:**
1. Start with `WorkflowsPage.tsx` to understand the main flow
2. Explore `lib/api.ts` to see backend integration
3. Check `types/workflow.ts` for domain models
4. Build a simple feature (e.g., new tool integration) to learn patterns

**Questions?** Review the backend `docs/` folder for API specifications and platform architecture.


