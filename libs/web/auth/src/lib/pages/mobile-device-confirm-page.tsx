import { authApi } from '@org/api-client';
import type { DeviceAuthInfoResponse } from '@org/validation';
import { LoadingState } from '@org/ui';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Laptop,
  Monitor,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../auth.store.js';


export function MobileDeviceConfirmPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request') || searchParams.get('requestId') || undefined;
  const userCode = searchParams.get('code') || undefined;

  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  const [loading, setLoading] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<DeviceAuthInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    if (!requestId && !userCode) {
      setError('No device authorization request ID or pairing code provided.');
      setLoading(false);
      return;
    }

    let active = true;
    async function loadInfo() {
      try {
        setLoading(true);
        setError(null);
        const res = await authApi.getDeviceAuthInfo({ requestId, code: userCode });
        if (active) {
          setDeviceInfo(res);
          if (res.status === 'approved') setApproved(true);
          if (res.status === 'rejected') setRejected(true);
          if (res.status === 'expired') setError('This sign-in request has expired.');
          if (res.status === 'consumed') setError('This request has already been used.');
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Invalid or expired sign-in request.';
          setError(msg);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInfo();

    return () => {
      active = false;
    };
  }, [requestId, userCode]);

  // If user is unauthenticated, redirect to login while preserving device request parameters
  if (authStatus === 'anonymous' || (!authUser && authStatus !== 'authenticating' && authStatus !== 'idle')) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-surface-raised border border-border flex items-center justify-center text-foreground">
            <Laptop className="size-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Sign in to Desktop</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Please sign in on your mobile device to authorize this desktop connection.
            </p>
          </div>
          {userCode && (
            <div className="p-3 bg-surface-raised border border-border rounded-lg font-mono text-sm font-semibold tracking-wider text-foreground">
              Pairing Code: {userCode}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Sign in with your OneTab AI account to link this desktop application session.
          </p>
          <button
            type="button"
            className="w-full h-10 rounded-btn bg-primary text-primary-foreground hover:bg-primary-hover font-medium text-xs sm:text-sm transition-colors"
            onClick={() => {
              navigate('/login', { state: { from: location } });
            }}
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingState fullPage label="Verifying desktop connection request…" />;
  }

  const handleApprove = async () => {
    try {
      setApproving(true);
      setError(null);
      await authApi.approveDeviceAuth({
        requestId: deviceInfo?.requestId || requestId,
        code: deviceInfo?.userCode || userCode,
      });
      setApproved(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve desktop sign-in request.';
      setError(msg);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    try {
      setRejecting(true);
      await authApi.rejectDeviceAuth({
        requestId: deviceInfo?.requestId || requestId,
        code: deviceInfo?.userCode || userCode,
      });
      setRejected(true);
    } finally {
      setRejecting(false);
    }
  };

  // SUCCESS STATE
  if (approved) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-14 rounded-full bg-surface-raised border border-border flex items-center justify-center text-success-text">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Desktop Signed In</h1>
            <p className="text-xs text-muted-foreground mt-1">
              You&apos;re now signed in to OneTab AI Desktop.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-raised/60 p-4 text-xs space-y-2 text-left">
            <div className="flex justify-between items-center">
              <span className="text-subtle">Signed in as</span>
              <span className="font-medium text-foreground">{authUser?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-subtle">Device</span>
              <span className="font-medium text-foreground">
                {deviceInfo?.deviceInfo.platform || 'Desktop Client'}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            You can safely close this browser window or return to your mobile app.
          </p>
          <button
            type="button"
            className="w-full h-10 rounded-btn bg-primary text-primary-foreground hover:bg-primary-hover font-medium text-xs sm:text-sm transition-colors"
            onClick={() => navigate('/')}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // REJECTED STATE
  if (rejected) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-surface-raised border border-border flex items-center justify-center text-destructive">
            <XCircle className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Sign In Cancelled</h1>
            <p className="text-xs text-muted-foreground mt-1">
              The desktop authentication request was cancelled.
            </p>
          </div>
          <button
            type="button"
            className="w-full h-10 rounded-btn border border-border hover:bg-selected text-foreground text-xs sm:text-sm font-medium transition-colors"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ERROR / EXPIRED STATE
  if (error || !deviceInfo) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-surface-raised border border-border flex items-center justify-center text-warning">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Sign-In Request Unavailable</h1>
            <p className="text-xs text-destructive mt-1">
              {error || 'This device sign-in request is invalid or has expired.'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Please generate a new QR code or pairing code on your desktop computer and try again.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Link
              to="/auth/pair"
              className="w-full h-10 rounded-btn border border-border hover:bg-selected text-foreground text-xs sm:text-sm font-medium transition-colors flex items-center justify-center"
            >
              Enter a Pairing Code
            </Link>
            <Link
              to="/"
              className="text-xs text-subtle hover:text-foreground transition-colors py-1"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }


  // CONFIRMATION UI
  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl space-y-4">
        <div className="text-center pb-2">
          <div className="mx-auto size-14 rounded-full bg-surface-raised border border-border flex items-center justify-center mb-3 text-foreground">
            <Monitor className="size-7 text-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Sign in to Desktop</h1>
          <p className="text-xs text-muted-foreground mt-1">
            You&apos;re authorizing a sign-in session for OneTab AI Desktop.
          </p>
        </div>

        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-border bg-surface-raised/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-success-text" /> Account
              </span>
              <span className="font-semibold text-foreground truncate max-w-[200px]">
                {authUser?.email}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-subtle text-[11px]">Device</span>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Laptop className="size-3.5 text-muted-foreground" />
                  <span>{deviceInfo.deviceInfo.platform}</span>
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-subtle text-[11px]">Client</span>
                <p className="font-medium text-foreground">
                  {deviceInfo.deviceInfo.clientName}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-subtle text-[11px]">Pairing Code</span>
                <p className="font-mono font-bold text-foreground tracking-wider">
                  {deviceInfo.userCode}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-subtle text-[11px]">Network</span>
                <p className="text-foreground flex items-center gap-1 truncate">
                  <Globe className="size-3.5 text-subtle" />
                  <span>{deviceInfo.deviceInfo.ip || 'Local Network'}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-subtle text-center px-2">
            Only confirm this request if you initiated it on your own computer.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            className="w-full h-10 rounded-btn bg-primary text-primary-foreground hover:bg-primary-hover font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={handleApprove}
            disabled={approving || rejecting}
          >
            <Shield className="size-4" />
            <span>{approving ? 'Confirming…' : 'Confirm Sign In'}</span>
          </button>

          <button
            type="button"
            className="w-full h-9 rounded-lg text-xs text-muted-foreground hover:text-destructive transition-colors"
            onClick={handleReject}
            disabled={approving || rejecting}
          >
            {rejecting ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

