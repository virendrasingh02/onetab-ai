import type { Accent } from '@org/design-system';
import type { Whiteboard } from '@org/types';
import {
  accentClasses,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  usePromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { Layout, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  useCurrentWorkspace,
  useWhiteboardMutations,
  useWhiteboards,
} from './use-work-tools.js';

export interface CanvasNode {
  id: string;
  title: string;
  x: number;
  y: number;
  accent: Accent;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
}

interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const ACCENTS: Accent[] = ['blue', 'violet', 'green', 'amber', 'cyan', 'rose'];

const EMPTY_CANVAS: CanvasData = { nodes: [], edges: [] };

/** Node dimensions, so edges can be drawn between centres. */
const NODE_WIDTH = 192;
const NODE_HEIGHT = 72;

/**
 * `canvasData` is an opaque JSON string on the wire, so every read has to cope
 * with a board written by an older version — or by hand.
 */
function decodeCanvas(canvasData: string): CanvasData {
  try {
    const parsed: unknown = JSON.parse(canvasData);
    if (!parsed || typeof parsed !== 'object') return EMPTY_CANVAS;

    const { nodes, edges } = parsed as Partial<CanvasData>;
    return {
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
    };
  } catch {
    return EMPTY_CANVAS;
  }
}

export function WhiteboardCanvas() {
  const { workspaceId } = useCurrentWorkspace();
  const query = useWhiteboards(workspaceId);
  const { create } = useWhiteboardMutations(workspaceId);

  const [selectedId, setSelectedId] = useState<string>();

  const boards = query.data ?? [];
  const active = boards.find((board) => board.id === selectedId) ?? boards[0];

  if (query.isLoading) {
    return (
      <Page width="full">
        <LoadingState label="Loading whiteboards…" />
      </Page>
    );
  }

  if (query.isError) {
    return (
      <Page width="full">
        <ErrorState
          title="Could not load whiteboards"
          description="This workspace's boards are unavailable."
        />
      </Page>
    );
  }

  return (
    <Page width="full">
      <PageHeader
        title="Whiteboard"
        description="Sketch node flows, architecture diagrams and ideas."
        icon={<Layout />}
        accent="violet"
        actions={
          <div className="gap-2 flex items-center">
            {boards.length > 0 ? (
              <Select value={active?.id} onValueChange={setSelectedId}>
                <SelectTrigger className="w-56" aria-label="Whiteboard">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              variant={boards.length > 0 ? 'outline' : 'primary'}
              leadingIcon={<Plus />}
              disabled={create.isPending}
              onClick={() =>
                create.mutate(
                  { name: `Board ${boards.length + 1}` },
                  { onSuccess: (board) => setSelectedId(board.id) },
                )
              }
            >
              New board
            </Button>
          </div>
        }
      />

      {active ? (
        // Keyed so switching boards reloads the canvas from that board's data
        // rather than carrying the previous board's unsaved nodes across.
        <BoardCanvas key={active.id} board={active} workspaceId={workspaceId} />
      ) : (
        <EmptyState
          icon={<Layout />}
          title="No whiteboards yet"
          description="Create a board to start sketching flows and architecture with your team."
        />
      )}
    </Page>
  );
}

function BoardCanvas({
  board,
  workspaceId,
}: {
  board: Whiteboard;
  workspaceId: string | undefined;
}) {
  const { update, remove } = useWhiteboardMutations(workspaceId);
  const prompts = usePromptDialog();

  /* A board and everything drawn on it go together, so confirm first. */
  const confirmDelete = async (name: string, id: string) => {
    const confirmed = await prompts.confirmAction({
      title: `Delete “${name}”?`,
      description:
        'The board and everything on it are deleted for everyone. This cannot be undone.',
      confirmLabel: 'Delete board',
      destructive: true,
    });
    if (confirmed) remove.mutate(id);
  };
  const [canvas, setCanvas] = useState<CanvasData>(() =>
    decodeCanvas(board.canvasData),
  );

  /*
   * Edits are debounced into one PATCH rather than saved per interaction:
   * dragging a node would otherwise be a request per frame, and the canvas is
   * sent whole each time.
   */
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDirty = useRef(false);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const edit = (next: CanvasData) => {
    setCanvas(next);
    isDirty.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      isDirty.current = false;
      update.mutate({
        whiteboardId: board.id,
        input: { canvasData: JSON.stringify(next) },
      });
    }, 600);
  };

  const addNode = () =>
    edit({
      ...canvas,
      nodes: [
        ...canvas.nodes,
        {
          id: `node_${Date.now()}`,
          title: 'New flow node',
          x: 80 + (canvas.nodes.length % 4) * 220,
          y: 80 + Math.floor(canvas.nodes.length / 4) * 140,
          accent: ACCENTS[canvas.nodes.length % ACCENTS.length],
        },
      ],
    });

  const removeNode = (nodeId: string) =>
    edit({
      nodes: canvas.nodes.filter((node) => node.id !== nodeId),
      // An edge to a node that no longer exists would draw to nowhere.
      edges: canvas.edges.filter(
        (edge) => edge.from !== nodeId && edge.to !== nodeId,
      ),
    });

  const nodeById = new Map(canvas.nodes.map((node) => [node.id, node]));

  return (
    <>
      <div className="mb-3 gap-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {update.isPending ? 'Saving…' : `Last saved ${board.name}`}
        </p>
        <div className="gap-2 flex items-center">
          <Button size="sm" leadingIcon={<Plus />} onClick={addNode}>
            Add node
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 />}
            disabled={remove.isPending}
            onClick={() => confirmDelete(board.name, board.id)}
          >
            Delete board
          </Button>
        </div>
      </div>

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
          {canvas.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;

            return (
              <line
                key={edge.id}
                x1={from.x + NODE_WIDTH / 2}
                y1={from.y + NODE_HEIGHT / 2}
                x2={to.x + NODE_WIDTH / 2}
                y2={to.y + NODE_HEIGHT / 2}
                stroke="var(--border-strong)"
                strokeWidth="2"
                strokeDasharray="4"
              />
            );
          })}
        </svg>

        {canvas.nodes.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Layout />}
            title="This board is empty"
            description="Add a node to start mapping out the flow."
          />
        ) : null}

        {canvas.nodes.map((node) => (
          <div
            key={node.id}
            style={{ left: `${node.x}px`, top: `${node.y}px` }}
            className={cn(
              'w-48 p-3 shadow-xs absolute cursor-grab rounded-xl border',
              'transition-transform duration-(--duration-fast) hover:scale-105',
              accentClasses[node.accent]?.soft,
              accentClasses[node.accent]?.border,
            )}
          >
            <div className="mb-1 gap-2 flex items-center justify-between">
              <input
                value={node.title}
                aria-label="Node title"
                onChange={(event) =>
                  edit({
                    ...canvas,
                    nodes: canvas.nodes.map((item) =>
                      item.id === node.id
                        ? { ...item, title: event.target.value }
                        : item,
                    ),
                  })
                }
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold focus:outline-none"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 shrink-0"
                aria-label={`Delete node ${node.title}`}
                onClick={() => removeNode(node.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {board.author.displayName ?? board.author.name}
            </p>
          </div>
        ))}
      </div>

      {prompts.dialog}
    </>
  );
}
