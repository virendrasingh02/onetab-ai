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
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
        <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-white">
            <Laptop className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Sign in to Desktop</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Please sign in on your mobile device to authorize this desktop connection.
            </p>
          </div>
          {userCode && (
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm font-semibold tracking-wider text-white">
              Pairing Code: {userCode}
            </div>
          )}
          <p className="text-xs text-zinc-400">
            Sign in with your OneTab AI account to link this desktop application session.
          </p>
          <button
            type="button"
            className="w-full h-10 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs sm:text-sm transition-colors"
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
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
        <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-14 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Desktop Signed In</h1>
            <p className="text-xs text-zinc-400 mt-1">
              You&apos;re now signed in to OneTab AI Desktop.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-xs space-y-2 text-left">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Signed in as</span>
              <span className="font-medium text-white">{authUser?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Device</span>
              <span className="font-medium text-white">
                {deviceInfo?.deviceInfo.platform || 'Desktop Client'}
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            You can safely close this browser window or return to your mobile app.
          </p>
          <button
            type="button"
            className="w-full h-10 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs sm:text-sm transition-colors"
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
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
        <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-rose-400">
            <XCircle className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Sign In Cancelled</h1>
            <p className="text-xs text-zinc-400 mt-1">
              The desktop authentication request was cancelled.
            </p>
          </div>
          <button
            type="button"
            className="w-full h-10 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs sm:text-sm font-medium transition-colors"
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
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
        <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-xl p-6 shadow-2xl text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-amber-400">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Sign-In Request Unavailable</h1>
            <p className="text-xs text-rose-400 mt-1">
              {error || 'This device sign-in request is invalid or has expired.'}
            </p>
          </div>
          <p className="text-xs text-zinc-400">
            Please generate a new QR code or pairing code on your desktop computer and try again.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Link
              to="/auth/pair"
              className="w-full h-10 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center"
            >
              Enter a Pairing Code
            </Link>
            <Link
              to="/"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
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
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
        <div className="text-center pb-2">
          <div className="mx-auto size-14 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center mb-3 text-white">
            <Monitor className="size-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Sign in to Desktop</h1>
          <p className="text-xs text-zinc-400 mt-1">
            You&apos;re authorizing a sign-in session for OneTab AI Desktop.
          </p>
        </div>

        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" /> Account
              </span>
              <span className="font-semibold text-white truncate max-w-[200px]">
                {authUser?.email}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[11px]">Device</span>
                <p className="font-medium text-white flex items-center gap-1">
                  <Laptop className="size-3.5 text-zinc-400" />
                  <span>{deviceInfo.deviceInfo.platform}</span>
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[11px]">Client</span>
                <p className="font-medium text-white">
                  {deviceInfo.deviceInfo.clientName}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[11px]">Pairing Code</span>
                <p className="font-mono font-bold text-white tracking-wider">
                  {deviceInfo.userCode}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[11px]">Network</span>
                <p className="text-zinc-300 flex items-center gap-1 truncate">
                  <Globe className="size-3.5 text-zinc-500" />
                  <span>{deviceInfo.deviceInfo.ip || 'Local Network'}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 text-center px-2">
            Only confirm this request if you initiated it on your own computer.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            className="w-full h-10 rounded-lg bg-white text-black hover:bg-zinc-200 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={handleApprove}
            disabled={approving || rejecting}
          >
            <Shield className="size-4" />
            <span>{approving ? 'Confirming…' : 'Confirm Sign In'}</span>
          </button>

          <button
            type="button"
            className="w-full h-9 rounded-lg text-xs text-zinc-400 hover:text-rose-400 transition-colors"
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

