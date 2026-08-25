import { useEffect, useRef } from 'react';

export interface MediaPreviewKeyHandlers {
  onPrevious?: () => void;
  onNext?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onRotate?: () => void;
  onFullscreen?: () => void;
  onDownload?: () => void;
  onPlayPause?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Global shortcuts for the open preview (spec §21). Escape is deliberately
 * NOT handled here — Radix's `DialogPrimitive.Content` already closes on
 * Escape via its own dismissable-layer handling, and re-implementing it here
 * risks a double-fire or racing with Radix's own listener.
 *
 * Modifier combinations (Ctrl/Cmd/Alt) are ignored outright so this never
 * shadows a browser shortcut (Ctrl+F find, Cmd+R reload, ...) — only bare
 * key presses are used for `f`/`r`/`d`, and only while focus isn't inside a
 * text input (the in-modal search box included).
 */
export function useMediaPreviewKeys(
  isOpen: boolean,
  handlers: MediaPreviewKeyHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const handlers = handlersRef.current;
      switch (event.key) {
        case 'ArrowLeft':
          handlers.onPrevious?.();
          break;
        case 'ArrowRight':
          handlers.onNext?.();
          break;
        case '+':
        case '=':
          handlers.onZoomIn?.();
          break;
        case '-':
        case '_':
          handlers.onZoomOut?.();
          break;
        case '0':
          handlers.onZoomReset?.();
          break;
        case 'r':
        case 'R':
          handlers.onRotate?.();
          break;
        case 'f':
        case 'F':
          handlers.onFullscreen?.();
          break;
        case 'd':
        case 'D':
          handlers.onDownload?.();
          break;
        case ' ':
          if (handlers.onPlayPause) {
            handlers.onPlayPause();
            event.preventDefault();
          }
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);
}
