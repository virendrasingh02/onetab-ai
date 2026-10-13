import { channelApi } from '@org/api-client';
import { WorkspaceRole, type ChannelSummary } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@org/ui';
import { parseEmails } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Hash, Link2, Lock, Plus, X } from 'lucide-react';
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

const ROLE_HINTS: Record<string, string> = {
  [WorkspaceRole.MEMBER]: 'Can chat, collaborate and create content',
  [WorkspaceRole.ADMIN]: 'Can also manage members and settings',
  [WorkspaceRole.GUEST]: 'Limited to the channels they are added to',
};

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

  const invalidEmails = emails.filter((e) => !EMAIL_RE.test(e));
  const pendingInvalid =
    !!emailInput.trim() && !parseEmails(emailInput).every((e) => EMAIL_RE.test(e));
  const totalCount = emails.length + (emailInput.trim() ? parseEmails(emailInput).length : 0);
  const tooMany = totalCount > MAX_INVITES;
  const canSend =
    totalCount > 0 &&
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
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const suggestedChannels = useMemo(() => {
    return allChannels
      .filter((c) => !c.isArchived)
      .slice(0, 3);
  }, [allChannels, selectedChannels]);

  const filteredChannels = useMemo(() => {
    const needle = channelSearch.toLowerCase().trim();
    return allChannels.filter((c) => {
      if (c.isArchived) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle);
    });
  }, [allChannels, selectedChannels, channelSearch]);

  const handleRoleChange = (r: WorkspaceRole) => {
    setRole(r);
    // a minted link carries the role it was created with
    setShareableUrl(null);
  };

  const handleCopyLink = async () => {
    try {
      let url = shareableUrl;
      if (!url) {
        // Mint a real shareable invitation link; the backend returns the
        // one-time token as `/invite/<token>`, the route AcceptInvitationPage
        // serves.
        const res = await createLink.mutateAsync({ role });
        // link is role-bound; reset below when role changes
        url = `${window.location.origin}${res.url}`;
        setShareableUrl(url);
      }
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Could not create an invite link',
      );
    }
  };

  const handleSend = async () => {
    let finalEmails = [...emails];
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
      await invite.mutateAsync({
        emails: finalEmails,
        role,
        channelId: selectedChannels[0]?.id || undefined,
      });

      toast.success(
        finalEmails.length === 1
          ? 'Invitation sent successfully!'
          : `${finalEmails.length} invitations sent successfully!`,
      );
      setEmails([]);
      setEmailInput('');
      setSelectedChannels([]);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitations");
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

  const selected = selectedChannels[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 shadow-2xl overflow-visible rounded-2xl border-border bg-surface"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
            e.preventDefault();
            void handleSend();
          }
        }}
      >
        <div className="p-5 pb-3 pr-12">
          <h2 className="text-base font-bold text-foreground">
            Invite people to {workspaceName}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            They will get an email with a link to join.
          </p>
        </div>

        <div className="pb-4 space-y-4">
          <div className="px-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="invite-emails"
                className="text-xs font-bold text-foreground"
              >
                Email addresses
              </label>
              {totalCount > 0 && (
                <span
                  className={`text-[11px] ${tooMany ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {totalCount} / {MAX_INVITES}
                </span>
              )}
            </div>

            <div
              onClick={() => emailInputRef.current?.focus()}
              className="p-2.5 gap-1.5 flex min-h-[86px] w-full cursor-text flex-wrap content-start items-start rounded-xl border border-border bg-surface-inset/40 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
            >
              {emails.map((email) => {
                const bad = !EMAIL_RE.test(email);
                return (
                  <span
                    key={email}
                    title={bad ? 'Not a valid email address' : undefined}
                    className={`h-6 pl-2 pr-1.5 gap-1 text-xs font-medium flex items-center rounded-md border select-none ${
                      bad
                        ? 'border-destructive/50 bg-destructive/10 text-destructive'
                        : 'border-border bg-surface text-foreground'
                    }`}
                  >
                    {bad && <AlertCircle className="size-3" />}
                    <span className="max-w-[220px] truncate">{email}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmails((prev) =>
                          prev.filter((item) => item !== email),
                        );
                      }}
                      className="p-0.5 rounded hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-3" />
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
                  emails.length === 0
                    ? 'Ex. ellis@onetab.ai, maria@onetab.ai'
                    : 'Add more...'
                }
                className="text-xs p-1 min-w-[180px] flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            {invalidEmails.length > 0 ? (
              <p className="text-[11px] text-destructive">
                {invalidEmails.length === 1
                  ? '1 address looks invalid. Remove or fix it to continue.'
                  : `${invalidEmails.length} addresses look invalid. Remove or fix them to continue.`}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Separate with commas, spaces or new lines. You can paste a list.
              </p>
            )}
          </div>

          <div className="px-5 space-y-2">
            <label className="text-xs font-bold text-foreground">
              Add to a channel{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>

            {!selected && suggestedChannels.length > 0 && (
              <div className="gap-1.5 text-xs flex flex-wrap items-center">
                <span className="font-medium mr-0.5 text-[11px] text-muted-foreground">
                  Suggested:
                </span>
                {suggestedChannels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannels([ch])}
                    className="h-6 px-2 gap-1 font-medium flex cursor-pointer items-center rounded-md border border-accent-cyan/30 bg-accent-cyan-soft text-[11px] text-accent-cyan transition-colors hover:bg-accent-cyan-soft"
                  >
                    <Plus className="size-3" />
                    {ch.visibility === 'PRIVATE' ? (
                      <Lock className="size-2.5" />
                    ) : (
                      <Hash className="size-2.5" />
                    )}
                    <span>{ch.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Portaled via <Popover> so the list is never clipped by the dialog. */}
            <Popover
              open={showChannelDropdown}
              onOpenChange={setShowChannelDropdown}
              modal={false}
            >
              <PopoverAnchor asChild>
                <div
                  onClick={() => channelSearchRef.current?.focus()}
                  className="min-h-9 px-2.5 py-1.5 gap-1.5 flex w-full cursor-text flex-wrap items-center rounded-xl border border-border bg-surface-inset/40 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
                >
                  {selected && (
                    <span className="h-6 pl-2 pr-1.5 gap-1 text-xs font-medium flex items-center rounded-md border border-border bg-surface text-foreground select-none">
                      {selected.visibility === 'PRIVATE' ? (
                        <Lock className="size-3 text-muted-foreground" />
                      ) : (
                        <Hash className="size-3 text-muted-foreground" />
                      )}
                      <span className="max-w-[200px] truncate">
                        {selected.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${selected.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChannels([]);
                        }}
                        className="p-0.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )}

                  <input
                    ref={channelSearchRef}
                    type="text"
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
                    className="text-xs p-0.5 min-w-[140px] flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </PopoverAnchor>

              <PopoverContent
                align="start"
                sideOffset={6}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-(--radix-popover-trigger-width) max-h-56 overflow-y-auto p-1 space-y-0.5"
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
                      className={`px-2.5 py-1.5 gap-2 text-xs flex w-full cursor-pointer items-center rounded-lg text-left text-foreground transition-colors ${
                        i === highlight ? 'bg-accent' : 'hover:bg-accent'
                      }`}
                    >
                      {ch.visibility === 'PRIVATE' ? (
                        <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-medium truncate">{ch.name}</span>
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="p-5 pt-3 gap-3 flex flex-wrap items-center justify-between border-t border-border/60">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={createLink.isPending}
            title={`Anyone with the link joins as ${role.toLowerCase()}`}
            className="px-3 py-1.5 gap-1.5 text-xs font-medium flex cursor-pointer items-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-accent/60 disabled:opacity-60"
          >
            {copiedLink ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            <span>{copiedLink ? 'Link copied' : 'Copy invite link'}</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Role:</span>
              <Select
                value={role}
                onValueChange={(r) => handleRoleChange(r as WorkspaceRole)}
              >
                <SelectTrigger title={ROLE_HINTS[role]} className="h-8 text-xs w-[100px] bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    WorkspaceRole.MEMBER,
                    WorkspaceRole.ADMIN,
                    WorkspaceRole.GUEST,
                  ].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              loading={invite.isPending}
              className="h-8.5 px-5 text-xs font-semibold rounded-lg"
            >
              {totalCount > 1 ? `Send ${totalCount} invites` : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
