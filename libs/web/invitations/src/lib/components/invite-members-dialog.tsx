import { channelApi } from '@org/api-client';
import { WorkspaceRole, type ChannelSummary } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@org/ui';
import { parseEmails } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  Copy,
  Hash,
  Link2,
  Lock,
  Plus,
  X,
} from 'lucide-react';
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

function GoogleLogo({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function InviteMembersDialog({
  open,
  onOpenChange,
  workspaceId: propWorkspaceId,
  workspaceName: propWorkspaceName,
  workspaceSlug: propWorkspaceSlug,
  defaultScope,
  defaultRole = WorkspaceRole.MEMBER,
}: InviteMembersDialogProps) {
  const currentCtx = useCurrentWorkspace();
  const workspaceId = propWorkspaceId || currentCtx.workspaceId;
  const workspace = currentCtx.workspace;
  const workspaceName = propWorkspaceName || workspace?.name || 'Onetab';
  const slug = propWorkspaceSlug || currentCtx.slug;

  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<ChannelSummary[]>([]);
  const [channelSearch, setChannelSearch] = useState('');
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [showGoogleBanner, setShowGoogleBanner] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const channelSearchRef = useRef<HTMLInputElement>(null);

  // Queries & Mutations
  const channelsQuery = useQuery({
    queryKey: ['channels', workspaceId, 'list'],
    queryFn: () => channelApi.list(workspaceId as string),
    enabled: !!workspaceId && open,
  });

  const { invite } = useInvitationMutations(workspaceId);

  const allChannels: ChannelSummary[] = channelsQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      setEmails([]);
      setEmailInput('');
      setSelectedChannels([]);
      setChannelSearch('');
      setShowChannelDropdown(false);
    } else if (defaultScope?.type === 'CHANNEL' && defaultScope.id) {
      const matched = allChannels.find((c) => c.id === defaultScope.id);
      if (matched) {
        setSelectedChannels([matched]);
      }
    }
  }, [open, defaultScope, allChannels]);

  const addEmailsFromText = (text: string) => {
    const parsed = parseEmails(text);
    if (parsed.length > 0) {
      setEmails((prev) => [...new Set([...prev, ...parsed])]);
      setEmailInput('');
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', 'Tab', ' '].includes(e.key)) {
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
      .filter(
        (c) => !c.isArchived && !selectedChannels.some((sc) => sc.id === c.id),
      )
      .slice(0, 3);
  }, [allChannels, selectedChannels]);

  const filteredChannels = useMemo(() => {
    const needle = channelSearch.toLowerCase().trim();
    return allChannels.filter((c) => {
      if (c.isArchived) return false;
      if (selectedChannels.some((sc) => sc.id === c.id)) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle);
    });
  }, [allChannels, selectedChannels, channelSearch]);

  const handleGoogleWorkspace = () => {
    toast.info('Google Workspace directory sync will be available soon.');
  };

  const shareableUrl = `${window.location.origin}/w/${slug}/join`;
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    toast.success('Invite link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
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

    if (finalEmails.length === 0) return;

    try {
      await invite.mutateAsync({
        emails: finalEmails,
        role: defaultRole,
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
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send invitations');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-visible gap-0 border-border bg-surface shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-base font-bold text-foreground">
            Invite people to {workspaceName}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="pb-4 space-y-3">
          {/* Google directory promo banner (dismissible) */}
          {showGoogleBanner && (
            <div className="mx-5 p-3 rounded-xl bg-surface-inset/70 border border-border/80 flex items-start justify-between gap-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">
                  Does your team use Google?
                </span>{' '}
                Use Google directory to find your coworkers' email addresses.
              </p>
              <button
                type="button"
                onClick={() => setShowGoogleBanner(false)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors shrink-0 cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Email addresses input */}
          <div className="px-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Email addresses
              </label>
              <button
                type="button"
                onClick={handleGoogleWorkspace}
                className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
              >
                <GoogleLogo className="size-3.5" />
                <span>Add from Google Workspace</span>
              </button>
            </div>

            <div
              onClick={() => emailInputRef.current?.focus()}
              className="min-h-[86px] w-full p-2.5 gap-1.5 flex flex-wrap items-start content-start rounded-xl border border-border bg-surface-inset/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all cursor-text"
            >
              {emails.map((email) => (
                <span
                  key={email}
                  className="h-6 pl-2 pr-1.5 gap-1 flex items-center rounded-md bg-surface border border-border text-xs font-medium text-foreground select-none"
                >
                  <span className="truncate max-w-[220px]">{email}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEmails((prev) => prev.filter((item) => item !== email));
                    }}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              <input
                ref={emailInputRef}
                type="text"
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
                className="flex-1 min-w-[180px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-1"
                autoFocus
              />
            </div>
          </div>

          {/* Add to channels (optional) */}
          <div className="px-5 pt-1 space-y-2">
            <label className="text-xs font-bold text-foreground">
              Add to channels{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>

            {suggestedChannels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-[11px] text-muted-foreground font-medium mr-0.5">
                  Suggested:
                </span>
                {suggestedChannels.map((ch) => {
                  const isPrivate = ch.visibility === 'PRIVATE';
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChannels((prev) => [...prev, ch])}
                      className="h-6 px-2 gap-1 flex items-center rounded-md bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 hover:bg-cyan-900/50 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="size-3" />
                      {isPrivate ? (
                        <Lock className="size-2.5" />
                      ) : (
                        <Hash className="size-2.5" />
                      )}
                      <span>{ch.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search channels input & Dropdown */}
            <div className="relative">
              <div
                onClick={() => channelSearchRef.current?.focus()}
                className="min-h-9 w-full px-2.5 py-1.5 gap-1.5 flex flex-wrap items-center rounded-xl border border-border bg-surface-inset/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all cursor-text"
              >
                {selectedChannels.map((ch) => (
                  <span
                    key={ch.id}
                    className="h-6 pl-2 pr-1.5 gap-1 flex items-center rounded-md bg-surface border border-border text-xs font-medium text-foreground select-none"
                  >
                    {ch.visibility === 'PRIVATE' ? (
                      <Lock className="size-3 text-muted-foreground" />
                    ) : (
                      <Hash className="size-3 text-muted-foreground" />
                    )}
                    <span className="truncate max-w-[150px]">{ch.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChannels((prev) =>
                          prev.filter((item) => item.id !== ch.id),
                        );
                      }}
                      className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}

                <input
                  ref={channelSearchRef}
                  type="text"
                  value={channelSearch}
                  onChange={(e) => {
                    setChannelSearch(e.target.value);
                    setShowChannelDropdown(true);
                  }}
                  onFocus={() => setShowChannelDropdown(true)}
                  placeholder={
                    selectedChannels.length === 0
                      ? 'Search channels'
                      : 'Add another channel...'
                  }
                  className="flex-1 min-w-[140px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0.5"
                />
              </div>

              {showChannelDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowChannelDropdown(false)}
                  />
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface-raised shadow-xl p-1 space-y-0.5">
                    {filteredChannels.length === 0 ? (
                      <p className="py-3 text-xs text-center text-muted-foreground">
                        No matching channels
                      </p>
                    ) : (
                      filteredChannels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            setSelectedChannels((prev) => [...prev, ch]);
                            setChannelSearch('');
                            setShowChannelDropdown(false);
                          }}
                          className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg text-left text-xs hover:bg-accent transition-colors cursor-pointer text-foreground"
                        >
                          {ch.visibility === 'PRIVATE' ? (
                            <Lock className="size-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Hash className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-medium truncate">{ch.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="p-5 pt-3 flex items-center justify-between gap-3 border-t border-border/60">
          <DropdownMenu>
            <div className="inline-flex rounded-lg border border-border bg-surface overflow-hidden divide-x divide-border">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Link2 className="size-3.5" />
                )}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
              </button>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-1.5 py-1.5 hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Link options"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
            </div>
            <DropdownMenuContent align="start" className="w-52 text-xs">
              <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
                <Copy className="size-3.5 mr-2" />
                Copy Standard Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                Allows anyone with the link to join as a Member.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            onClick={handleSend}
            disabled={
              (emails.length === 0 && !emailInput.trim()) || invite.isPending
            }
            loading={invite.isPending}
            className="h-8.5 px-5 text-xs font-semibold rounded-lg"
          >
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
