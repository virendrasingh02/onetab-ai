import type { Accent } from '@org/design-system';
import { accentClasses, Button, Page, PageHeader } from '@org/ui';
import { cn } from '@org/utils';
import { Layout, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface CanvasNode {
  id: string;
  title: string;
  x: number;
  y: number;
  accent: Accent;
}

const CONNECTIONS = [
  { id: 'auth-ai', x1: 180, y1: 120, x2: 320, y2: 120 },
  { id: 'ai-vector', x1: 400, y1: 150, x2: 400, y2: 240 },
];

export function WhiteboardCanvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: '1', title: 'User auth module', x: 80, y: 100, accent: 'blue' },
    { id: '2', title: 'Ollama AI runner', x: 320, y: 100, accent: 'violet' },
    { id: '3', title: 'Qdrant vector DB', x: 320, y: 240, accent: 'green' },
  ]);

  const addNode = () => {
    setNodes((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: 'New flow node',
        x: 150 + Math.random() * 100,
        y: 150 + Math.random() * 100,
        accent: 'amber',
      },
    ]);
  };

  return (
    <Page width="full">
      <PageHeader
        title="Whiteboard"
        description="Sketch node flows, architecture diagrams and ideas."
        icon={<Layout />}
        accent="violet"
        actions={
          <Button leadingIcon={<Plus />} onClick={addNode}>
            Add node
          </Button>
        }
      />

      {/*
        The dot grid is drawn from `--border` rather than a fixed hex, so the
        canvas follows the theme instead of staying dark-mode grey.
      */}
      <div
        className={cn(
          'min-h-125 p-6 relative flex-1 overflow-hidden rounded-xl border bg-surface',
          'bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px]',
        )}
      >
        <svg
          className="inset-0 pointer-events-none absolute size-full"
          aria-hidden
        >
          {CONNECTIONS.map((line) => (
            <line
              key={line.id}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--border-strong)"
              strokeWidth="2"
              strokeDasharray="4"
            />
          ))}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            style={{ left: `${node.x}px`, top: `${node.y}px` }}
            className={cn(
              'w-48 p-3 shadow-xs absolute cursor-grab rounded-xl border',
              'transition-transform duration-(--duration-fast) hover:scale-105',
              accentClasses[node.accent].soft,
              accentClasses[node.accent].border,
            )}
          >
            <div className="mb-1 gap-2 flex items-center justify-between">
              <span className="text-xs font-semibold truncate">
                {node.title}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 shrink-0"
                aria-label={`Delete node ${node.title}`}
                onClick={() =>
                  setNodes((prev) => prev.filter((item) => item.id !== node.id))
                }
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Interactive canvas element
            </p>
          </div>
        ))}
      </div>
    </Page>
  );
}
