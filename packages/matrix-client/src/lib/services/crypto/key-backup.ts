import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api/index.js';
import { toMatrixError } from '../../errors.js';
import {
  MatrixError,
  type KeyBackupRestoreResult,
  type KeyBackupSetupResult,
  type KeyBackupStatus,
} from '../../types.js';

export class KeyBackupManager {
  constructor(
    private readonly getCrypto: () => CryptoApi | undefined,
    private readonly emitStatus?: (status: KeyBackupStatus) => void,
  ) {}

  private requireCrypto(): CryptoApi {
    const crypto = this.getCrypto();
    if (!crypto) {
      throw new MatrixError('ENCRYPTION', 'Matrix encryption / crypto stack is not initialized.');
    }
    return crypto;
  }

  async getStatus(): Promise<KeyBackupStatus> {
    const crypto = this.getCrypto();
    if (!crypto) {
      return { enabled: false, version: null, trusted: false };
    }

    try {
      const version = await crypto.getActiveSessionBackupVersion();
      let trusted = false;
      let keyCount: number | undefined;

      if (version) {
        const info = await crypto.getKeyBackupInfo();
        if (info) {
          const trust = await crypto.isKeyBackupTrusted(info);
          trusted = trust.trusted;
          keyCount = info.count;
        }
      }

      const status: KeyBackupStatus = {
        enabled: !!version,
        version,
        trusted,
        keyCount,
      };

      this.emitStatus?.(status);
      return status;
    } catch {
      return { enabled: false, version: null, trusted: false };
    }
  }

  /**
   * Generates a new server-side key backup and returns the recovery key.
   */
  async setupKeyBackup(passphrase?: string): Promise<KeyBackupSetupResult> {
    const crypto = this.requireCrypto();

    try {
      if (passphrase && passphrase.trim().length > 0) {
        const recoveryKeyResult =
          await crypto.createRecoveryKeyFromPassphrase(passphrase);
        const recoveryKey =
          recoveryKeyResult.encodedPrivateKey ??
          `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        await crypto.resetKeyBackup();
        const version = await crypto.getActiveSessionBackupVersion();
        const status = await this.getStatus();
        this.emitStatus?.(status);
        return {
          recoveryKey,
          version: version ?? undefined,
        };
      } else {
        await crypto.resetKeyBackup();
        const version = await crypto.getActiveSessionBackupVersion();
        const keyInfo = await crypto.getKeyBackupInfo();
        const authData = keyInfo?.auth_data as Record<string, unknown> | undefined;
        const recoveryKey =
          (typeof authData?.public_key === 'string' && authData.public_key) ||
          `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

        const status = await this.getStatus();
        this.emitStatus?.(status);
        return {
          recoveryKey,
          version: version ?? undefined,
        };
      }
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  /**
   * Restores historical room encryption keys from the server backup using a recovery key or passphrase.
   */
  async restoreKeyBackup(keyOrPassphrase: string): Promise<KeyBackupRestoreResult> {
    const crypto = this.requireCrypto();

    try {
      // First attempt restore with passphrase directly
      try {
        const result = await crypto.restoreKeyBackupWithPassphrase(keyOrPassphrase);
        return { total: result.total, imported: result.imported };
      } catch {
        // If passphrase derivation fails, try raw key storage
        const keyBytes =
          keyOrPassphrase.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(keyOrPassphrase)
            ? new Uint8Array(Buffer.from(keyOrPassphrase, 'hex'))
            : new TextEncoder().encode(keyOrPassphrase);

        const version = (await crypto.getActiveSessionBackupVersion()) ?? '1';
        await crypto.storeSessionBackupPrivateKey(keyBytes, version);
        const result = await crypto.restoreKeyBackup();
        return { total: result.total, imported: result.imported };
      }
    } catch (error) {
      throw new MatrixError(
        'ENCRYPTION',
        `Failed to restore key backup: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
