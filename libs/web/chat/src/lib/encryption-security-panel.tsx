import type {
  Device,
  EncryptionStatus,
  KeyBackupStatus,
  VerificationRequestSummary,
} from '@org/matrix-client';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  Copy,
  Key,
  KeyRound,
  Laptop,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export function EncryptionSecurityPanel() {
  const { client, enabled } = useMatrix();

  const [encryptionStatus, setEncryptionStatus] =
    useState<EncryptionStatus | null>(null);
  const [keyBackupStatus, setKeyBackupStatus] =
    useState<KeyBackupStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);

  // Active SAS Verification state
  const [activeVerification, setActiveVerification] =
    useState<VerificationRequestSummary | null>(null);

  // Modals
  const [setupBackupOpen, setSetupBackupOpen] = useState(false);
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState<string | null>(
    null,
  );
  const [isSettingUpBackup, setIsSettingUpBackup] = useState(false);

  const [restoreBackupOpen, setRestoreBackupOpen] = useState(false);
  const [restoreKeyInput, setRestoreKeyInput] = useState('');
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  const refreshState = useCallback(async () => {
    if (!client) return;
    try {
      setIsLoading(true);
      const [encStatus, backupStatus, deviceList] = await Promise.all([
        client.getEncryptionStatus().catch(() => null),
        client.getKeyBackupStatus().catch(() => null),
        client.getDevices().catch(() => []),
      ]);
      setEncryptionStatus(encStatus);
      setKeyBackupStatus(backupStatus);
      setDevices(deviceList);
    } catch (err) {
      console.warn('Failed to load encryption details', err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    void refreshState();

    // Listen to verification requests and device updates
    const unsubscribe = client.on((event) => {
      if (event.type === 'verification.requested') {
        setActiveVerification({ ...event.request });
      } else if (event.type === 'device.updated') {
        setDevices([...event.devices]);
      }
    });

    return () => unsubscribe();
  }, [client, refreshState]);

  const handleCopyDeviceId = (deviceId: string) => {
    navigator.clipboard.writeText(deviceId);
    setCopiedDeviceId(true);
    toast.success('Device ID copied to clipboard');
    setTimeout(() => setCopiedDeviceId(false), 2000);
  };

  const handleSetupKeyBackup = async () => {
    if (!client) return;
    try {
      setIsSettingUpBackup(true);
      const result = await client.setupKeyBackup();
      setGeneratedRecoveryKey(result.recoveryKey);
      setSetupBackupOpen(true);
      await refreshState();
      toast.success('Key backup configured successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to configure key backup', { description: message });
    } finally {
      setIsSettingUpBackup(false);
    }
  };

  const handleRestoreKeyBackup = async () => {
    if (!client || !restoreKeyInput.trim()) return;
    try {
      setIsRestoringBackup(true);
      const result = await client.restoreKeyBackup(restoreKeyInput.trim());
      toast.success('Key backup restored', {
        description: `Imported ${result.imported} of ${result.total} encryption keys.`,
      });
      setRestoreBackupOpen(false);
      setRestoreKeyInput('');
      await refreshState();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid key or passphrase';
      toast.error('Failed to restore keys', { description: message });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleStartOwnVerification = async () => {
    if (!client) return;
    try {
      const summary = await client.requestOwnUserVerification();
      setActiveVerification(summary);
      toast.info('Verification request sent to your other devices');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not request verification';
      toast.error('Verification failed', { description: message });
    }
  };

  const handleRequestDeviceVerification = async (deviceId: string) => {
    if (!client) return;
    try {
      const summary = await client.requestDeviceVerification(deviceId);
      setActiveVerification(summary);
      toast.info(`Verification request sent to device ${deviceId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not request verification';
      toast.error('Verification failed', { description: message });
    }
  };

  const handleAcceptVerification = async () => {
    if (!client || !activeVerification) return;
    try {
      await client.acceptVerification(activeVerification.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not accept verification';
      toast.error('Error accepting verification', { description: message });
    }
  };

  const handleStartSas = async () => {
    if (!client || !activeVerification) return;
    try {
      await client.startVerificationSas(activeVerification.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start SAS verification';
      toast.error('Error starting SAS verification', { description: message });
    }
  };

  const handleConfirmVerification = async () => {
    if (!client || !activeVerification) return;
    try {
      await client.confirmVerification(activeVerification.id);
      toast.success('Verification confirmed! Keys are now trusted.');
      setActiveVerification(null);
      await refreshState();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Confirmation failed';
      toast.error('Verification error', { description: message });
    }
  };

  const handleRejectVerification = () => {
    if (!client || !activeVerification) return;
    try {
      client.rejectVerificationSas(activeVerification.id);
      toast.warning('Verification rejected due to mismatch');
      setActiveVerification(null);
    } catch (err) {
      console.warn('Reject error', err);
    }
  };

  const handleCancelVerification = async () => {
    if (!client || !activeVerification) return;
    try {
      await client.cancelVerification(activeVerification.id);
      setActiveVerification(null);
      toast.info('Verification cancelled');
    } catch (err) {
      console.warn('Cancel error', err);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!client) return;
    if (!window.confirm(`Revoke and remove device ${deviceId}?`)) return;
    try {
      await client.deleteDevice(deviceId);
      toast.success('Device removed');
      await refreshState();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not remove device';
      toast.error('Failed to revoke device', { description: message });
    }
  };

  if (!enabled) {
    return (
      <div className="p-6 rounded-2xl border border-border bg-surface-inset shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldAlert className="size-5" />
          <h3 className="text-sm font-semibold text-foreground">
            End-to-End Encryption Not Enabled
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Matrix encryption is disabled or no homeserver connection is available
          for this workspace session.
        </p>
      </div>
    );
  }

  const currentDevice = devices.find((d) => d.isCurrent);
  const currentDeviceId = currentDevice?.id || client?.getSession()?.deviceId || 'Unknown';
  const isCurrentVerified = currentDevice?.trust === 'verified';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Lock className="size-4 text-primary" />
          End-to-End Encryption &amp; Security
        </h2>
        <p className="text-xs mt-1 text-muted-foreground">
          Cryptographic device verification, 4S secret storage key backup, and
          session trust powered by Matrix Rust Crypto WASM.
        </p>
      </div>

      {/* 1. CURRENT SESSION & DEVICE CARD */}
      <div className="rounded-2xl border border-border bg-surface-inset shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                'size-10 rounded-xl flex items-center justify-center shrink-0 border',
                isCurrentVerified
                  ? 'border-success/30 bg-success-soft text-success-text'
                  : 'border-warning/30 bg-warning-soft text-warning-text',
              )}
            >
              {isCurrentVerified ? (
                <ShieldCheck className="size-5" />
              ) : (
                <ShieldAlert className="size-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Current Session
                </h4>
                <Badge
                  variant={isCurrentVerified ? 'success' : 'warning'}
                  className="text-[10px] py-0 h-4 font-medium"
                >
                  {isCurrentVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span>Device ID: {currentDeviceId}</span>
                <button
                  type="button"
                  onClick={() => handleCopyDeviceId(currentDeviceId)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copy Device ID"
                >
                  {copiedDeviceId ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCurrentVerified ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartOwnVerification}
                className="text-xs h-8 gap-1.5"
              >
                <Shield className="size-3.5" />
                Verify Session
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void refreshState()}
              disabled={isLoading}
              aria-label="Refresh encryption status"
            >
              <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-border/40">
            <span className="text-muted-foreground">Cross-Signing Status</span>
            <span className="font-medium text-foreground">
              {encryptionStatus?.crossSigningReady ? (
                <span className="text-success-text flex items-center gap-1">
                  <Check className="size-3 inline" /> Active &amp; Ready
                </span>
              ) : (
                <span className="text-warning-text">Not Initialized</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-border/40">
            <span className="text-muted-foreground">Crypto Engine</span>
            <span className="font-medium text-foreground">
              Rust Crypto WASM (v18.4)
            </span>
          </div>
        </div>
      </div>

      {/* 2. SAS VERIFICATION ACTIVE MODAL / CARD */}
      {activeVerification ? (
        <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 shadow-xs p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">
                Device Verification in Progress
              </h4>
            </div>
            <Badge variant="neutral" className="capitalize text-[10px]">
              {activeVerification.phase}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Verifying with{' '}
            <strong className="text-foreground">
              {activeVerification.otherDeviceId || activeVerification.otherUserId}
            </strong>
          </p>

          {activeVerification.phase === 'requested' ? (
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleAcceptVerification}
                className="text-xs h-8"
              >
                Accept Request
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelVerification}
                className="text-xs h-8"
              >
                Decline
              </Button>
            </div>
          ) : null}

          {activeVerification.phase === 'ready' ? (
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleStartSas}
                className="text-xs h-8"
              >
                Compare Emoji
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelVerification}
                className="text-xs h-8"
              >
                Cancel
              </Button>
            </div>
          ) : null}

          {activeVerification.phase === 'started' && activeVerification.emoji ? (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-foreground font-medium">
                Verify that both devices show these 7 emoji in this exact order:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 p-3 bg-surface rounded-xl border border-border">
                {activeVerification.emoji.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-surface-raised border border-border/60 text-center"
                  >
                    <span className="text-2xl select-none" role="img" aria-label={item.name}>
                      {item.symbol}
                    </span>
                    <span className="text-[11px] font-medium text-foreground mt-1 truncate max-w-full capitalize">
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  size="sm"
                  onClick={handleConfirmVerification}
                  className="text-xs h-8 gap-1.5"
                >
                  <Check className="size-3.5" />
                  They Match
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRejectVerification}
                  className="text-xs h-8"
                >
                  They Don&apos;t Match
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelVerification}
                  className="text-xs h-8 text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {activeVerification.phase === 'done' ? (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-success font-medium flex items-center gap-1.5">
                <Check className="size-4" /> Verification Complete!
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveVerification(null)}
                className="text-xs h-8"
              >
                Dismiss
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 3. KEY BACKUP & 4S RECOVERY CARD */}
      <div className="rounded-2xl border border-border bg-surface-inset shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl flex items-center justify-center shrink-0 border border-border bg-surface-raised text-foreground">
              <KeyRound className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Key Backup &amp; Recovery (4S)
                </h4>
                <Badge
                  variant={keyBackupStatus?.enabled ? 'success' : 'neutral'}
                  className="text-[10px] py-0 h-4 font-medium"
                >
                  {keyBackupStatus?.enabled ? 'Active' : 'Not Configured'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground max-w-lg">
                Securely backs up your Olm and Megolm conversation decryption keys
                to the homeserver so your message history survives device logouts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {keyBackupStatus?.enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreBackupOpen(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Key className="size-3.5" />
                Restore Keys
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetupKeyBackup}
                loading={isSettingUpBackup}
                className="text-xs h-8 gap-1.5"
              >
                <Shield className="size-3.5" />
                Set Up Key Backup
              </Button>
            )}
          </div>
        </div>

        {keyBackupStatus?.enabled ? (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-border/40 text-xs">
            <span className="text-muted-foreground">
              Backup Version: {keyBackupStatus.version || '1'}
            </span>
            <span className="text-muted-foreground">
              {keyBackupStatus.keyCount !== undefined
                ? `${keyBackupStatus.keyCount} keys stored`
                : 'Active on homeserver'}
            </span>
          </div>
        ) : null}
      </div>

      {/* 4. OTHER KNOWN DEVICES LIST */}
      <div className="rounded-2xl border border-border bg-surface-inset shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">
            Registered Devices ({devices.length})
          </h4>
        </div>

        <div className="divide-y divide-border/40">
          {devices.map((device) => {
            const isVerified = device.trust === 'verified';
            return (
              <div
                key={device.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg flex items-center justify-center border border-border bg-surface text-muted-foreground">
                    {device.displayName?.toLowerCase().includes('mobile') ? (
                      <Smartphone className="size-4" />
                    ) : (
                      <Laptop className="size-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {device.displayName || 'OneTab Web Client'}
                      </span>
                      {device.isCurrent ? (
                        <Badge variant="primary" className="text-[9px] py-0 h-4">
                          Current
                        </Badge>
                      ) : null}
                      <Badge
                        variant={isVerified ? 'success' : 'neutral'}
                        className="text-[9px] py-0 h-4 font-normal"
                      >
                        {isVerified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {device.id}
                      {device.lastSeenAt
                        ? ` · Seen ${new Date(device.lastSeenAt).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!device.isCurrent && !isVerified ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRequestDeviceVerification(device.id)}
                      className="text-xs h-7 gap-1"
                    >
                      <Shield className="size-3" />
                      Verify
                    </Button>
                  ) : null}
                  {!device.isCurrent ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteDevice(device.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove device"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: GENERATED RECOVERY KEY */}
      <Dialog open={setupBackupOpen} onOpenChange={setSetupBackupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Key Backup Recovery Key</DialogTitle>
            <DialogDescription>
              Your key backup has been created. Store this recovery key in a
              secure password manager. You will need it to restore your chat history
              on a new device.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Secret Recovery Key
            </span>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-mono select-all break-all text-foreground">
                {generatedRecoveryKey}
              </code>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => {
                  if (generatedRecoveryKey) {
                    navigator.clipboard.writeText(generatedRecoveryKey);
                    setCopiedKey(true);
                    toast.success('Recovery key copied to clipboard');
                    setTimeout(() => setCopiedKey(false), 2000);
                  }
                }}
              >
                {copiedKey ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setSetupBackupOpen(false)} className="text-xs">
              I have saved this key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: RESTORE FROM BACKUP */}
      <Dialog open={restoreBackupOpen} onOpenChange={setRestoreBackupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restore Keys from Backup</DialogTitle>
            <DialogDescription>
              Enter your recovery key or passphrase to restore session decryption keys
              from the homeserver.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              type="password"
              placeholder="Enter recovery key or passphrase…"
              value={restoreKeyInput}
              onChange={(e) => setRestoreKeyInput(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestoreBackupOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRestoreKeyBackup}
              loading={isRestoringBackup}
              disabled={!restoreKeyInput.trim()}
              className="text-xs"
            >
              Restore Keys
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
