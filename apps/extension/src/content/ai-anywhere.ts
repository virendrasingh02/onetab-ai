/**
 * "AI Anywhere" — the selection pill, injected into every page.
 *
 * Two constraints shape this file. It renders inside a shadow root, because a
 * host page's CSS would otherwise reach in and wreck it (and ours would leak
 * out). And it holds no token and makes no network call: everything goes
 * through the background worker, so a hostile page cannot read a credential out
 * of the DOM it is sharing with us.
 */
import {
  ok,
  sendToBackground,
  type CapturedPage,
  type ContentRequest,
  type Result,
} from '../lib/messaging.js';

const HOST_ID = 'onetab-ai-anywhere';
const MIN_SELECTION_LENGTH = 12;

/** Design tokens, mirrored from `@org/design-system`. */
const TOKENS = {
  background: '#09090B',
  surface: '#111113',
  surfaceRaised: '#16171A',
  border: '#27272A',
  foreground: '#FAFAFA',
  muted: '#A1A1AA',
  subtle: '#71717A',
  primary: '#6E56CF',
  primaryHover: '#7C6AF5',
  destructive: '#E5484D',
} as const;

const STYLES = `
  :host { all: initial; }

  .root {
    position: fixed;
    z-index: 2147483647;
    font-family: 'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system,
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: ${TOKENS.foreground};
    -webkit-font-smoothing: antialiased;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 1px solid ${TOKENS.border};
    border-radius: 8px;
    background: ${TOKENS.surface};
    color: ${TOKENS.foreground};
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
    transition: background 120ms cubic-bezier(0.2, 0, 0, 1),
      border-color 120ms cubic-bezier(0.2, 0, 0, 1);
  }
  .pill:hover { background: ${TOKENS.surfaceRaised}; border-color: ${TOKENS.primary}; }
  .pill:focus-visible { outline: 1px solid ${TOKENS.primary}; outline-offset: 2px; }
  .pill svg { width: 13px; height: 13px; color: ${TOKENS.primary}; }

  .panel {
    width: 320px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    border: 1px solid ${TOKENS.border};
    border-radius: 12px;
    background: ${TOKENS.surface};
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }

  .panel-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 10px;
    border-bottom: 1px solid ${TOKENS.border};
    font-weight: 600;
    font-size: 12px;
  }
  .panel-head svg { width: 13px; height: 13px; color: ${TOKENS.primary}; }
  .spacer { flex: 1; }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${TOKENS.muted};
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .icon-btn:hover { background: #1E1F23; color: ${TOKENS.foreground}; }

  .panel-body {
    padding: 10px;
    overflow-y: auto;
    color: ${TOKENS.muted};
    white-space: pre-wrap;
    scrollbar-width: thin;
    scrollbar-color: #3F3F46 transparent;
  }
  .panel-body.error { color: ${TOKENS.destructive}; }

  .quote {
    margin: 0 0 8px;
    padding-left: 8px;
    border-left: 2px solid ${TOKENS.border};
    color: ${TOKENS.subtle};
    font-size: 11px;
    max-height: 48px;
    overflow: hidden;
  }

  .dots { display: inline-flex; gap: 3px; padding: 2px 0; }
  .dots i {
    width: 4px; height: 4px; border-radius: 50%;
    background: ${TOKENS.primary};
    animation: pulse 1s ease-in-out infinite;
  }
  .dots i:nth-child(2) { animation-delay: 0.15s; }
  .dots i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

  @media (prefers-reduced-motion: reduce) {
    .pill { transition: none; }
    .dots i { animation: none; opacity: 0.6; }
  }
`;

const SPARKLE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M9.9 4.2 8.5 7.9 4.8 9.3l3.7 1.4 1.4 3.7 1.4-3.7 3.7-1.4-3.7-1.4Z"/>
  <path d="M18 5v4"/><path d="M16 7h4"/><path d="M17 15v3"/><path d="M15.5 16.5h3"/>
</svg>`;

/** Elements are created once and reused; re-creating them loses focus state. */
let host: HTMLDivElement | null = null;
let root: ShadowRoot | null = null;
let container: HTMLDivElement | null = null;

function mount(): HTMLDivElement {
  if (container) return container;

  host = document.createElement('div');
  host.id = HOST_ID;
  // The host itself must not participate in the page's layout at all.
  host.style.cssText = 'all: initial; position: static;';

  root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);

  container = document.createElement('div');
  container.className = 'root';
  root.appendChild(container);

  document.documentElement.appendChild(host);
  return container;
}

function unmount(): void {
  host?.remove();
  host = null;
  root = null;
  container = null;
  showingPanel = false;
}

/**
 * True while a result panel is on screen.
 *
 * Tracked as a flag rather than read back from the DOM because the shadow root
 * is closed: nothing outside these functions can see inside it.
 */
let showingPanel = false;

/**
 * Places the widget just below the selection, nudged back inside the viewport.
 * Fixed positioning means these are viewport coordinates, which is exactly what
 * `getBoundingClientRect` returns — no scroll offset is involved.
 */
function position(element: HTMLElement, rect: DOMRect, width: number): void {
  const margin = 8;
  const left = Math.min(
    Math.max(margin, rect.left),
    window.innerWidth - width - margin,
  );

  const below = rect.bottom + margin;
  const fitsBelow = below + element.offsetHeight < window.innerHeight - margin;

  element.style.left = `${left}px`;
  element.style.top = fitsBelow
    ? `${below}px`
    : `${Math.max(margin, rect.top - element.offsetHeight - margin)}px`;
}

function currentSelection(): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? '';

  if (!selection || selection.rangeCount === 0) return null;
  if (text.length < MIN_SELECTION_LENGTH) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  // A collapsed rect means the selection is not actually rendered.
  if (rect.width === 0 && rect.height === 0) return null;

  return { text, rect };
}

function renderPill(text: string, rect: DOMRect): void {
  const view = mount();
  view.innerHTML = `
    <button class="pill" type="button">
      ${SPARKLE_ICON}
      <span>Ask OneTab AI</span>
    </button>`;

  const pill = view.querySelector<HTMLButtonElement>('.pill');
  if (!pill) return;

  showingPanel = false;
  position(view, rect, 150);
  pill.addEventListener('mousedown', (event) => {
    // Without this the click clears the selection before the handler runs.
    event.preventDefault();
    event.stopPropagation();
  });
  pill.addEventListener('click', (event) => {
    event.preventDefault();
    void summarize(text, rect);
  });
}

function renderPanel(
  quote: string,
  rect: DOMRect,
  body: string,
  state: 'loading' | 'done' | 'error',
): void {
  const view = mount();
  const content =
    state === 'loading'
      ? '<span class="dots"><i></i><i></i><i></i></span>'
      : escapeHtml(body);

  view.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        ${SPARKLE_ICON}
        <span>OneTab AI</span>
        <span class="spacer"></span>
        <button class="icon-btn" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="panel-body${state === 'error' ? ' error' : ''}">
        <p class="quote">${escapeHtml(quote.slice(0, 180))}</p>
        ${content}
      </div>
    </div>`;

  showingPanel = true;
  position(view, rect, 320);
  view
    .querySelector<HTMLButtonElement>('.icon-btn')
    ?.addEventListener('click', unmount);
}

function escapeHtml(value: string): string {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}

async function summarize(text: string, rect: DOMRect): Promise<void> {
  renderPanel(text, rect, '', 'loading');

  const response = await sendToBackground<string>({
    type: 'ai:summarize',
    text,
  });

  // The user may have dismissed the panel while the request was in flight.
  if (!container) return;

  if (response.ok) {
    renderPanel(text, rect, response.data, 'done');
  } else {
    renderPanel(text, rect, response.error, 'error');
  }
}

// --- Selection tracking ------------------------------------------------------
//
// `selectionchange` fires on every cursor movement during a drag. Rebuilding
// the widget that often is both wasteful and visibly jittery, so it settles
// first.
let debounce: ReturnType<typeof setTimeout> | undefined;

document.addEventListener('selectionchange', () => {
  // Once a result is on screen it stays until dismissed; collapsing the
  // selection to scroll should not throw the answer away.
  if (showingPanel) return;

  clearTimeout(debounce);
  debounce = setTimeout(() => {
    const selection = currentSelection();
    if (selection) {
      renderPill(selection.text, selection.rect);
    } else {
      unmount();
    }
  }, 200);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') unmount();
});

// Anything that moves the page moves the selection out from under the widget.
window.addEventListener('scroll', () => !showingPanel && unmount(), {
  passive: true,
  capture: true,
});
window.addEventListener('resize', () => !showingPanel && unmount());

// --- Page capture ------------------------------------------------------------

/**
 * Extracts something worth sending as page context.
 *
 * `body.innerText` alone is mostly navigation and footer boilerplate, so the
 * likeliest content root is tried first. `innerText` rather than `textContent`
 * because it respects visibility and line breaks — `textContent` happily
 * returns the contents of `<script>` tags.
 */
function readPageText(): string {
  const candidate =
    document.querySelector('article') ??
    document.querySelector('main') ??
    document.querySelector('[role="main"]') ??
    document.body;

  return (candidate as HTMLElement).innerText.replace(/\n{3,}/g, '\n\n').trim();
}

chrome.runtime.onMessage.addListener(
  (
    message: ContentRequest,
    _sender,
    respond: (r: Result<CapturedPage>) => void,
  ) => {
    if (message.type === 'content:capture') {
      const selected = window.getSelection()?.toString().trim() ?? '';
      respond(
        ok({
          url: location.href,
          title: document.title || location.href,
          // 12000 characters is well past what the prompt uses and keeps the
          // message small enough to pass cheaply between contexts.
          text: (selected || readPageText()).slice(0, 12_000),
          fromSelection: selected.length > 0,
        }),
      );
    }
    return true;
  },
);
