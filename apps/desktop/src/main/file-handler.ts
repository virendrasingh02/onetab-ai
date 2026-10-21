import { existsSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import { IPC_EVENT, type DesktopFileOpened } from '../shared/ipc.js';
import { addRecentDocument } from './jump-list.js';
import { logger } from './logger.js';
import { getMainWindow, showMainWindow } from './window.js';

let pendingFile: DesktopFileOpened | null = null;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

export function guessFileMimeType(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Checks if a command line argument refers to a real, readable file on disk.
 * Filters out flags (--foo), protocols (onetab://), and dev/executable binary paths.
 */
export function isFilePathArg(arg: string): boolean {
  if (!arg || arg.startsWith('-') || arg.includes('://')) return false;

  try {
    const fullPath = isAbsolute(arg) ? arg : resolve(arg);
    if (!existsSync(fullPath)) return false;
    const stat = statSync(fullPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Extracts a file path from process.argv or second-instance argv.
 */
export function fileFromArgv(argv: readonly string[]): string | undefined {
  // Skip the executable and any launcher script (e.g. index.js / main.js in dev)
  const argsToCheck = argv.slice(process.defaultApp ? 2 : 1);
  return argsToCheck.find((arg) => isFilePathArg(arg));
}

/**
 * Dispatches a file opening event to the renderer. Queues if window is not ready.
 */
export function dispatchFileOpened(filePath: string | undefined | null): boolean {
  if (!filePath || !isFilePathArg(filePath)) return false;

  const resolved = isAbsolute(filePath) ? filePath : resolve(filePath);
  const payload: DesktopFileOpened = {
    path: resolved,
    name: basename(resolved),
    mimeType: guessFileMimeType(resolved),
  };

  logger.info('FileHandler', `Dispatching opened file: ${payload.path}`);
  addRecentDocument(resolved);

  const window = getMainWindow();
  if (!window || window.webContents.isLoading()) {
    pendingFile = payload;
    return true;
  }

  showMainWindow();
  window.webContents.send(IPC_EVENT.fileOpened, payload);
  return true;
}

/**
 * Flushes any file opened before the renderer finished loading.
 */
export function flushPendingFile(): void {
  if (!pendingFile) return;
  const payload = pendingFile;
  pendingFile = null;

  const window = getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_EVENT.fileOpened, payload);
  }
}
