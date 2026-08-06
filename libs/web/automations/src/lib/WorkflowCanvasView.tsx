import type { Accent } from '@org/design-system';
import { accentClasses, Button, Page, PageHeader, Toolbar } from '@org/ui';
import { cn } from '@org/utils';
import {
  Cpu,
  GitBranch,
  Globe,
  Plus,
  Save,
  Webhook,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

type NodeType = 'WEBHOOK' | 'CONDITION' | 'AI_ACTION' | 'API_CALL';

export interface CanvasNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle: string;
}

/** Icon and accent per step type, resolved from one table. */
const NODE_KIND: Record<NodeType, { icon: LucideIcon; accent: Accent }> = {
  WEBHOOK: { icon: Webhook, accent: 'amber' },
  CONDITION: { icon: GitBranch, accent: 'blue' },
  AI_ACTION: { icon: Cpu, accent: 'violet' },
  API_CALL: { icon: Globe, accent: 'green' },
};

const ADD_ACTIONS: Array<{ type: NodeType; label: string; title: string }> = [
  { type: 'CONDITION', label: 'Condition', title: 'Filter condition' },
  { type: 'AI_ACTION', label: 'AI action', title: 'AI agent step' },
  { type: 'API_CALL', label: 'Webhook', title: 'Outgoing webhook' },
];

export function WorkflowCanvasView() {
  const [nodes, setNodes] = useState<CanvasNode[]>([
    {
      id: '1',
      type: 'WEBHOOK',
      title: 'Webhook trigger',
      subtitle: 'POST /api/v1/automations/webhook/xyz',
    },
    {
      id: '2',
      type: 'CONDITION',
      title: 'Check event type',
      subtitle: 'if payload.action == "created"',
    },
    {
      id: '3',
      type: 'AI_ACTION',
      title: 'AI summariser',
      subtitle: 'Summarise issue body via Ollama Llama3',
    },
    {
      id: '4',
      type: 'API_CALL',
      title: 'Matrix channel alert',
      subtitle: 'POST payload to #general',
    },
  ]);

  const addNode = (type: NodeType, title: string) => {
    setNodes((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        type,
        title,
        subtitle: 'Configured step',
      },
    ]);
  };

  return (
    <Page width="full">
      <PageHeader
        title="Workflow builder"
        description="Compose triggers, conditions, webhooks and AI actions."
        icon={<Workflow />}
        accent="amber"
        actions={<Button leadingIcon={<Save />}>Save workflow</Button>}
      />

      <div className="min-h-105 gap-1 p-6 flex flex-col items-center rounded-xl border bg-surface">
        {/* An ordered list: the sequence of steps is the workflow. */}
        <ol className="flex w-full flex-col items-center">
          {nodes.map((node, index) => {
            const { icon: Icon, accent } = NODE_KIND[node.type];
            const isLast = index === nodes.length - 1;

            return (
              <li key={node.id} className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-80 p-4 shadow-xs rounded-xl border bg-background',
                    'transition-colors duration-(--duration-fast) hover:border-border-strong',
                  )}
                >
                  <div className="gap-3 flex items-center">
                    <span
                      aria-hidden
                      className={cn(
                        'size-9 flex shrink-0 items-center justify-center rounded-lg',
                        accentClasses[accent].soft,
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-foreground">
                        <span className="text-muted-foreground tabular-nums">
                          {index + 1}.
                        </span>{' '}
                        {node.title}
                      </h2>
                      <p className="text-xs truncate font-mono text-muted-foreground">
                        {node.subtitle}
                      </p>
                    </div>
                  </div>
                </div>

                {!isLast ? (
                  <span
                    aria-hidden
                    className="my-1 h-6 w-0.5 relative bg-border"
                  >
                    <span className="-bottom-0.5 -left-0.75 size-2 absolute rounded-full bg-warning" />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <Toolbar aria-label="Add a step" className="mt-6 justify-center">
          {ADD_ACTIONS.map((action) => (
            <Button
              key={action.type}
              variant="outline"
              size="sm"
              leadingIcon={<Plus />}
              onClick={() => addNode(action.type, action.title)}
            >
              {action.label}
            </Button>
          ))}
        </Toolbar>
      </div>
    </Page>
  );
}
