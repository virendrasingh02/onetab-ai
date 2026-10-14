import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useEffect, useRef, useState } from 'react';
import { TooltipContent, TooltipTrigger, Tooltip } from './tooltip.js';

const SHOW_DELAY_MS = 350;

interface ActiveTip {
  text: string;
  rect: { top: number; left: number; width: number; height: number };
}

function findTitled(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>('[title]:not([data-native-title])');
  // SVG <title> children are elements, not attributes — only HTML hosts qualify.
  return el && el.getAttribute('title')?.trim() ? el : null;
}

/**
 * Upgrades native `title="…"` browser tooltips to the shared <Tooltip> look.
 * Mount once inside <TooltipProvider> in every app so hints on plain DOM
 * elements match the ones rendered through <Hint>. Opt out per element with
 * `data-native-title`.
 */
export function NativeTitleTooltips() {
  const [tip, setTip] = useState<ActiveTip | null>(null);
  const current = useRef<{ el: HTMLElement; title: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const release = () => {
      window.clearTimeout(timer.current);
      const held = current.current;
      if (held) {
        // Hand the attribute back so React-managed state is never left stale.
        if (held.el.isConnected && !held.el.hasAttribute('title')) {
          held.el.setAttribute('title', held.title);
        }
        current.current = null;
      }
      setTip(null);
    };

    const engage = (e: Event) => {
      const el = findTitled(e.target);
      if (!el || el === current.current?.el) return;
      release();
      const title = el.getAttribute('title') ?? '';
      // Remove the attribute so the browser's own tooltip never competes.
      el.removeAttribute('title');
      if (!el.hasAttribute('aria-label') && !el.textContent?.trim()) {
        el.setAttribute('aria-label', title);
      }
      current.current = { el, title };
      timer.current = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        setTip({
          text: title,
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
        });
      }, SHOW_DELAY_MS);
    };

    const leave = (e: Event) => {
      const held = current.current;
      if (!held) return;
      const related = (e as PointerEvent | FocusEvent).relatedTarget;
      if (related instanceof Node && held.el.contains(related)) return;
      release();
    };

    document.addEventListener('pointerover', engage, true);
    document.addEventListener('focusin', engage, true);
    document.addEventListener('pointerout', leave, true);
    document.addEventListener('focusout', leave, true);
    document.addEventListener('pointerdown', release, true);
    document.addEventListener('keydown', release, true);
    window.addEventListener('scroll', release, true);
    window.addEventListener('blur', release);
    return () => {
      release();
      document.removeEventListener('pointerover', engage, true);
      document.removeEventListener('focusin', engage, true);
      document.removeEventListener('pointerout', leave, true);
      document.removeEventListener('focusout', leave, true);
      document.removeEventListener('pointerdown', release, true);
      document.removeEventListener('keydown', release, true);
      window.removeEventListener('scroll', release, true);
      window.removeEventListener('blur', release);
    };
  }, []);

  return (
    <TooltipPrimitive.Provider>
      <Tooltip open={!!tip} delayDuration={0}>
        <TooltipTrigger asChild>
          <span
            aria-hidden
            data-native-title
            style={{
              position: 'fixed',
              pointerEvents: 'none',
              top: tip?.rect.top ?? 0,
              left: tip?.rect.left ?? 0,
              width: tip?.rect.width ?? 0,
              height: tip?.rect.height ?? 0,
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="top">{tip?.text}</TooltipContent>
      </Tooltip>
    </TooltipPrimitive.Provider>
  );
}
