import { app, shell } from 'electron';
import {
  DESKTOP_PATH_KEYS,
  type DesktopDiagnostics,
  type DesktopPathKey,
  type DesktopPlatform,
} from '../shared/ipc.js';
import { listProtocolStatus, removeProtocolHandler } from './deep-link.js';
import { getJumpListStatus } from './jump-list.js';
import { logger } from './logger.js';
import { getStartupState } from './startup.js';
import { getPreference } from './store.js';

const startedAt = Date.now();
let singleInstance = true;

/** Recorded by the entry point once the lock has been requested. */
export function setSingleInstanceHeld(held: boolean): void {
  singleInstance = held;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/** The GPU's description, when Chromium has one — absent before the first frame. */
async function readGpuRenderer(): Promise<string | null> {
  const info = (await withTimeout(app.getGPUInfo('basic'), 1500)) as {
    gpuDevice?: Array<{ active?: boolean; deviceString?: string; vendorId?: number }>;
  } | null;
  const device = info?.gpuDevice?.find((d) => d.active) ?? info?.gpuDevice?.[0];
  return device?.deviceString ?? null;
}

/** Path for a named folder, or empty string if Electron cannot resolve it on this OS. */
export function safePath(name: Parameters<typeof app.getPath>[0]): string {
  try {
    return app.getPath(name);
  } catch {
    return '';
  }
}

function safeAppPath(): string {
  try {
    return typeof app.getAppPath === 'function' ? app.getAppPath() : '';
  } catch {
    return '';
  }
}

function safeCountryCode(): string | null {
  try {
    return typeof app.getLocaleCountryCode === 'function' ? app.getLocaleCountryCode() : null;
  } catch {
    return null;
  }
}

/** One read-only snapshot for Settings and the diagnostics screen. */
export async function collectDiagnostics(): Promise<DesktopDiagnostics> {
  const renderer = await readGpuRenderer();

  const pathsRecord = {} as Record<DesktopPathKey, string>;
  for (const key of DESKTOP_PATH_KEYS) {
    pathsRecord[key] = safePath(key as Parameters<typeof app.getPath>[0]);
  }

  const isLockHeld =
    typeof app.hasSingleInstanceLock === 'function'
      ? app.hasSingleInstanceLock()
      : singleInstance;

  const osVersion =
    typeof process.getSystemVersion === 'function'
      ? process.getSystemVersion()
      : process.env['OS_VERSION'] || process.platform;

  return {
    collectedAt: new Date().toISOString(),
    identity: {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      isReady: typeof app.isReady === 'function' ? app.isReady() : true,
      appUserModelId: process.platform === 'win32' ? 'ai.onetab.desktop' : null,
      desktopName: process.platform === 'linux' ? 'onetab-ai.desktop' : null,
      appPath: safeAppPath(),
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    runtime: {
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node,
      v8: process.versions.v8,
      platform: process.platform as DesktopPlatform,
      arch: process.arch,
      osVersion,
      runningUnderTranslation: Boolean(app.runningUnderARM64Translation),
    },
    locale: {
      app: app.getLocale(),
      system: app.getSystemLocale(),
      preferred: app.getPreferredSystemLanguages(),
      countryCode: safeCountryCode(),
    },
    paths: pathsRecord,
    gpu: {
      hardwareAccelerationEnabled: app.isHardwareAccelerationEnabled(),
      hardwareAccelerationPreference: getPreference('hardwareAcceleration', true),
      featureStatus: Object.fromEntries(
        Object.entries(app.getGPUFeatureStatus()).map(([key, value]) => [key, String(value)]),
      ),
      renderer,
    },
    accessibilitySupportEnabled: app.accessibilitySupportEnabled,
    singleInstance: isLockHeld,
    startup: getStartupState(),
    protocols: listProtocolStatus(),
    jumpList: getJumpListStatus(),
    metrics: app.getAppMetrics().map((metric) => ({
      pid: metric.pid,
      type: metric.type,
      name: metric.name,
      cpuPercent: Math.round(metric.cpu.percentCPUUsage * 10) / 10,
      workingSetKb: metric.memory.workingSetSize,
      peakWorkingSetKb: (metric.memory as { peakWorkingSetSize?: number })?.peakWorkingSetSize,
    })),
  };
}

/** Resolves a named app folder without opening. */
export function getAppPathValue(key: unknown): string {
  if (typeof key !== 'string' || !(DESKTOP_PATH_KEYS as readonly string[]).includes(key)) {
    return '';
  }
  return safePath(key as Parameters<typeof app.getPath>[0]);
}

/** Reveals a named app folder in the file manager. Keys are validated, paths never accepted. */
export async function openAppPath(key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || !(DESKTOP_PATH_KEYS as readonly string[]).includes(key)) {
    logger.warn('Diagnostics', 'Rejected openPath with an unknown key');
    return false;
  }
  const target = safePath(key as Parameters<typeof app.getPath>[0]);
  if (!target) return false;
  const error = await shell.openPath(target);
  if (error) {
    logger.warn('Diagnostics', `Could not open ${key}: ${error}`);
    return false;
  }
  return true;
}

export function setAccessibilitySupport(enabled: boolean): void {
  try {
    if (typeof app.setAccessibilitySupportEnabled === 'function') {
      app.setAccessibilitySupportEnabled(enabled);
      logger.info('Diagnostics', `Accessibility support explicitly set to: ${enabled}`);
    }
  } catch (error) {
    logger.warn('Diagnostics', 'Failed to toggle accessibility support', error);
  }
}

export function removeProtocol(scheme: string): boolean {
  return removeProtocolHandler(scheme);
}
