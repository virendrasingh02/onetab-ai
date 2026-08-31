import { useAddAccount } from '@org/auth';
import { invitationApi } from '@org/api-client';
import { isDesktop } from '@org/web-desktop';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@org/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  KeyRound,
  LogIn,
  Plus,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const [inviteToken, setInviteToken] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addAccount = useAddAccount();

  const resetForms = () => {
    setInviteToken('');
    setEmail('');
    setPassword('');
    addAccount.reset();
  };

  const close = () => {
    onOpenChange(false);
    resetForms();
  };

  const handleJoinByToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = inviteToken.trim();
    if (!token) return;

    // Handle full URLs pasted as well as bare tokens
    let cleanToken = token;
    if (token.includes('/invite/')) {
      const parts = token.split('/invite/');
      cleanToken = parts[parts.length - 1].split('?')[0].split('#')[0];
    }

    try {
      setIsJoining(true);
      const res = await invitationApi.accept(cleanToken);
      toast.success('Joined workspace successfully!');
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      close();
      navigate(`/w/${res.workspaceSlug}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not join workspace with this token.';
      toast.error(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    try {
      const data = await addAccount.mutateAsync({
        email: email.trim(),
        password,
      });
      toast.success(
        `Signed in as ${data.user.displayName ?? data.user.name}.`,
      );
      // The hook switches to the new account and navigates; just dismiss.
      close();
    } catch {
      // Error text is rendered inline from `addAccount.error` below.
    }
  };

  const addAccountError =
    addAccount.error instanceof Error ? addAccount.error.message : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border bg-surface-raised/40">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            <span>Add Another Account or Workspace</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Sign into another identity and switch between them, join a workspace
            with an invitation, or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Option 1: Sign in with another account (browser multi-account only) */}
          {!isDesktop ? (
            <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
              <div className="flex items-center gap-2">
                <LogIn className="size-4 text-primary shrink-0" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Sign in with another account
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Stay signed into this account and add a second one. Switch between
                them any time from “Manage accounts”.
              </p>
              <form onSubmit={handleAddAccount} className="space-y-2">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-8 text-xs bg-background"
                  disabled={addAccount.isPending}
                />
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-8 text-xs bg-background"
                  disabled={addAccount.isPending}
                />
                {addAccountError ? (
                  <p className="text-xs text-destructive">{addAccountError}</p>
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs w-full"
                  loading={addAccount.isPending}
                  disabled={!email.trim() || !password || addAccount.isPending}
                >
                  Sign in &amp; switch
                </Button>
              </form>
            </div>
          ) : null}

          {/* Option 2: Join with Invitation Code */}
          <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary shrink-0" />
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Join with Invitation Link or Code
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste an invitation URL or token sent to your email to link the
              workspace to your account.
            </p>
            <form onSubmit={handleJoinByToken} className="gap-2 flex">
              <Input
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="e.g. inv_abc123 or https://app/invite/..."
                className="h-8 text-xs flex-1 bg-background"
                disabled={isJoining}
              />
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs px-3"
                disabled={!inviteToken.trim() || isJoining}
              >
                {isJoining ? 'Joining…' : 'Join'}
              </Button>
            </form>
          </div>

          {/* Option 3: Create Workspace */}
          <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-2.5 flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary shrink-0" />
                <h4 className="text-xs font-semibold text-foreground">
                  Create New Workspace
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Set up a fresh workspace for a new company, project, or team.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                close();
                navigate('/workspaces/new');
              }}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              <Plus className="size-3.5" />
              <span>Create</span>
            </Button>
          </div>
        </div>

        <div className="p-3 bg-surface-raised/50 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="h-8 text-xs px-4"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
