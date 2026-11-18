/**
 * Preload for the find bar overlay (`main/find-bar.ts`). Sandboxed, so it can
 * import nothing but `electron`: the channel names are repeated from
 * `FIND_BAR_CHANNEL` there (a test keeps the two in step).
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const CHANNEL = {
  query: 'onetab:find-bar/query',
  close: 'onetab:find-bar/close',
  result: 'onetab:find-bar/result',
  focus: 'onetab:find-bar/focus',
} as const;

interface FindResult {
  activeMatchOrdinal: number;
  matches: number;
}

function on<T>(channel: string, handler: (payload: T) => void): void {
  ipcRenderer.on(channel, (_event: IpcRendererEvent, payload: T) => handler(payload));
}

contextBridge.exposeInMainWorld('findBar', {
  query: (text: string, forward: boolean, newSearch: boolean) =>
    ipcRenderer.send(CHANNEL.query, { text: String(text), forward, newSearch }),
  close: () => ipcRenderer.send(CHANNEL.close),
  onResult: (handler: (result: FindResult) => void) => on(CHANNEL.result, handler),
  onFocus: (handler: () => void) => on(CHANNEL.focus, handler),
});
