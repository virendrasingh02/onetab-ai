import {
  ipcMain,
  nativeTheme,
  WebContentsView,
  type BrowserWindow,
  type IpcMainEvent,
} from 'electron';
import { join } from 'node:path';
import { logger } from './logger.js';

/**
 * Find in page (Ctrl/Cmd+F).
 *
 * A browser tab has its own find bar; an Electron window has none. The bar is a
 * small native overlay (`WebContentsView`) on top of the app rather than a React
 * component inside it, for two reasons found in testing the in-page version:
 * Chromium's find also matches the query typed into an in-page text box (every
 * count was one too high and Enter could land on the box itself), and moving
 * between matches pulls focus out of an in-page input. A separate web contents
 * has neither problem.
 */

/** Repeated in `find-preload.ts`, which cannot import this file. */
export const FIND_BAR_CHANNEL = {
  query: 'onetab:find-bar/query',
  close: 'onetab:find-bar/close',
  result: 'onetab:find-bar/result',
  focus: 'onetab:find-bar/focus',
} as const;

export const FIND_BAR_SIZE = { width: 360, height: 44 } as const;
/** Clear of the 32px custom title strip. */
const TOP_OFFSET = 40;
const RIGHT_MARGIN = 16;

/** Where the overlay sits for a window whose content area is `contentWidth` wide. */
export function findBarBounds(contentWidth: number) {
  const width = Math.min(FIND_BAR_SIZE.width, Math.max(0, contentWidth - 2 * RIGHT_MARGIN));
  return {
    x: Math.max(RIGHT_MARGIN, contentWidth - width - RIGHT_MARGIN),
    y: TOP_OFFSET,
    width,
    height: FIND_BAR_SIZE.height,
  };
}

/** "3 of 12", "No results", or nothing before the first search. */
export function formatFindCount(result: { activeMatchOrdinal: number; matches: number } | null): string {
  if (!result) return '';
  if (result.matches === 0) return 'No results';
  return `${result.activeMatchOrdinal} of ${result.matches}`;
}

function palette(dark: boolean) {
  return dark
    ? { bg: '#1b1c1f', fg: '#ededef', muted: '#8b8d94', border: '#2e3036', hover: '#2a2c31' }
    : { bg: '#ffffff', fg: '#17181a', muted: '#6b6e76', border: '#e2e3e6', hover: '#f0f1f3' };
}

/** Self-contained page: no network, no app bundle, just the bar. */
export function findBarHtml(dark: boolean): string {
  const c = palette(dark);
  const icon = (path: string) =>
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Find in page</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:${c.bg};color:${c.fg};font:13px system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,sans-serif}
body{display:flex;align-items:center;gap:2px;padding:0 6px 0 12px;border:1px solid ${c.border};border-radius:8px}
input{flex:1;min-width:0;height:28px;border:0;outline:0;background:transparent;color:inherit;font:inherit}
input::placeholder{color:${c.muted}}
#count{min-width:72px;text-align:right;padding-right:6px;color:${c.muted};font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
button{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
button:hover:not(:disabled){background:${c.hover}}button:disabled{opacity:.4;cursor:default}
button:focus-visible{outline:2px solid ${c.muted};outline-offset:-2px}
</style></head><body role="search" aria-label="Find in page">
<input id="q" placeholder="Find in page" aria-label="Find in page" spellcheck="false" autocomplete="off">
<span id="count" aria-live="polite"></span>
<button id="prev" aria-label="Previous match" title="Previous (Shift+Enter)" disabled>${icon('<path d="m18 15-6-6-6 6"/>')}</button>
<button id="next" aria-label="Next match" title="Next (Enter)" disabled>${icon('<path d="m6 9 6 6 6-6"/>')}</button>
<button id="close" aria-label="Close find bar" title="Close (Esc)">${icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')}</button>
<script>
const q=document.getElementById('q'),count=document.getElementById('count'),prev=document.getElementById('prev'),next=document.getElementById('next');
const fmt=${formatFindCount.toString()};
let timer=null;
function search(){clearTimeout(timer);timer=setTimeout(()=>{if(!q.value){count.textContent='';prev.disabled=next.disabled=true;}window.findBar.query(q.value,true,true);},60);}
function step(forward){if(q.value)window.findBar.query(q.value,forward,false);}
q.addEventListener('input',search);
q.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();step(!e.shiftKey);}else if(e.key==='Escape'){e.preventDefault();window.findBar.close();}});
document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){e.preventDefault();window.findBar.close();}});
prev.onclick=()=>step(false);next.onclick=()=>step(true);document.getElementById('close').onclick=()=>window.findBar.close();
window.findBar.onResult((r)=>{if(!q.value)return;count.textContent=fmt(r);prev.disabled=next.disabled=!r.matches;});
window.findBar.onFocus(()=>{q.focus();q.select();});
q.focus();
</script></body></html>`;
}

let view: WebContentsView | null = null;
let owner: BrowserWindow | null = null;
let lastQuery = '';
/** Chromium occasionally drops the first request of a new find session without a reply; this re-asks once. */
let retryTimer: NodeJS.Timeout | null = null;
const RETRY_AFTER_MS = 400;

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function layout(): void {
  if (!view || !owner || owner.isDestroyed()) return;
  view.setBounds(findBarBounds(owner.getContentBounds().width));
}

function fromView(event: IpcMainEvent): boolean {
  return Boolean(view && !view.webContents.isDestroyed() && event.sender === view.webContents);
}

const onResize = () => layout();
// The page reloading (or crashing) under an open bar leaves nothing to search;
// in-app route changes are same-document and keep it open.
const onNavigate = (details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => {
  if (details.isMainFrame && !details.isSameDocument) closeFindBar();
};
const onFound = (_event: unknown, result: Electron.Result) => {
  clearRetry();
  if (!view || view.webContents.isDestroyed()) return;
  view.webContents.send(FIND_BAR_CHANNEL.result, {
    activeMatchOrdinal: result.activeMatchOrdinal,
    matches: result.matches,
  });
};

export function closeFindBar(): void {
  const window = owner;
  const current = view;
  view = null;
  owner = null;
  lastQuery = '';
  clearRetry();
  if (!window || window.isDestroyed()) return;
  window.off('resize', onResize);
  window.webContents.off('found-in-page', onFound);
  window.webContents.off('did-start-navigation', onNavigate);
  window.webContents.stopFindInPage('clearSelection');
  if (current) {
    window.contentView.removeChildView(current);
    current.webContents.close();
  }
  window.webContents.focus();
}

/** Opens the bar over `window`, or re-focuses and selects the query if it is already open. */
export function openFindBar(window: BrowserWindow): void {
  if (view && owner === window && !view.webContents.isDestroyed()) {
    view.webContents.focus();
    view.webContents.send(FIND_BAR_CHANNEL.focus);
    return;
  }
  if (view) closeFindBar();

  const next = new WebContentsView({
    webPreferences: {
      // Compiled beside `preload.js`, one level above this file's `dist/main/`.
      preload: join(__dirname, '..', 'find-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: false,
    },
  });
  next.setBackgroundColor(palette(nativeTheme.shouldUseDarkColors).bg);
  next.setBorderRadius(8);
  next.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  next.webContents.on('will-navigate', (event) => event.preventDefault());

  view = next;
  owner = window;
  window.contentView.addChildView(next);
  layout();
  window.on('resize', onResize);
  window.webContents.on('found-in-page', onFound);
  window.webContents.on('did-start-navigation', onNavigate);

  void next.webContents
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(findBarHtml(nativeTheme.shouldUseDarkColors))}`)
    .then(() => next.webContents.focus())
    .catch((error) => logger.warn('FindBar', 'Could not load the find bar', error));
}

export function registerFindBarIpc(): void {
  ipcMain.on(
    FIND_BAR_CHANNEL.query,
    (event, payload: { text?: unknown; forward?: unknown; newSearch?: unknown }) => {
      if (!fromView(event) || !owner || owner.isDestroyed()) return;
      const text = typeof payload?.text === 'string' ? payload.text.slice(0, 1000) : '';
      if (!text) {
        lastQuery = '';
        clearRetry();
        owner.webContents.stopFindInPage('clearSelection');
        return;
      }
      // Electron's `findNext: true` means "start a new search session"; stepping
      // through the current one is `findNext: false`.
      const newSearch = payload.newSearch === true || text !== lastQuery;
      lastQuery = text;
      const forward = payload.forward !== false;
      const contents = owner.webContents;
      clearRetry();
      contents.findInPage(text, { forward, findNext: newSearch });
      if (newSearch) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (lastQuery === text && !contents.isDestroyed()) {
            contents.findInPage(text, { forward, findNext: true });
          }
        }, RETRY_AFTER_MS);
      }
    },
  );
  ipcMain.on(FIND_BAR_CHANNEL.close, (event) => {
    if (fromView(event)) closeFindBar();
  });
}
