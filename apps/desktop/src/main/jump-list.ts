import { app, nativeImage, type JumpListCategory, type JumpListItem } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { logger } from './logger.js';
import type { DesktopJumpListWorkspace, DesktopUserTask } from '../shared/ipc.js';

/**
 * The Windows taskbar Jump List (right-click on the taskbar button), laid out
 * the way Slack does it: a "Workspaces" category listing every workspace the
 * signed-in user belongs to, then a short "Tasks" category.
 *
 * Every entry relaunches the app with an `onetab://` link; the single-instance
 * lock hands that to the running instance (`second-instance` → deep link), so
 * a click never opens a second window.
 */

/** Jump List entries that act on the running app rather than navigating (see `deep-link.ts`). */
export const JUMP_LIST_COMMANDS = [
  'open-search',
  'open-ai-assistant',
  'move-to-current-display',
] as const;

const DEFAULT_JUMP_LIST_TASKS: DesktopUserTask[] = [
  {
    title: 'Search',
    description: 'Search messages, people, docs and channels',
    arguments: 'onetab://command/open-search',
  },
  {
    title: 'Ask AI Assistant',
    description: 'Open the AI Assistant panel',
    arguments: 'onetab://command/open-ai-assistant',
  },
  {
    title: 'Move Onetab AI to Current Display',
    description: 'Bring the Onetab AI window to the display you are using',
    arguments: 'onetab://command/move-to-current-display',
  },
];

/** Windows truncates long titles anyway; a cap keeps the menu a sensible width. */
const MAX_TITLE_LENGTH = 64;
const MAX_WORKSPACES = 10;

let workspaces: DesktopJumpListWorkspace[] = [];
let customTasks: DesktopUserTask[] | undefined;
let iconSource: string | undefined;
let iconPathCache: string | undefined;
let installedTasks = 0;

/**
 * The PNG the dev build turns into an `.ico`. A packaged build uses the exe's
 * own icon, but in dev `process.execPath` is `electron.exe`, so every entry
 * would otherwise carry the Electron logo.
 */
export function setJumpListIconSource(pngPath: string): void {
  iconSource = pngPath;
  iconPathCache = undefined;
}

/**
 * An ICO file is a 22-byte header around a PNG (supported since Vista), which
 * saves shipping a separate `.ico` just for dev.
 */
function pngToIco(png: Buffer): Buffer {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(0, 6); // width 256
  header.writeUInt8(0, 7); // height 256
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([header, png]);
}

function resolveIconPath(): string {
  if (!process.defaultApp || !iconSource) return process.execPath;
  if (iconPathCache) return iconPathCache;
  try {
    if (!existsSync(iconSource)) return process.execPath;
    const image = nativeImage.createFromPath(iconSource);
    if (image.isEmpty()) return process.execPath;
    const dir = join(app.getPath('userData'), 'jump-list');
    mkdirSync(dir, { recursive: true });
    const target = join(dir, 'app-icon.ico');
    writeFileSync(target, pngToIco(image.resize({ width: 256, height: 256 }).toPNG()));
    iconPathCache = target;
    return target;
  } catch (error) {
    logger.warn('JumpList', 'Could not build the Jump List icon', error);
    return process.execPath;
  }
}

/**
 * In dev the OS must launch `electron <script> <link>`; a bare
 * `electron <link>` opens Electron's default app instead of ours.
 */
function launchArguments(link: string): string {
  const script = process.defaultApp ? process.argv[1] : undefined;
  const parts = script ? [resolve(script), link] : [link];
  return parts.map((part) => (/[\s"]/.test(part) ? `"${part.replace(/"/g, '')}"` : part)).join(' ');
}

function clampTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_TITLE_LENGTH ? `${clean.slice(0, MAX_TITLE_LENGTH - 1)}…` : clean;
}

function toItem(task: DesktopUserTask): JumpListItem {
  return {
    type: 'task',
    program: task.program || process.execPath,
    args: task.program ? task.arguments || '' : launchArguments(task.arguments || ''),
    title: clampTitle(task.title),
    description: task.description || '',
    iconPath: task.iconPath || resolveIconPath(),
    iconIndex: task.iconIndex ?? 0,
  };
}

function workspaceItems(): JumpListItem[] {
  return workspaces.map((workspace) =>
    toItem({
      title: workspace.name,
      description: `Open ${workspace.name}`,
      arguments: `onetab://w/${encodeURIComponent(workspace.slug)}`,
    }),
  );
}

function render(): boolean {
  if (process.platform !== 'win32') return false;

  const tasks = (customTasks ?? DEFAULT_JUMP_LIST_TASKS).map(toItem);
  const workspaceEntries = workspaceItems();
  const categories: JumpListCategory[] = [];
  if (workspaceEntries.length > 0) {
    categories.push({ type: 'custom', name: 'Workspaces', items: workspaceEntries });
  }
  categories.push({ type: 'tasks', items: tasks });

  try {
    let result = app.setJumpList(categories);
    // Windows refuses custom categories when the user turned off "Show recently
    // opened items"; the tasks on their own are still worth having.
    if (result === 'customCategoryAccessDeniedError' && workspaceEntries.length > 0) {
      logger.warn('JumpList', 'Windows denied the Workspaces category; installing tasks only.');
      result = app.setJumpList([{ type: 'tasks', items: tasks }]);
    }
    if (result !== 'ok') {
      installedTasks = 0;
      logger.warn('JumpList', `Windows refused the Jump List (${result}).`);
      return false;
    }
    installedTasks = tasks.length;
    logger.info(
      'JumpList',
      `Installed Jump List: ${workspaceEntries.length} workspace(s), ${tasks.length} task(s).`,
    );
    return true;
  } catch (error) {
    installedTasks = 0;
    logger.warn('JumpList', 'Failed to configure Windows Jump List', error);
    return false;
  }
}

/**
 * Configures the Windows Taskbar Jump List. `tasks` replaces the default Tasks
 * category; omitting it restores the defaults. Graceful no-op off Windows.
 */
export function setupWindowsJumpList(tasks?: DesktopUserTask[]): boolean {
  customTasks = tasks && tasks.length > 0 ? tasks : undefined;
  return render();
}

/** Replaces the Workspaces category; an empty list (signed out) removes it. */
export function setJumpListWorkspaces(list: unknown): boolean {
  const next: DesktopJumpListWorkspace[] = [];
  const seen = new Set<string>();
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const { name, slug } = entry as Partial<DesktopJumpListWorkspace>;
      if (typeof name !== 'string' || typeof slug !== 'string') continue;
      if (!name.trim() || !/^[a-z0-9][a-z0-9-_]{0,127}$/i.test(slug) || seen.has(slug)) continue;
      seen.add(slug);
      next.push({ name: name.trim(), slug });
      if (next.length >= MAX_WORKSPACES) break;
    }
  }

  const unchanged =
    next.length === workspaces.length &&
    next.every((w, i) => w.slug === workspaces[i].slug && w.name === workspaces[i].name);
  // The renderer re-sends on every workspace refetch; only rebuild on a real change.
  if (unchanged && installedTasks > 0) return true;

  workspaces = next;
  return render();
}

export function getJumpListStatus(): { supported: boolean; tasksCount: number; workspacesCount: number } {
  const supported = process.platform === 'win32';
  return {
    supported,
    tasksCount: supported ? installedTasks : 0,
    workspacesCount: supported && installedTasks > 0 ? workspaces.length : 0,
  };
}

export function clearRecentDocuments(): void {
  try {
    app.clearRecentDocuments();
    logger.info('JumpList', 'Cleared OS recent documents.');
  } catch (error) {
    logger.warn('JumpList', 'Failed to clear recent documents', error);
  }
}

export function addRecentDocument(filePath: string): void {
  if (!filePath || typeof filePath !== 'string') return;
  try {
    app.addRecentDocument(filePath);
  } catch (error) {
    logger.warn('JumpList', `Failed to add recent document: ${filePath}`, error);
  }
}
