import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPath = vi.fn((name: string) => `C:\\Users\\Mock\\${name}`);
const mockGetAppPath = vi.fn(() => 'C:\\App\\OnetabAI');
const mockGetLocale = vi.fn(() => 'en-US');
const mockGetSystemLocale = vi.fn(() => 'en-US');
const mockGetPreferredSystemLanguages = vi.fn(() => ['en-US', 'en']);
const mockGetLocaleCountryCode = vi.fn(() => 'US');
const mockGetGPUFeatureStatus = vi.fn(() => ({ '2d_canvas': 'enabled', gpu_compositing: 'enabled' }));
const mockGetGPUInfo = vi.fn(async () => ({
  gpuDevice: [{ active: true, deviceString: 'NVIDIA GeForce RTX 4080' }],
}));
const mockIsHardwareAccelerationEnabled = vi.fn(() => true);
const mockGetAppMetrics = vi.fn(() => [
  {
    pid: 1234,
    type: 'Browser',
    name: 'main',
    cpu: { percentCPUUsage: 1.5 },
    memory: { workingSetSize: 45000, peakWorkingSetSize: 52000 },
  },
]);
const mockOpenPath = vi.fn(async (_path: string) => '');
const mockSetAccessibilitySupportEnabled = vi.fn();
const mockRemoveAsDefaultProtocolClient = vi.fn(() => true);

vi.mock('electron', () => ({
  app: {
    getName: vi.fn(() => 'Onetab AI'),
    getVersion: vi.fn(() => '0.0.1'),
    isPackaged: true,
    isReady: vi.fn(() => true),
    hasSingleInstanceLock: vi.fn(() => true),
    getPath: mockGetPath,
    getAppPath: mockGetAppPath,
    getLocale: mockGetLocale,
    getSystemLocale: mockGetSystemLocale,
    getPreferredSystemLanguages: mockGetPreferredSystemLanguages,
    getLocaleCountryCode: mockGetLocaleCountryCode,
    getGPUFeatureStatus: mockGetGPUFeatureStatus,
    getGPUInfo: mockGetGPUInfo,
    isHardwareAccelerationEnabled: mockIsHardwareAccelerationEnabled,
    accessibilitySupportEnabled: false,
    setAccessibilitySupportEnabled: mockSetAccessibilitySupportEnabled,
    runningUnderARM64Translation: false,
    getAppMetrics: mockGetAppMetrics,
    removeAsDefaultProtocolClient: mockRemoveAsDefaultProtocolClient,
  },
  shell: {
    openPath: mockOpenPath,
  },
}));

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock('./startup.js', () => ({
  getStartupState: vi.fn(() => ({ supported: true, openAtLogin: false, startHidden: true, launchedAtLogin: false })),
}));
vi.mock('./store.js', () => ({
  getPreference: vi.fn((_key, fallback) => fallback),
}));
vi.mock('./deep-link.js', () => ({
  listProtocolStatus: vi.fn(() => [{ scheme: 'onetab', registered: true }]),
  removeProtocolHandler: vi.fn((scheme: string) => scheme === 'onetab'),
}));
vi.mock('./jump-list.js', () => ({
  getJumpListStatus: vi.fn(() => ({ supported: true, tasksCount: 4 })),
}));

const {
  collectDiagnostics,
  openAppPath,
  getAppPathValue,
  setAccessibilitySupport,
  removeProtocol,
} = await import('./diagnostics.js');

describe('Desktop Diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collects full diagnostics snapshot including paths, metrics, gpu, and locale', async () => {
    const diag = await collectDiagnostics();

    expect(diag.identity.name).toBe('Onetab AI');
    expect(diag.identity.appPath).toBe('C:\\App\\OnetabAI');
    expect(diag.locale.countryCode).toBe('US');
    expect(diag.paths.userData).toBe('C:\\Users\\Mock\\userData');
    expect(diag.paths.downloads).toBe('C:\\Users\\Mock\\downloads');
    expect(diag.gpu.renderer).toBe('NVIDIA GeForce RTX 4080');
    expect(diag.metrics).toHaveLength(1);
    expect(diag.metrics[0].workingSetKb).toBe(45000);
    expect(diag.metrics[0].peakWorkingSetKb).toBe(52000);
    expect(diag.jumpList?.tasksCount).toBe(4);
  });

  it('getAppPathValue safely resolves paths for known keys and rejects unknown keys', () => {
    expect(getAppPathValue('logs')).toBe('C:\\Users\\Mock\\logs');
    expect(getAppPathValue('userData')).toBe('C:\\Users\\Mock\\userData');
    expect(getAppPathValue('../unsafe' as never)).toBe('');
  });

  it('openAppPath safely opens valid keys through shell.openPath', async () => {
    const success = await openAppPath('crashDumps');
    expect(success).toBe(true);
    expect(mockOpenPath).toHaveBeenCalledWith('C:\\Users\\Mock\\crashDumps');

    const invalid = await openAppPath('unknownKey' as never);
    expect(invalid).toBe(false);
  });

  it('setAccessibilitySupport invokes electron app method', () => {
    setAccessibilitySupport(true);
    expect(mockSetAccessibilitySupportEnabled).toHaveBeenCalledWith(true);
  });

  it('removeProtocol delegates to protocol handler', () => {
    expect(removeProtocol('onetab')).toBe(true);
    expect(removeProtocol('invalid')).toBe(false);
  });
});
