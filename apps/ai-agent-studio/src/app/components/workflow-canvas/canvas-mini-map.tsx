import { cn } from '@org/utils';
import { MiniMap, type Node } from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

/** How long the map lingers once the canvas stops moving or the cursor leaves it. */
const HIDE_AFTER_MS = 1500;

function miniMapNodeColor(node: Node): string {
  const t = node.type || '';
  if (t.includes('START') || t.includes('TRIGGER')) return 'var(--success)';
  if (t.includes('AGENT')) return 'var(--primary)';
  if (t.includes('FIRECRAWL')) return 'var(--warning)';
  if (t.includes('TOOL') || t.includes('MCP')) return 'var(--primary)';
  if (t.includes('TRANSFORM') || t.includes('CODE'))
    return 'var(--accent-cyan)';
  if (t.includes('IF') || t.includes('CONDITION'))
    return 'var(--accent-violet)';
  if (t.includes('USER') || t.includes('APPROVAL')) return 'var(--destructive)';
  if (t.includes('NOTE')) return 'var(--accent-amber)';
  if (t.includes('GROUP')) return 'var(--muted-foreground)';
  if (t.includes('APP_CONNECTOR')) return 'var(--accent-cyan)';
  if (t.includes('END') || t.includes('OUTPUT')) return 'var(--success)';
  // Prompt / LLM / knowledge cards plugged into an agent, and anything else: quiet grey
  return 'var(--border-strong)';
}

/**
 * The canvas minimap, shown only while it's useful: it appears when the member
 * zooms or pans, fades once the canvas settles, and stays while the cursor is on it.
 * `revealRef` is called per viewport move, so showing it doesn't re-render the canvas.
 */
export function CanvasMiniMap({
  revealRef,
}: {
  revealRef: RefObject<(() => void) | null>;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const isHoveredRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setIsVisible(false);
    }, HIDE_AFTER_MS);
  }, [cancelHide]);

  useEffect(() => {
    revealRef.current = () => {
      setIsVisible(true);
      if (!isHoveredRef.current) scheduleHide();
    };
    return () => {
      revealRef.current = null;
      cancelHide();
    };
  }, [revealRef, scheduleHide, cancelHide]);

  return (
    <div
      className="contents"
      onPointerEnter={() => {
        isHoveredRef.current = true;
        cancelHide();
      }}
      onPointerLeave={() => {
        isHoveredRef.current = false;
        scheduleHide();
      }}
    >
      <MiniMap
        nodeColor={miniMapNodeColor}
        nodeStrokeWidth={3}
        pannable
        zoomable
        className={cn(
          'overflow-hidden !rounded-xl !border !border-border !bg-surface !shadow-sm',
          'transition-[opacity,visibility] duration-200 motion-reduce:transition-none',
          isVisible ? 'visible opacity-100' : 'invisible opacity-0',
        )}
        maskColor="rgba(0, 0, 0, 0.4)"
      />
    </div>
  );
}
