import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

const { checkForUpdates, getUpdateStatus } = await import('./updater.js');

describe('Desktop Updater', () => {
  it('returns initial state idle or unsupported in dev mode', async () => {
    const status = await checkForUpdates(true);
    expect(status.state).toBe('unsupported');
    expect(getUpdateStatus().state).toBe('unsupported');
  });
});
