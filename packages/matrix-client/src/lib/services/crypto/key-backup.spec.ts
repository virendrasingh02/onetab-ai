import { describe, expect, it, vi, beforeEach } from 'vitest';
import { KeyBackupManager } from './key-backup.js';

describe('KeyBackupManager', () => {
  let mockCrypto: any;
  let manager: KeyBackupManager;
  let statusListener: any;

  beforeEach(() => {
    mockCrypto = {
      getActiveSessionBackupVersion: vi.fn(),
      getKeyBackupInfo: vi.fn(),
      isKeyBackupTrusted: vi.fn(),
      createRecoveryKeyFromPassphrase: vi.fn(),
      resetKeyBackup: vi.fn(),
      restoreKeyBackupWithPassphrase: vi.fn(),
      storeSessionBackupPrivateKey: vi.fn(),
      restoreKeyBackup: vi.fn(),
    };

    statusListener = vi.fn();
    manager = new KeyBackupManager(() => mockCrypto, statusListener);
  });

  it('reports disabled backup when no backup version exists', async () => {
    mockCrypto.getActiveSessionBackupVersion.mockResolvedValue(null);

    const status = await manager.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.version).toBeNull();
    expect(status.trusted).toBe(false);
  });

  it('reports active backup with trusted status and key count', async () => {
    mockCrypto.getActiveSessionBackupVersion.mockResolvedValue('1');
    mockCrypto.getKeyBackupInfo.mockResolvedValue({ count: 42 });
    mockCrypto.isKeyBackupTrusted.mockResolvedValue({ trusted: true });

    const status = await manager.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.version).toBe('1');
    expect(status.trusted).toBe(true);
    expect(status.keyCount).toBe(42);
    expect(statusListener).toHaveBeenCalledWith(status);
  });

  it('sets up key backup with passphrase', async () => {
    mockCrypto.createRecoveryKeyFromPassphrase.mockResolvedValue({
      encodedPrivateKey: 'recovery-key-xyz',
    });
    mockCrypto.resetKeyBackup.mockResolvedValue(undefined);
    mockCrypto.getActiveSessionBackupVersion.mockResolvedValue('2');
    mockCrypto.getKeyBackupInfo.mockResolvedValue({ count: 0 });
    mockCrypto.isKeyBackupTrusted.mockResolvedValue({ trusted: true });

    const result = await manager.setupKeyBackup('my-secret-passphrase');
    expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith('my-secret-passphrase');
    expect(mockCrypto.resetKeyBackup).toHaveBeenCalled();
    expect(result.recoveryKey).toBe('recovery-key-xyz');
    expect(result.version).toBe('2');
  });

  it('restores key backup with passphrase', async () => {
    mockCrypto.restoreKeyBackupWithPassphrase.mockResolvedValue({
      total: 50,
      imported: 48,
    });

    const result = await manager.restoreKeyBackup('my-secret-passphrase');
    expect(mockCrypto.restoreKeyBackupWithPassphrase).toHaveBeenCalledWith('my-secret-passphrase');
    expect(result.total).toBe(50);
    expect(result.imported).toBe(48);
  });

  it('falls back to raw key restore if passphrase fails', async () => {
    mockCrypto.restoreKeyBackupWithPassphrase.mockRejectedValue(new Error('Invalid passphrase'));
    mockCrypto.storeSessionBackupPrivateKey.mockResolvedValue(undefined);
    mockCrypto.restoreKeyBackup.mockResolvedValue({ total: 10, imported: 10 });

    const result = await manager.restoreKeyBackup('0123456789abcdef');
    expect(mockCrypto.storeSessionBackupPrivateKey).toHaveBeenCalled();
    expect(mockCrypto.restoreKeyBackup).toHaveBeenCalled();
    expect(result.total).toBe(10);
    expect(result.imported).toBe(10);
  });
});
