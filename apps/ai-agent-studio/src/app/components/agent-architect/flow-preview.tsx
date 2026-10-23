import { describeFlowLine, type StudioCanvasGraph } from '@org/types';
import { cn } from '@org/utils';
import { useMemo } from 'react';

const NODE_W = 220;
const NODE_H = 64;
const PAD = 24;
const SLOT_HANDLES = new Set(['model', 'memory', 'tools', 'tool', 'knowledge', 'agents', 'agent']);

type Tone = 'trigger' | 'agent' | 'approval' | 'action' | 'neutral';

const TONE_STROKE: Record<Tone, string> = {
  trigger: 'stroke-primary',
  agent: 'stroke-success',
  approval: 'stroke-info',
  action: 'stroke-warning',
  neutral: 'stroke-border-strong',
};

const TONE_DOT: Record<Tone, string> = {
  trigger: 'fill-primary',
  agent: 'fill-success',
  approval: 'fill-info',
  action: 'fill-warning',
  neutral: 'fill-muted-foreground',
};

function toneOf(type: string): Tone {
  if (/^TRIGGER|^START$/.test(type)) return 'trigger';
  if (['AGENT', 'SUB_AGENT', 'AGENT_COORDINATOR'].includes(type)) return 'agent';
  if (['USER_APPROVAL', 'HUMAN_APPROVAL', 'HUMAN_REVIEW', 'ESCALATE_HUMAN'].includes(type)) return 'approval';
  if (['MCP_TOOL', 'HTTP_REQUEST', 'SEND_MESSAGE', 'SEND_EMAIL'].includes(type) || /TOOL|ACTION|SEND/.test(type)) return 'action';
  return 'neutral';
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * The planned workflow, drawn from the very graph that will be saved — same
 * steps, same wiring the canvas opens with. Read-only; scales to its container.
 */
export function FlowPreview({ graph, className }: { graph: StudioCanvasGraph; className?: string }) {
  const layout = useMemo(() => {
    if (!graph.nodes.length) return null;
    const minX = Math.min(...graph.nodes.map((n) => n.position.x));
    const minY = Math.min(...graph.nodes.map((n) => n.position.y));
    const at = new Map(graph.nodes.map((n) => [n.id, { x: n.position.x - minX + PAD, y: n.position.y - minY + PAD }]));
    const width = Math.max(...[...at.values()].map((p) => p.x)) + NODE_W + PAD;
    const height = Math.max(...[...at.values()].map((p) => p.y)) + NODE_H + PAD;
    const edges = graph.edges.flatMap((e, i) => {
      const from = at.get(e.source);
      const to = at.get(e.target);
      if (!from || !to) return [];
      const below = to.y - from.y > NODE_H;
      const slot = Boolean(e.sourceHandle && SLOT_HANDLES.has(e.sourceHandle));
      const x1 = below ? from.x + NODE_W / 2 : from.x + NODE_W;
      const y1 = below ? from.y + NODE_H : from.y + NODE_H / 2;
      const x2 = below ? to.x + NODE_W / 2 : to.x;
      const y2 = below ? to.y : to.y + NODE_H / 2;
      const d = below
        ? `M${x1},${y1} C${x1},${y1 + 40} ${x2},${y2 - 40} ${x2},${y2}`
        : `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`;
      const branch = e.sourceHandle === 'false' || e.sourceHandle === 'error';
      return [{ key: `${e.source}-${e.target}-${i}`, d, dashed: slot || branch }];
    });
    return { at, width, height, edges };
  }, [graph]);

  if (!layout) return null;
  const summary = describeFlowLine(graph);

  return (
    <figure className={cn('overflow-x-auto rounded-lg border border-border bg-surface-raised/30', className)}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Workflow: ${summary}`}
        className="mx-auto block h-auto w-full"
        // Never shrink below a readable size — long flows scroll sideways instead of turning into a thumbnail.
        style={{ minWidth: Math.min(layout.width, layout.width * 0.7) }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="flow-preview-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {layout.edges.map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray={e.dashed ? '5 4' : undefined}
            markerEnd="url(#flow-preview-arrow)"
            className="stroke-muted-foreground"
          />
        ))}
        {graph.nodes.map((n) => {
          const p = layout.at.get(n.id)!;
          const tone = toneOf(String(n.type));
          const label = String(n.data?.label ?? n.type);
          const subtitle = n.data?.subtitle ? String(n.data.subtitle) : '';
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              <title>{subtitle ? `${label} — ${subtitle}` : label}</title>
              <rect width={NODE_W} height={NODE_H} rx={10} strokeWidth={1.5} className={cn('fill-surface', TONE_STROKE[tone])} />
              <circle cx={16} cy={subtitle ? 24 : NODE_H / 2} r={4} className={TONE_DOT[tone]} />
              <text x={28} y={subtitle ? 28 : NODE_H / 2 + 4} fontSize={13} fontWeight={600} className="fill-foreground">
                {clip(label, 26)}
              </text>
              {subtitle && (
                <text x={28} y={47} fontSize={11} className="fill-muted-foreground">
                  {clip(subtitle, 32)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
