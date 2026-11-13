import { channelApi, queryKeys, workspaceApi } from '@org/api-client';
import {
  hasWorkspaceRole,
  roleHasPermission,
  WorkspacePermission,
  WorkspaceRole,
  type ChannelSummary,
} from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  fieldBoxClass,
  fieldBoxFocusWithinClass,
  fieldBoxInputClass,
  fieldBoxInvalidClass,
  Popover,
  PopoverAnchor,
  PopoverContent,
  SegmentedControl,
  toast,
} from '@org/ui';
import { cn, parseEmails } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Hash, Link2, Lock, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInvitationMutations } from '../use-invitations.js';

export interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  workspaceName?: string;
  workspaceSlug?: string;
  defaultScope?: {
    type: 'WORKSPACE' | 'CHANNEL' | 'TEAM' | 'PROJECT';
    id?: string;
    name?: string;
  };
  defaultRole?: WorkspaceRole;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_INVITES = 50;

const INVITABLE_ROLES = [
  WorkspaceRole.MEMBER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.GUEST,
];

const ROLE_HINTS: Record<string, string> = {
  [WorkspaceRole.MEMBER]: 'Can chat, collaborate and create content',
  [WorkspaceRole.ADMIN]: 'Can also manage members and settings',
  [WorkspaceRole.GUEST]: 'Limited to the channels they are added to',
};

const roleLabel = (role: WorkspaceRole) =>
  role.charAt(0) + role.slice(1).toLowerCase();

function ChannelGlyph({
  channel,
  className,
}: {
  channel: ChannelSummary;
  className?: string;
}) {
  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
  return <Icon aria-hidden className={className} />;
}

export function InviteMembersDialog({
  open,
  onOpenChange,
  workspaceId: propWorkspaceId,
  workspaceName: propWorkspaceName,
  defaultScope,
  defaultRole = WorkspaceRole.MEMBER,
}: InviteMembersDialogProps) {
  const currentCtx = useCurrentWorkspace();
  const workspaceId = propWorkspaceId || currentCtx.workspaceId;
  const workspace = currentCtx.workspace;
  const workspaceName = propWorkspaceName || workspace?.name || 'Onetab';

  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<ChannelSummary[]>(
    [],
  );
  const [highlight, setHighlight] = useState(0);
  const [channelSearch, setChannelSearch] = useState('');
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [role, setRole] = useState<WorkspaceRole>(defaultRole);
  /* Addresses the API reported as already in the workspace on the last send. */
  const [existingMembers, setExistingMembers] = useState<string[]>([]);
  /*
   * The shareable link is minted lazily on first copy (a real `isLink`
   * invitation row) and reused for the life of the dialog, so repeated clicks
   * don't spawn duplicate links. Cleared when the dialog closes.
   */
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const channelSearchRef = useRef<HTMLInputElement>(null);

  // Queries & Mutations
  const channelsQuery = useQuery({
    queryKey: ['channels', workspaceId, 'list'],
    queryFn: () => channelApi.list(workspaceId as string),
    enabled: !!workspaceId && open,
  });

  // The dialog can target a workspace other than the current one, so the
  // inviter's role comes from their workspace list, not the current context.
  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspaceApi.list(),
    enabled: open,
    staleTime: 30_000,
  });

  const { invite, createLink } = useInvitationMutations(workspaceId);

  /*
   * Memoized: `channelsQuery.data ?? []` is a fresh array literal on every
   * render while the query is disabled (`open` is false), and this value feeds
   * the reset effect's dep array below. Without the memo the effect re-ran
   * every render and its `setEmails([])` / `setSelectedChannels([])` calls
   * (new `[]` each time, never `Object.is`-equal) scheduled another render —
   * an infinite loop for as long as the closed dialog stayed mounted in
   * `AppShell`.
   */
  const allChannels = useMemo<ChannelSummary[]>(
    () => channelsQuery.data ?? [],
    [channelsQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setEmails((prev) => (prev.length ? [] : prev));
      setEmailInput((prev) => (prev ? '' : prev));
      setSelectedChannels((prev) => (prev.length ? [] : prev));
      setChannelSearch((prev) => (prev ? '' : prev));
      setShowChannelDropdown((prev) => (prev ? false : prev));
      setShareableUrl((prev) => (prev ? null : prev));
      setExistingMembers((prev) => (prev.length ? [] : prev));
      setRole(defaultRole);
    } else if (defaultScope?.type === 'CHANNEL' && defaultScope.id) {
      const matched = allChannels.find((c) => c.id === defaultScope.id);
      if (matched) {
        setSelectedChannels([matched]);
      }
    }
  }, [open, defaultScope?.type, defaultScope?.id, defaultRole, allChannels]);

  const addEmailsFromText = (text: string) => {
    const parsed = parseEmails(text);
    if (parsed.length > 0) {
      setEmails((prev) => [...new Set([...prev, ...parsed])]);
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((item) => item !== email));
    setExistingMembers((prev) => prev.filter((item) => item !== email));
  };

  const editEmail = (email: string) => {
    removeEmail(email);
    setEmailInput(email);
    emailInputRef.current?.focus();
  };

  const invalidEmails = emails.filter((e) => !EMAIL_RE.test(e));
  const pendingInvalid =
    !!emailInput.trim() &&
    !parseEmails(emailInput).every((e) => EMAIL_RE.test(e));
  const totalCount =
    emails.length + (emailInput.trim() ? parseEmails(emailInput).length : 0);
  const tooMany = totalCount > MAX_INVITES;
  const existingCount = emails.filter((e) =>
    existingMembers.includes(e),
  ).length;
  const sendCount = totalCount - existingCount;

  // One message line under the email box, resolved by <Field>: error first.
  const emailError = tooMany ? (
    <span>You can invite up to {MAX_INVITES} people at a time.</span>
  ) : invalidEmails.length > 0 ? (
    <span>
      {invalidEmails.length === 1
        ? '1 address looks invalid. '
        : `${invalidEmails.length} addresses look invalid. `}
      Click to fix, or{' '}
      <button
        type="button"
        onClick={() =>
          setEmails((prev) => prev.filter((e) => EMAIL_RE.test(e)))
        }
        className="cursor-pointer underline underline-offset-2"
      >
        remove {invalidEmails.length === 1 ? 'it' : 'them'}
      </button>
      .
    </span>
  ) : undefined;
  const emailHint =
    existingCount > 0
      ? existingCount === 1
        ? `This person is already in ${workspaceName}, so no invite was sent.`
        : `These people are already in ${workspaceName}, so no invites were sent.`
      : 'Separate with commas or spaces, or paste a list.';
  const canSend =
    sendCount > 0 &&
    invalidEmails.length === 0 &&
    !pendingInvalid &&
    !tooMany &&
    !invite.isPending;

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', 'Tab', ' ', ';'].includes(e.key)) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) return;
      if (emailInput.trim()) {
        e.preventDefault();
        addEmailsFromText(emailInput);
      }
    } else if (e.key === 'Backspace' && !emailInput && emails.length > 0) {
      removeEmail(emails[emails.length - 1] as string);
    }
  };

  const suggestedChannels = useMemo(() => {
    return allChannels.filter((c) => !c.isArchived).slice(0, 3);
  }, [allChannels, selectedChannels]);

  const filteredChannels = useMemo(() => {
    const needle = channelSearch.toLowerCase().trim();
    return allChannels.filter((c) => {
      if (c.isArchived) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle);
    });
  }, [allChannels, selectedChannels, channelSearch]);

  const selected = selectedChannels[0];

  // The API refuses a role above the inviter's own, so don't offer one.
  const actorRole = workspacesQuery.data?.find(
    (w) => w.id === workspaceId,
  )?.role;
  // Links are open-ended and only admins can revoke them, so they stay admin-only.
  const canShareLink =
    !!actorRole &&
    roleHasPermission(actorRole, WorkspacePermission.MANAGE_MEMBERS);
  const roleOptions = INVITABLE_ROLES.filter(
    (r) => !actorRole || hasWorkspaceRole(actorRole, r),
  ).map((r) => ({ value: r, label: roleLabel(r), hint: ROLE_HINTS[r] }));

  // A minted link carries the role and channel it was created with.
  useEffect(() => {
    setShareableUrl(null);
  }, [role, selected?.id]);

  const handleCopyLink = async () => {
    try {
      let url = shareableUrl;
      if (!url) {
        // Mint a real shareable invitation link; the backend returns the
        // one-time token as `/invite/<token>`, the route AcceptInvitationPage
        // serves.
        const res = await createLink.mutateAsync({
          role,
          channelId: selected?.id,
        });
        url = `${window.location.origin}${res.url}`;
        setShareableUrl(url);
      }
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Could not create an invite link',
      );
    }
  };

  const handleSend = async () => {
    let finalEmails = emails.filter((e) => !existingMembers.includes(e));
    if (emailInput.trim()) {
      const parsed = parseEmails(emailInput);
      finalEmails = [
        ...new Set([
          ...finalEmails,
          ...(parsed.length ? parsed : [emailInput.trim()]),
        ]),
      ];
    }

    if (finalEmails.length === 0 || !canSend) return;

    try {
      const {
        invited,
        alreadyMembers,
        alreadyInvited = [],
      } = await invite.mutateAsync({
        emails: finalEmails,
        role,
        channelId: selected?.id || undefined,
      });

      if (alreadyInvited.length > 0) {
        toast.info(
          alreadyInvited.length === 1
            ? `${alreadyInvited[0]} already has a pending invite`
            : `${alreadyInvited.length} people already have a pending invite`,
        );
      }

      // Nobody new: keep the list open and mark who is already in, rather than
      // reporting invitations that were never sent.
      if (invited.length === 0 && alreadyMembers.length > 0) {
        addEmailsFromText(finalEmails.join(' '));
        setExistingMembers((prev) => [...prev, ...alreadyMembers]);
        return;
      }

      if (invited.length > 0) {
        toast.success(
          invited.length === 1
            ? `Invitation sent to ${invited[0]?.email}`
            : `${invited.length} invitations sent`,
        );
      }
      if (alreadyMembers.length > 0) {
        toast.info(
          alreadyMembers.length === 1
            ? `${alreadyMembers[0]} is already in ${workspaceName}`
            : `${alreadyMembers.length} people are already in ${workspaceName}`,
        );
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send invitations',
      );
    }
  };

  const pickChannel = (ch: ChannelSummary) => {
    setSelectedChannels([ch]);
    setChannelSearch('');
    setShowChannelDropdown(false);
  };

  const handleChannelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowChannelDropdown(true);
      setHighlight((h) => Math.min(h + 1, filteredChannels.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const ch = filteredChannels[highlight];
      if (showChannelDropdown && ch) {
        e.preventDefault();
        pickChannel(ch);
      }
    } else if (e.key === 'Escape' && showChannelDropdown) {
      e.stopPropagation();
      setShowChannelDropdown(false);
    } else if (e.key === 'Backspace' && !channelSearch) {
      setSelectedChannels([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        mobile="sheet"
        className="sm:max-w-xl"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
            e.preventDefault();
            void handleSend();
          }
        }}
      >
        <div className="px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="text-lg leading-snug">
            Invite people to {workspaceName}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            They&apos;ll get an email with a link to join, valid for 14 days.
          </DialogDescription>
        </div>

        <div className="px-6 space-y-5">
          <Field
            label="Email addresses"
            htmlFor="invite-emails"
            error={emailError}
            hint={emailHint}
            labelAside={
              totalCount > 0 ? (
                <span
                  className={cn(
                    'shrink-0 text-meta tabular-nums',
                    tooMany ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {totalCount} / {MAX_INVITES}
                </span>
              ) : null
            }
          >
            <div
              id="invite-emails-box"
              onClick={() => emailInputRef.current?.focus()}
              className={cn(
                'px-2 py-1.5 gap-1.5 min-h-20 max-h-44 flex w-full cursor-text flex-wrap content-start items-start overflow-y-auto',
                fieldBoxClass,
                fieldBoxFocusWithinClass,
                (invalidEmails.length > 0 || tooMany) && fieldBoxInvalidClass,
              )}
            >
              {emails.map((email) => {
                const bad = !EMAIL_RE.test(email);
                const existing = existingMembers.includes(email);
                return (
                  <span
                    key={email}
                    className={cn(
                      'h-6 px-1 gap-1 text-xs font-medium flex max-w-full items-center rounded-md border select-none',
                      bad
                        ? 'border-destructive/50 bg-destructive/10 text-destructive'
                        : existing
                          ? 'border-dashed border-border bg-transparent text-muted-foreground'
                          : 'border-border bg-surface-inset text-foreground',
                    )}
                  >
                    <button
                      type="button"
                      title={
                        bad
                          ? 'Not a valid email address. Click to fix it.'
                          : 'Click to edit'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        editEmail(email);
                      }}
                      className="gap-1.5 min-w-0 flex cursor-text items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
                    >
                      {bad ? (
                        <AlertCircle
                          aria-hidden
                          className="ml-0.5 size-3.5 shrink-0"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="size-4 font-semibold grid shrink-0 place-items-center rounded-full bg-accent text-3xs text-muted-foreground uppercase"
                        >
                          {email.charAt(0)}
                        </span>
                      )}
                      <span className="max-w-55 truncate">{email}</span>
                      {existing && (
                        <span className="font-normal shrink-0">
                          · Already in
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEmail(email);
                      }}
                      className="p-0.5 rounded-sm opacity-70 outline-none hover:bg-accent hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/55"
                    >
                      <X aria-hidden className="size-3" />
                    </button>
                  </span>
                );
              })}

              <input
                id="invite-emails"
                ref={emailInputRef}
                type="text"
                inputMode="email"
                autoComplete="off"
                aria-invalid={invalidEmails.length > 0 || tooMany}
                aria-describedby="invite-emails-field-msg"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted.includes('@')) {
                    e.preventDefault();
                    addEmailsFromText(pasted);
                  }
                }}
                onKeyDown={handleEmailKeyDown}
                onBlur={() => {
                  if (emailInput.trim()) addEmailsFromText(emailInput);
                }}
                placeholder={
                  emails.length === 0 ? 'name@company.com' : 'Add more...'
                }
                className={cn('h-6 px-1 min-w-45', fieldBoxInputClass)}
                autoFocus
              />
            </div>
          </Field>

          <div className="gap-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Invite as</p>
              <p className="text-meta text-muted-foreground">
                {ROLE_HINTS[role]}
              </p>
            </div>
            <SegmentedControl
              aria-label="Role for invited people"
              options={roleOptions}
              value={role}
              onChange={setRole}
              className="shrink-0"
            />
          </div>

          <Field
            htmlFor="invite-channel"
            optional={role !== WorkspaceRole.GUEST}
            label={
              role === WorkspaceRole.GUEST ? (
                <>
                  Add to a channel
                  <span className="font-normal text-subtle">
                    (recommended for guests)
                  </span>
                </>
              ) : (
                'Add to a channel'
              )
            }
          >
            <div id="invite-channel-group" className="gap-2 grid">
              {/* Portaled via <Popover> so the list is never clipped by the dialog. */}
              <Popover
                open={showChannelDropdown}
                onOpenChange={setShowChannelDropdown}
                modal={false}
              >
                <PopoverAnchor asChild>
                  <div
                    onClick={() => channelSearchRef.current?.focus()}
                    className={cn(
                      'min-h-8 px-2.5 py-0.5 gap-1.5 flex w-full cursor-text flex-wrap items-center',
                      fieldBoxClass,
                      fieldBoxFocusWithinClass,
                    )}
                  >
                    {selected ? (
                      <span className="h-6 pl-2 pr-1 gap-1 text-xs font-medium flex items-center rounded-md border border-border bg-surface-inset text-foreground select-none">
                        <ChannelGlyph
                          channel={selected}
                          className="size-3 text-muted-foreground"
                        />
                        <span className="max-w-50 truncate">
                          {selected.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${selected.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChannels([]);
                          }}
                          className="p-0.5 rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X aria-hidden className="size-3" />
                        </button>
                      </span>
                    ) : (
                      <Search
                        aria-hidden
                        className="size-3.5 shrink-0 text-subtle"
                      />
                    )}

                    <input
                      id="invite-channel"
                      ref={channelSearchRef}
                      type="text"
                      autoComplete="off"
                      value={channelSearch}
                      onChange={(e) => {
                        setChannelSearch(e.target.value);
                        setHighlight(0);
                        setShowChannelDropdown(true);
                      }}
                      onFocus={() => setShowChannelDropdown(true)}
                      onKeyDown={handleChannelKeyDown}
                      placeholder={
                        selected ? 'Change channel...' : 'Search channels'
                      }
                      className={cn('h-6 min-w-35', fieldBoxInputClass)}
                    />
                  </div>
                </PopoverAnchor>

                <PopoverContent
                  align="start"
                  sideOffset={6}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  className="max-h-56 p-1 space-y-0.5 w-(--radix-popover-trigger-width) overflow-y-auto"
                >
                  {channelsQuery.isLoading ? (
                    <p className="py-3 text-xs text-center text-muted-foreground">
                      Loading channels...
                    </p>
                  ) : filteredChannels.length === 0 ? (
                    <p className="py-3 text-xs text-center text-muted-foreground">
                      No matching channels
                    </p>
                  ) : (
                    filteredChannels.map((ch, i) => (
                      <button
                        key={ch.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => pickChannel(ch)}
                        className={cn(
                          'px-2.5 py-1.5 gap-2 text-xs flex w-full cursor-pointer items-center rounded-lg text-left text-foreground transition-colors',
                          i === highlight ? 'bg-accent' : 'hover:bg-accent',
                        )}
                      >
                        <ChannelGlyph
                          channel={ch}
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                        <span className="font-medium truncate">{ch.name}</span>
                        {ch.id === selected?.id && (
                          <Check
                            aria-hidden
                            className="size-3.5 ml-auto shrink-0"
                          />
                        )}
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>

              {!selected && suggestedChannels.length > 0 && (
                <div className="gap-1.5 flex flex-wrap items-center">
                  <span className="mr-0.5 text-meta text-muted-foreground">
                    Suggested
                  </span>
                  {suggestedChannels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChannels([ch])}
                      className="h-6 px-2 gap-1 text-xs font-medium max-w-40 flex cursor-pointer items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:outline-none"
                    >
                      <ChannelGlyph
                        channel={ch}
                        className="size-3 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </div>

        <div className="px-6 pt-5 pb-5 gap-2 flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleSend}
            disabled={!canSend}
            loading={invite.isPending}
          >
            {sendCount > 1 ? `Send ${sendCount} invites` : 'Send invite'}
          </Button>
        </div>

        {canShareLink && (
          <div className="px-6 py-3.5 gap-3 flex items-center border-t border-border bg-surface-inset/50">
            <span className="size-8 grid shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
              <Link2 aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Or share an invite link
              </p>
              <p className="text-xs text-muted-foreground">
                Anyone with it joins as {roleLabel(role).toLowerCase()}
                {selected ? ` in ${selected.name}` : ''}. Expires in 30 days.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleCopyLink}
              loading={createLink.isPending}
              className="shrink-0"
            >
              {copiedLink && (
                <Check aria-hidden className="size-3.5 text-success" />
              )}
              {copiedLink ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
