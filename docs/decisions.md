# AI Agent Studio — Architecture Decisions & Contracts (Phase 0)

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Audit, Foundations, Decisions)  
**Date:** 2026-09-29  
**Repository:** `onetab-ai`

---

## 1. ADR 1: Workflow Graph JSON Schema (v1.0.0)

### Context & Problem
Different tools (n8n, Dify, Flowise, LangChain) store node graphs in divergent formats. In our platform, the Visual Canvas (`@xyflow/react`), serialization layer (`AIAgent.graphJson`, `AutomationWorkflow.nodesJson`), and runtime execution engine must share a single, strictly validated, typed contract that supports empty workflows, versioning, and non-destructive schema migrations.

### Decision
We standardize on **Universal Workflow Graph Schema v1.0.0** defined in `@org/types` (`libs/shared/types/src/lib/workflow-schema.ts`) and validated by Zod in `@org/validation` (`workflowGraphSchema`):

```typescript
export interface WorkflowGraphDefinition {
  schemaVersion: '1.0.0';
  id?: string;
  name?: string;
  description?: string;
  viewport?: { x: number; y: number; zoom: number };
  nodes: WorkflowNodeInstance[];
  edges: WorkflowEdgeInstance[];
  variables?: WorkflowVariable[];
  environment?: Record<string, string>;
  metadata?: {
    createdAt?: IsoDateString;
    updatedAt?: IsoDateString;
    createdBy?: string;
    version?: number;
    tags?: string[];
  };
}
```

- **Empty Workflow Guarantees:** A freshly created agent or workflow initializes with `schemaVersion: '1.0.0'`, empty `nodes: []`, empty `edges: []`, `variables: []`, and default `viewport: { x: 0, y: 0, zoom: 1 }`.
- **Validation:** Every save and publish API route parses `graphJson` with `workflowGraphSchema` and rejects invalid nodes or cycles.

---

## 2. ADR 2: Node Registry & Node Contract Interface

### Context & Problem
We support 35+ node types across 8 categories (Triggers, Input/Output, Intelligence, Logic & Control, Compute & Data, Tools & MCP, Knowledge & RAG, HITL, Multi-Agent). Nodes must declare their inputs, outputs, default configurations, validation constraints, and execution behavior cleanly.

### Decision
Every node adheres to `NodeRegistryDefinition`:

```typescript
export interface NodeRegistryDefinition {
  type: string;
  category: NodeCategory;
  name: string;
  description: string;
  icon: string;
  color?: string;
  inputs: WorkflowPortSchema[];
  outputs: WorkflowPortSchema[];
  defaultConfig: Record<string, unknown>;
  validate?: (config: Record<string, unknown>) => { valid: boolean; errors: string[] };
}
```

- **Port Compatibility:** Connectors check handle data types (e.g., `string`, `json`, `file`, `control_flow`). Incompatible connections are rejected on the canvas.
- **Isolation:** Node handlers execute in pure functions or isolated worker contexts without side effects on sibling nodes.

---

## 3. ADR 3: Execution Engine & Run / Trace State Model

### Context & Problem
Agent and workflow runs require end-to-end observability, step-level latency tracking, token usage breakdown, and credit cost attribution.

### Decision
All executions are persisted in `ai_executions` and `ai_execution_steps` using the unified lifecycle state machine:

```
[QUEUED] ──> [RUNNING] ──┬──> [WAITING_APPROVAL] ──┬──> [RUNNING] ──> [COMPLETED]
                         │                         │
                         ├──> [FAILED]             └──> [REJECTED / CANCELLED]
                         │
                         └──> [TIMED_OUT]
```

- **Step Observability:** Every node execution emits an `AIExecutionStep` containing:
  - `stepId`: Unique step instance identifier
  - `nodeType`: Node category/type
  - `status`: `SUCCESS` | `FAILED` | `SKIPPED` | `WAITING`
  - `inputJson`: Sanitized input payload
  - `outputJson`: Execution output or error message
  - `latencyMs`: Step execution duration
  - `tokensUsed`: Model tokens consumed by step
- **Cost Calculation:** Total cost is calculated deterministically based on standard model pricing tables:
  $$\text{Total Cost} = \sum (\text{Prompt Tokens} \times \text{Rate}_{\text{in}} + \text{Completion Tokens} \times \text{Rate}_{\text{out}})$$

---

## 4. ADR 4: Security, Secrets, and RBAC / AI Resource Authorization

### Context & Problem
AI agents can invoke sensitive enterprise tools (SQL queries, internal webhooks, Matrix channel broadcasts). Unauthorized access or credential leakage poses high risk.

### Decision
1. **Multi-Tenant Isolation:** Every agent, workflow, execution, and secret is scoped to a guarded `workspaceId`.
2. **Controller Guards:**
   - `WorkspaceRoleGuard`: Enforces role-based permissions (`WorkspacePermission.CREATE`, `UPDATE`, `DELETE`).
   - `CanManageAIEntity`: Validates whether the user owns the agent or is a workspace administrator before allowing modifications.
3. **Secret Storage:**
   - `AISecret` uses AES-256-GCM envelope encryption at rest.
   - Raw secrets are never returned over API responses; only `maskedValue` is returned.
   - Secrets are injected into node runtimes in-memory only during execution.
4. **Guardrails & Autonomy:**
   - Tools are classified into `READ_ONLY_AGENT_TOOLS` vs state-mutating actions.
   - Under `supervised` or `semi` autonomy, sensitive actions pause and require human approval.
   - PII detection automatically redacts or blocks emails, phones, SSNs, and payment card numbers before output delivery.

---

## 5. ADR 5: Event Bus & Reactive Notification Contracts

### Context & Problem
Real-time UI updates (canvas node highlights during execution, approval requests, chat streaming) require decoupled, asynchronous message dispatching.

### Decision
We utilize NestJS `EventEmitter2` in backend services and Socket.io / SSE for client subscriptions:
- **`AppEvent.AGENT_EXECUTION_STARTED`**: Emitted when a workflow or agent starts.
- **`AppEvent.AGENT_STEP_COMPLETED`**: Emitted per node finish with latency and status; drives live canvas visual tracer.
- **`AppEvent.AGENT_APPROVAL_REQUESTED`**: Dispatched to workspace members when a human approval gate is reached.
- **`AppEvent.AGENT_EXECUTION_FINISHED`**: Emitted on completion with final output and token cost.

---

## 6. ADR 6: Standard Error Hierarchy & Structured Codes

### Context & Problem
Ad-hoc string errors make retry policies, debugging, and UI troubleshooting difficult.

### Decision
We standardize on structured error codes defined in `AgentStudioErrorCode`:

| Domain | Error Codes | Retryable |
|---|---|---|
| **Graph** | `GRAPH_INVALID_JSON`, `GRAPH_EMPTY`, `GRAPH_CYCLE_DETECTED`, `GRAPH_DISCONNECTED_COMPONENTS` | No |
| **Execution** | `EXECUTION_TIMEOUT`, `EXECUTION_CANCELLED`, `EXECUTION_RATE_LIMITED` | Yes (if rate limited) |
| **Model** | `MODEL_PROVIDER_UNAVAILABLE`, `MODEL_INVALID_KEY`, `MODEL_CONTEXT_LENGTH_EXCEEDED` | Yes (if provider unavailable) |
| **Tool / MCP** | `TOOL_NOT_FOUND`, `TOOL_EXECUTION_FAILED`, `TOOL_PERMISSION_DENIED`, `MCP_SERVER_UNREACHABLE` | Yes (if network blip) |
| **Security** | `GUARDRAIL_PII_VIOLATION`, `GUARDRAIL_CONTENT_POLICY_VIOLATION`, `GUARDRAIL_PROMPT_INJECTION_DETECTED` | No |

Every API error returns:
```json
{
  "code": "TOOL_EXECUTION_FAILED",
  "message": "Connection to MCP server timed out after 10000ms",
  "nodeId": "tool_fetch_user_1",
  "retryable": true
}
```

---

## 7. ADR 7: Design Tokens & UI Architecture

### Context & Problem
The AI Agent Studio UI must look cohesive, modern, and aligned with the platform design system (`@org/ui`, Tailwind CSS v4, dark/light themes).

### Decision
- **Styling:** Tailwind CSS v4 CSS variables and `@org/ui` primitive components (`Button`, `Card`, `Badge`, `Dialog`, `Input`, `DropdownMenu`).
- **Icons:** `lucide-react` icons standardized across all 8 node categories.
- **Color Coding per Category:**
  - *Triggers:* Emerald / Green (`bg-emerald-500/10 text-emerald-400 border-emerald-500/20`)
  - *Intelligence / LLM:* Violet / Purple (`bg-purple-500/10 text-purple-400 border-purple-500/20`)
  - *Logic & Control:* Amber / Orange (`bg-amber-500/10 text-amber-400 border-amber-500/20`)
  - *Tools & MCP:* Blue / Sky (`bg-blue-500/10 text-blue-400 border-blue-500/20`)
  - *Knowledge & RAG:* Cyan / Teal (`bg-cyan-500/10 text-cyan-400 border-cyan-500/20`)
  - *HITL Governance:* Rose / Red (`bg-rose-500/10 text-rose-400 border-rose-500/20`)
  - *Multi-Agent:* Indigo (`bg-indigo-500/10 text-indigo-400 border-indigo-500/20`)
- **Canvas State:** ReactFlow nodes and edges managed through TanStack Query and localized immutable state updates.

---

## 8. ADR 8: 22-Module Feature Flags Registry

### Context & Problem
To ensure progressive rollout and allow zero-downtime continuous deployment of all 22 modules across subsequent phases, features must be toggled independently.

### Decision
We implement `DEFAULT_AGENT_STUDIO_FLAGS` and `isAgentStudioModuleEnabled(moduleId, overrides)` in `@org/types`. Every module (1.0 to 22.0) has a dedicated flag, phase assignment, and override resolver.
