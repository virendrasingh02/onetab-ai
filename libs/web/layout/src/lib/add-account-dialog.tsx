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
import { invitationApi } from '@org/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, LogIn, Mail, Plus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const [inviteToken, setInviteToken] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      onOpenChange(false);
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

  const handleSignInAnother = () => {
    onOpenChange(false);
    navigate('/login');
  };

  const handleCreateNewWorkspace = () => {
    onOpenChange(false);
    navigate('/workspaces/new');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border bg-surface-raised/40">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            <span>Add Another Account or Workspace</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Join a new workspace using an invitation link, sign into another identity, or create a new workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Option 1: Join with Invitation Code */}
          <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary shrink-0" />
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Join with Invitation Link or Code
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste an invitation URL or token sent to your email to link the workspace to your account.
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

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Option 2: Sign In with Another Identity */}
            <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <LogIn className="size-4 text-primary shrink-0" />
                  <h4 className="text-xs font-semibold text-foreground">
                    Switch Account
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign in with a different email address or organization SSO.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignInAnother}
                className="h-8 text-xs w-full gap-1.5"
              >
                <Mail className="size-3.5" />
                <span>Sign in with another email</span>
              </Button>
            </div>

            {/* Option 3: Create Workspace */}
            <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-2.5 flex flex-col justify-between">
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
                onClick={handleCreateNewWorkspace}
                className="h-8 text-xs w-full gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Create a workspace</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="p-3 bg-surface-raised/50 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs px-4"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
