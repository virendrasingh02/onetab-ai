import { app, shell } from 'electron';
import {
  DESKTOP_PATH_KEYS,
  type DesktopDiagnostics,
  type DesktopPathKey,
  type DesktopPlatform,
} from '../shared/ipc.js';
import { listProtocolStatus } from './deep-link.js';
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

/** Path for a named folder, or null if Electron cannot resolve it on this OS. */
function safePath(name: Parameters<typeof app.getPath>[0]): string {
  try {
    return app.getPath(name);
  } catch {
    return '';
  }
}

/** One read-only snapshot for Settings and the diagnostics screen. */
export async function collectDiagnostics(): Promise<DesktopDiagnostics> {
  const renderer = await readGpuRenderer();

  return {
    collectedAt: new Date().toISOString(),
    identity: {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      isReady: app.isReady(),
      appUserModelId: process.platform === 'win32' ? 'ai.onetab.desktop' : null,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    runtime: {
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node,
      v8: process.versions.v8,
      platform: process.platform as DesktopPlatform,
      arch: process.arch,
      osVersion: process.getSystemVersion(),
      runningUnderTranslation: Boolean(app.runningUnderARM64Translation),
    },
    locale: {
      app: app.getLocale(),
      system: app.getSystemLocale(),
      preferred: app.getPreferredSystemLanguages(),
    },
    paths: {
      userData: safePath('userData'),
      sessionData: safePath('sessionData'),
      logs: safePath('logs'),
      crashDumps: safePath('crashDumps'),
      temp: safePath('temp'),
    },
    gpu: {
      hardwareAccelerationEnabled: app.isHardwareAccelerationEnabled(),
      hardwareAccelerationPreference: getPreference('hardwareAcceleration', true),
      featureStatus: Object.fromEntries(
        Object.entries(app.getGPUFeatureStatus()).map(([key, value]) => [key, String(value)]),
      ),
      renderer,
    },
    accessibilitySupportEnabled: app.accessibilitySupportEnabled,
    singleInstance,
    startup: getStartupState(),
    protocols: listProtocolStatus(),
    metrics: app.getAppMetrics().map((metric) => ({
      pid: metric.pid,
      type: metric.type,
      name: metric.name,
      cpuPercent: Math.round(metric.cpu.percentCPUUsage * 10) / 10,
      workingSetKb: metric.memory.workingSetSize,
    })),
  };
}

/** Reveals a named app folder in the file manager. Keys are validated, paths never accepted. */
export async function openAppPath(key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || !(DESKTOP_PATH_KEYS as readonly string[]).includes(key)) {
    logger.warn('Diagnostics', 'Rejected openPath with an unknown key');
    return false;
  }
  const target = safePath(key as DesktopPathKey);
  if (!target) return false;
  const error = await shell.openPath(target);
  if (error) {
    logger.warn('Diagnostics', `Could not open ${key}: ${error}`);
    return false;
  }
  return true;
}
