import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormError,
  Input,
  toast,
} from '@org/ui';
import { enterpriseIdentityApi, setAccessToken } from '@org/api-client';
import { Building2, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth.store.js';

export function SSOLoginPanel() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Break-glass emergency modal
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setLookupError('Please enter your corporate email address.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);

    try {
      const res = await enterpriseIdentityApi.lookupSSO(email.trim().toLowerCase());
      if (!res.ssoAvailable || !res.organizationId) {
        setLookupError('Single sign-on is not configured for your domain. Please use your standard email and password to log in.');
        return;
      }

      // Redirect to appropriate IdP initiation route
      const apiUrl = typeof window !== 'undefined' ? window.location.origin : '';
      if (res.providerType === 'OIDC') {
        window.location.href = `${apiUrl}/api/v1/auth/sso/oidc/start?orgId=${encodeURIComponent(res.organizationId)}`;
      } else {
        window.location.href = `${apiUrl}/api/v1/auth/sso/saml/start?orgId=${encodeURIComponent(res.organizationId)}`;
      }
    } catch (err: any) {
      setLookupError(err.message || 'Could not verify single sign-on availability.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleRecoveryLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim() || !recoveryCode.trim()) {
      setRecoveryError('Please provide both your administrator email and recovery code.');
      return;
    }

    setIsSubmittingRecovery(true);
    setRecoveryError(null);

    try {
      const res = await enterpriseIdentityApi.recoveryLogin({
        email: recoveryEmail.trim().toLowerCase(),
        recoveryCode: recoveryCode.trim(),
      });

      if ('accessToken' in res && res.accessToken) {
        setAccessToken(res.accessToken);
        setSession(res.user as any, res.accessToken);
        toast.success('Emergency administrator session verified.');
        setIsRecoveryOpen(false);
        navigate('/');
      } else {
        setRecoveryError('Invalid recovery response.');
      }
    } catch (err: any) {
      setRecoveryError(err.message || 'Invalid or expired recovery key.');
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  return (
    <>
      <div className="w-full">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="w-full h-10 text-xs font-semibold border-border hover:bg-surface-muted/50 flex items-center justify-center gap-2"
        >
          <Building2 className="size-4 text-muted-foreground" />
          Sign in with Enterprise SSO
        </Button>
      </div>

      {/* Modal: SSO Lookup */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Enterprise Single Sign-On
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter your corporate email address. We will detect your organization's Identity Provider (Microsoft Entra ID, Okta, Google Workspace).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLookup} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Work Email</label>
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="text-xs h-9"
              />
            </div>

            {lookupError && <FormError error={lookupError} />}

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsRecoveryOpen(true);
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted text-left"
              >
                Emergency Admin Break-Glass?
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isLookingUp} className="text-xs font-semibold">
                  {isLookingUp ? (
                    <>
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="size-3.5 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Break-Glass Recovery */}
      <Dialog open={isRecoveryOpen} onOpenChange={setIsRecoveryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-500">
              <KeyRound className="size-4" />
              Emergency Break-Glass Recovery Login
            </DialogTitle>
            <DialogDescription className="text-xs">
              For authorized workspace administrators locked out during an IdP outage. Requires your emergency 32-character key.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecoveryLogin} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Administrator Email</label>
              <Input
                type="email"
                required
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="admin@company.com"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Emergency Recovery Key</label>
              <Input
                type="password"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="32-character recovery key"
                className="text-xs h-9 font-mono"
              />
            </div>

            {recoveryError && <FormError error={recoveryError} />}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRecoveryOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmittingRecovery}
                className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSubmittingRecovery ? 'Verifying...' : 'Authenticate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
