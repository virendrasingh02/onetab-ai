import { app, type Task } from 'electron';
import { logger } from './logger.js';
import type { DesktopUserTask } from '../shared/ipc.js';

const DEFAULT_JUMP_LIST_TASKS: DesktopUserTask[] = [
  {
    title: 'New Channel',
    description: 'Create a new conversation or channel',
    arguments: 'onetab://channels/new',
  },
  {
    title: 'Ask AI Assistant',
    description: 'Open Onetab AI Copilot',
    arguments: 'onetab://ai',
  },
  {
    title: 'Search',
    description: 'Search workspace messages, docs, and channels',
    arguments: 'onetab://search',
  },
  {
    title: 'Settings',
    description: 'Open application preferences',
    arguments: 'onetab://settings',
  },
];

let tasksInstalled = false;

/**
 * Configures the Windows Taskbar Jump List (tasks shown on right-click).
 * Only supported on Windows. Graceful no-op on macOS and Linux.
 */
export function setupWindowsJumpList(customTasks?: DesktopUserTask[]): boolean {
  if (process.platform !== 'win32') return false;

  const tasksToInstall = customTasks ?? DEFAULT_JUMP_LIST_TASKS;

  try {
    const electronTasks: Task[] = tasksToInstall.map((task) => ({
      program: task.program || process.execPath,
      arguments: task.arguments || '',
      title: task.title,
      description: task.description || '',
      iconPath: task.iconPath || process.execPath,
      iconIndex: task.iconIndex ?? 0,
    }));

    const success = app.setUserTasks(electronTasks);
    tasksInstalled = success;
    if (success) {
      logger.info('JumpList', `Successfully installed ${electronTasks.length} Windows Jump List tasks.`);
    } else {
      logger.warn('JumpList', 'OS refused to set Windows Jump List tasks.');
    }
    return success;
  } catch (error) {
    logger.warn('JumpList', 'Failed to configure Windows Jump List', error);
    return false;
  }
}

export function getJumpListStatus(): { supported: boolean; tasksCount: number } {
  const supported = process.platform === 'win32';
  return {
    supported,
    tasksCount: supported && tasksInstalled ? DEFAULT_JUMP_LIST_TASKS.length : 0,
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
