import type { CurrentUser } from '@org/types';
import {
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  toast,
  UserAvatar,
  useStatusModalStore,
} from '@org/ui';
import { useAccounts, useLogout, useRemoveAccount } from '@org/auth';
import { usePresence } from '@org/realtime';
import { cn } from '@org/utils';
import {
  isDesktop,
  NO_DRAG,
  openDesktopApp,
  openExternal,
  useAppDownload,
} from '@org/web-desktop';
import {
  CreditCard,
  Download,
  Laptop,
  Settings,
  Sliders,
  Smartphone,
  Smile,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface AccountMenuProps {
  user: CurrentUser;
  workspaceSlug: string;
  /** Names the workspace in the sign-out item. */
  workspaceName?: string;
  /** Where the menu opens: below the header, or beside the app rail. */
  side?: 'bottom' | 'right';
  className?: string;
}

/** The signed-in user's avatar and the menu it opens. */
export function AccountMenu({
  user,
  workspaceSlug,
  workspaceName,
  side = 'bottom',
  className,
}: AccountMenuProps) {
  const logout = useLogout();
  const removeAccount = useRemoveAccount();
  const { accounts, activeAccountId } = useAccounts();
  const navigate = useNavigate();
  const { environment, primaryOption, trackDownload } = useAppDownload();
  const openStatusModal = useStatusModalStore((s) => s.openStatusModal);

  // Live, server-backed presence (heartbeat + SSE), not local state. Before
  // the first heartbeat lands the map has no entry for us — we're plainly
  // here, so show active rather than "offline".
  const { status: selfStatus, setManualAway } = usePresence(user.id);
  const isSelfAway = selfStatus === 'away';

  const handleToggleAway = async () => {
    const goingAway = !isSelfAway;
    try {
      await setManualAway(goingAway);
      toast.success(goingAway ? 'Status set to away' : 'Status set to active');
    } catch {
      toast.error('Could not update your status. Please try again.');
    }
  };

  const handle = `@${user.username || user.email.split('@')[0]}`;

  return (
    <DropdownMenu>
      <Hint side={side} label="Account">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            style={NO_DRAG}
            className={cn(
              'flex touch-target cursor-pointer items-center justify-center rounded-full transition-transform outline-none hover:scale-105 focus-visible:ring-1 focus-visible:ring-ring',
              className,
            )}
            aria-label="Account menu"
          >
            <UserAvatar
              name={user.displayName ?? user.name}
              src={user.avatarUrl}
              seed={user.id}
              size="sm"
              presence={selfStatus === 'offline' ? 'online' : selfStatus}
              statusEmoji={user.statusEmoji}
              statusText={user.statusText}
            />
          </button>
        </DropdownMenuTrigger>
      </Hint>

      <DropdownMenuContent
        side={side}
        align="end"
        sideOffset={6}
        className="w-68 sm:w-72 p-2 shadow-2xl space-y-1 rounded-2xl border border-border bg-popover text-foreground select-none"
      >
        {/* Header Identity Row: Avatar, name, handle, active status */}
        <div
          onClick={() => {
            navigate(`/w/${workspaceSlug}/settings/profile`);
          }}
          className="gap-3 p-2.5 flex cursor-pointer items-center rounded-xl transition-colors hover:bg-accent/60"
        >
          <UserAvatar
            name={user.displayName ?? user.name}
            src={user.avatarUrl}
            seed={user.id}
            size="md"
            presence={selfStatus === 'offline' ? 'online' : selfStatus}
            className="size-10 shrink-0 ring-1 ring-border/50"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold tracking-tight truncate text-foreground">
              {user.displayName ?? user.name}
            </h4>
            <div className="gap-1.5 mt-0.5 text-xs flex items-center font-mono text-muted-foreground">
              <span>{handle}</span>
              <span>•</span>
              <span
                className={cn(
                  'font-medium font-sans',
                  isSelfAway ? 'text-warning' : 'text-success',
                )}
              >
                {isSelfAway ? 'Away' : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Update your status button box */}
        <div className="py-1">
          <button
            type="button"
            onClick={openStatusModal}
            className="gap-2.5 px-3 py-2 flex w-full items-center rounded-xl border border-border/80 bg-surface-inset/60 text-left text-muted-foreground transition-colors hover:border-border hover:bg-surface-inset hover:text-foreground"
          >
            <Smile className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-medium truncate">
              {user.statusText ? (
                <span className="text-foreground">
                  {user.statusEmoji ? `${user.statusEmoji} ` : ''}
                  {user.statusText}
                </span>
              ) : (
                'Update your status'
              )}
            </span>
          </button>
        </div>

        {/* Set yourself as away */}
        <DropdownMenuItem
          onClick={handleToggleAway}
          className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60"
        >
          <span>
            Set yourself as <strong>{isSelfAway ? 'active' : 'away'}</strong>
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-border/60" />

        {/* Preferences */}
        <DropdownMenuItem
          onClick={() => navigate(`/w/${workspaceSlug}/settings/appearance`)}
          className="px-2.5 py-2 text-xs font-medium gap-2.5 cursor-pointer rounded-lg hover:bg-accent/60"
        >
          <Sliders className="size-3.5 text-muted-foreground" />
          <span>Preferences</span>
        </DropdownMenuItem>

        {/* Account settings */}
        <DropdownMenuItem
          onClick={() => navigate(`/w/${workspaceSlug}/settings/profile`)}
          className="px-2.5 py-2 text-xs font-medium gap-2.5 cursor-pointer rounded-lg hover:bg-accent/60"
        >
          <Settings className="size-3.5 text-muted-foreground" />
          <span>Account settings</span>
        </DropdownMenuItem>

        {/* Plans & Billing */}
        <DropdownMenuItem
          onClick={() => navigate(`/w/${workspaceSlug}/settings/billing`)}
          className="px-2.5 py-2 text-xs font-medium gap-2.5 cursor-pointer rounded-lg hover:bg-accent/60"
        >
          <CreditCard className="size-3.5 text-muted-foreground" />
          <span>Plans & Billing</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-border/60" />

        {/* App Download / Open Desktop App (web only) */}
        {!isDesktop && (
          <>
            {environment.isMobile ? (
              primaryOption && (
                <DropdownMenuItem
                  onClick={() => {
                    trackDownload(primaryOption, 'account_menu');
                    void openExternal(primaryOption.url);
                  }}
                  className="px-2.5 py-2 text-xs font-medium cursor-pointer justify-between rounded-lg text-primary hover:bg-accent/60"
                >
                  <span className="gap-2 flex items-center">
                    <Smartphone className="size-3.5" />
                    <span>Get Mobile App</span>
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    {environment.os === 'ios' ? 'iOS' : 'Android'}
                  </span>
                </DropdownMenuItem>
              )
            ) : (
              <>
                {primaryOption && (
                  <DropdownMenuItem
                    onClick={() => {
                      trackDownload(primaryOption, 'account_menu');
                      void openExternal(primaryOption.url);
                    }}
                    className="px-2.5 py-2 text-xs font-medium cursor-pointer justify-between rounded-lg text-primary hover:bg-accent/60"
                  >
                    <span className="gap-2 flex items-center">
                      <Download className="size-3.5" />
                      <span>Download Desktop App</span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      {primaryOption.storeOrFormat.split(' ')[0]}
                    </span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => void openDesktopApp({ route: 'open' })}
                  className="px-2.5 py-2 text-xs font-medium cursor-pointer justify-between rounded-lg text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                >
                  <span className="gap-2 flex items-center">
                    <Laptop className="size-3.5" />
                    <span>Open Desktop App</span>
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    App
                  </span>
                </DropdownMenuItem>
              </>
            )}
          </>
        )}

        {/*
          Sign out of the *current account* only. If another account is
          linked, `useRemoveAccount` drops this one and switches to the
          most recent remaining account's workspace; it falls through to
          /login only when nothing is left. A separate item ends every
          linked session at once, shown just when there is more than one.
        */}
        <DropdownMenuItem
          onClick={() => {
            void confirm({
              title: `Sign out of ${workspaceName ?? 'this workspace'}?`,
              description:
                'This ends your session for this account. You will need to sign in again to come back.',
              confirmLabel: 'Sign out',
              destructive: true,
            }).then((ok) => {
              if (ok) removeAccount.mutate(activeAccountId ?? user.id);
            });
          }}
          disabled={removeAccount.isPending}
          className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg text-destructive hover:bg-destructive/10"
        >
          <span>Sign out of {workspaceName ?? 'this workspace'}</span>
        </DropdownMenuItem>

        {accounts.length > 1 && (
          <DropdownMenuItem
            onClick={() => logout.mutate()}
            className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg text-destructive hover:bg-destructive/10"
          >
            <span>Sign out of all accounts</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
