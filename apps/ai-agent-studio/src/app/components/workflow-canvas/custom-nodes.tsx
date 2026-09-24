import { cn } from '@org/utils';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileCode,
  Flame,
  GitBranch,
  Globe,
  Layers,
  Link as LinkIcon,
  Loader2,
  Lock,
  PauseCircle,
  Play,
  Repeat,
  Search,
  ShieldAlert,
  Sparkles,
  StopCircle,
  UserCheck,
  Variable,
  Wrench,
  Zap,
} from 'lucide-react';
import { memo } from 'react';

export interface WorkflowNodePayload {
  label: string;
  subtitle?: string;
  status?: 'idle' | 'running' | 'success' | 'failed' | 'waiting';
  config?: Record<string, any>;
  [key: string]: any;
}

const statusBorderClasses: Record<string, string> = {
  idle: 'border-border',
  running: 'border-primary ring-2 ring-primary/40 animate-pulse',
  success: 'border-emerald-500/80 ring-2 ring-emerald-500/20',
  failed: 'border-destructive ring-2 ring-destructive/30',
  waiting: 'border-amber-500 ring-2 ring-amber-500/30',
};

// 1. Start Node
export const StartNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[200px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
          <Play className="size-4 fill-emerald-500" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'Workflow Start'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Entry point'}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-surface !bg-emerald-500"
      />
    </div>
  );
});
StartNode.displayName = 'StartNode';

// 2. Agent Node
export const AgentNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[240px] max-w-[280px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-primary"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {nodeData.label || 'AI Agent'}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">
              {nodeData.subtitle || 'Autonomous Reasoning'}
            </div>
          </div>
        </div>

        {cfg.model && (
          <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
            {String(cfg.model).replace(':latest', '')}
          </span>
        )}
      </div>

      {cfg.instructions && (
        <div className="mt-2.5 rounded-md bg-surface-raised/70 p-1.5 text-[10px] text-muted-foreground line-clamp-2">
          {String(cfg.instructions)}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        <span>Tools: {(cfg.tools as string[])?.length || 0} attached</span>
        <span>Temp: {cfg.temperature ?? 0.7}</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-surface !bg-primary"
      />
    </div>
  );
});
AgentNode.displayName = 'AgentNode';

// 3. Firecrawl Node
export const FirecrawlNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[230px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-amber-500 border-amber-500 shadow-md' : 'hover:border-amber-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-amber-500"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <Flame className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {nodeData.label || 'Firecrawl'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {nodeData.subtitle || 'Web Extraction'}
            </div>
          </div>
        </div>

        <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500">
          Firecrawl
        </span>
      </div>

      {(cfg.query || cfg.url) && (
        <div className="mt-2 rounded bg-surface-raised px-2 py-1 font-mono text-[10px] text-muted-foreground truncate">
          {String(cfg.query || cfg.url)}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-surface !bg-amber-500"
      />
    </div>
  );
});
FirecrawlNode.displayName = 'FirecrawlNode';

// 4. MCP Tool Node
export const MCPToolNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[220px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md' : 'hover:border-indigo-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-indigo-500"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500">
          <Wrench className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'MCP Tool'}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
            {cfg.toolName || nodeData.subtitle || 'execute_tool'}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-surface !bg-indigo-500"
      />
    </div>
  );
});
MCPToolNode.displayName = 'MCPToolNode';

// 5. Transform Node
export const TransformNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[210px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-sky-500 border-sky-500 shadow-md' : 'hover:border-sky-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-sky-500"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500">
          <Code2 className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'Transform'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Map / Template'}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-surface !bg-sky-500"
      />
    </div>
  );
});
TransformNode.displayName = 'TransformNode';

// 6. If / Else Condition Node
export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[220px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-violet-500 border-violet-500 shadow-md' : 'hover:border-violet-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-violet-500"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500">
          <GitBranch className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'If / Else'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {cfg.variable ? `${cfg.variable} ${cfg.operator || '=='} ${cfg.value || ''}` : 'Branching Logic'}
          </div>
        </div>
      </div>

      {/* True Handle (Top Right) */}
      <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-emerald-500">
        <span>True</span>
        <Handle
          type="source"
          id="true"
          position={Position.Right}
          style={{ top: '42%' }}
          className="!size-2.5 !border-2 !border-surface !bg-emerald-500"
        />
      </div>

      {/* False Handle (Bottom Right) */}
      <div className="flex items-center justify-between text-[10px] font-semibold text-rose-500">
        <span>False</span>
        <Handle
          type="source"
          id="false"
          position={Position.Right}
          style={{ top: '78%' }}
          className="!size-2.5 !border-2 !border-surface !bg-rose-500"
        />
      </div>
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';

// 7. While Loop Node
export const WhileLoopNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[210px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-purple-500 border-purple-500 shadow-md' : 'hover:border-purple-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-purple-500"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/15 text-purple-500">
          <Repeat className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'While Loop'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Iterative batching'}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-surface !bg-purple-500"
      />
    </div>
  );
});
WhileLoopNode.displayName = 'WhileLoopNode';

// 8. User Approval Node (Human in the loop)
export const UserApprovalNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[230px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-rose-500 border-rose-500 shadow-md' : 'hover:border-rose-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-rose-500"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500">
            <UserCheck className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {nodeData.label || 'User Approval'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {nodeData.subtitle || 'Human signoff gate'}
            </div>
          </div>
        </div>

        <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-500">
          Pause Flow
        </span>
      </div>

      {cfg.action && (
        <div className="mt-2 text-[10px] text-muted-foreground italic truncate">
          Action: {String(cfg.action)}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-surface !bg-rose-500"
      />
    </div>
  );
});
UserApprovalNode.displayName = 'UserApprovalNode';

// 9. End Node
export const EndNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[200px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md' : 'hover:border-emerald-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-surface !bg-emerald-500"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'Workflow End'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Final output delivery'}
          </div>
        </div>
      </div>
    </div>
  );
});
EndNode.displayName = 'EndNode';

// Registered custom node types map for ReactFlow
export const STUDIO_NODE_TYPES = {
  START: StartNode,
  TRIGGER: StartNode,
  AGENT: AgentNode,
  SUB_AGENT: AgentNode,
  FIRECRAWL_SEARCH: FirecrawlNode,
  FIRECRAWL_SCRAPE: FirecrawlNode,
  FIRECRAWL_CRAWL: FirecrawlNode,
  FIRECRAWL_EXTRACT: FirecrawlNode,
  TOOL: MCPToolNode,
  MCP: MCPToolNode,
  MCP_TOOL: MCPToolNode,
  TRANSFORM: TransformNode,
  CODE: TransformNode,
  IF_ELSE: ConditionNode,
  CONDITION: ConditionNode,
  WHILE_LOOP: WhileLoopNode,
  LOOP: WhileLoopNode,
  USER_APPROVAL: UserApprovalNode,
  HUMAN_APPROVAL: UserApprovalNode,
  HUMAN_TASK: UserApprovalNode,
  END: EndNode,
  OUTPUT: EndNode,
};
