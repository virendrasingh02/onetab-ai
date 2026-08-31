import { authApi } from '@org/api-client';
import type { DeviceAuthInfoResponse } from '@org/validation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  LoadingState,
} from '@org/ui';
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Laptop className="size-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Sign in to Desktop</CardTitle>
            <CardDescription className="text-xs">
              Please sign in on your mobile device to authorize this desktop connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 text-center">
            {userCode && (
              <div className="p-3 bg-surface-muted rounded-lg font-mono text-sm font-semibold tracking-wider">
                Pairing Code: {userCode}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Sign in with your OneTab AI account to link this desktop application session.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                navigate('/login', { state: { from: location } });
              }}
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-lg border-border text-center">
          <CardHeader className="pb-2">
            <div className="mx-auto size-14 rounded-full bg-success/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="size-8 text-success" />
            </div>
            <CardTitle className="text-xl">Desktop Signed In</CardTitle>
            <CardDescription className="text-xs">
              You&apos;re now signed in to OneTab AI Desktop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="rounded-lg border border-border/80 bg-surface-muted/40 p-4 text-xs space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Signed in as</span>
                <span className="font-medium text-foreground">{authUser?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Device</span>
                <span className="font-medium text-foreground">
                  {deviceInfo?.deviceInfo.platform || 'Desktop Client'}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You can safely close this browser window or return to your mobile app.
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <Button className="w-full" onClick={() => navigate('/')}>
              Done
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // REJECTED STATE
  if (rejected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-lg border-border text-center">
          <CardHeader className="pb-2">
            <div className="mx-auto size-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <XCircle className="size-6 text-destructive" />
            </div>
            <CardTitle className="text-lg">Sign In Cancelled</CardTitle>
            <CardDescription className="text-xs">
              The desktop authentication request was cancelled.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ERROR / EXPIRED STATE
  if (error || !deviceInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-lg border-border text-center">
          <CardHeader className="pb-2">
            <div className="mx-auto size-12 rounded-full bg-warning/10 flex items-center justify-center mb-3">
              <AlertCircle className="size-6 text-warning-text" />
            </div>
            <CardTitle className="text-lg">Sign-In Request Unavailable</CardTitle>
            <CardDescription className="text-xs text-warning-text">
              {error || 'This device sign-in request is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Please generate a new QR code or pairing code on your desktop computer and try again.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" asChild className="w-full text-xs">
                <Link to="/auth/pair">Enter a Pairing Code</Link>
              </Button>
              <Button variant="ghost" asChild className="w-full text-xs text-muted-foreground">
                <Link to="/">Return to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // CONFIRMATION UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-border">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto size-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Monitor className="size-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Sign in to Desktop</CardTitle>
          <CardDescription className="text-xs">
            You&apos;re authorizing a sign-in session for OneTab AI Desktop.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-success" /> Account
              </span>
              <span className="font-semibold text-foreground truncate max-w-[200px]">
                {authUser?.email}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[11px]">Device</span>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Laptop className="size-3.5 text-primary" />
                  <span>{deviceInfo.deviceInfo.platform}</span>
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[11px]">Client</span>
                <p className="font-medium text-foreground">
                  {deviceInfo.deviceInfo.clientName}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[11px]">Pairing Code</span>
                <p className="font-mono font-bold text-foreground tracking-wider">
                  {deviceInfo.userCode}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[11px]">Network</span>
                <p className="text-foreground flex items-center gap-1 truncate">
                  <Globe className="size-3.5 text-muted-foreground" />
                  <span>{deviceInfo.deviceInfo.ip || 'Local Network'}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center px-2">
            Only confirm this request if you initiated it on your own computer.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full h-10 font-semibold gap-2"
            onClick={handleApprove}
            loading={approving}
            disabled={rejecting}
          >
            <Shield className="size-4" />
            <span>Confirm Sign In</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground hover:text-destructive"
            onClick={handleReject}
            loading={rejecting}
            disabled={approving}
          >
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
