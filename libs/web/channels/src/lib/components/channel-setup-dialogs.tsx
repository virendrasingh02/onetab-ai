import {
  agentsApi,
  memberApi,
  queryKeys,
} from '@org/api-client';
import type { ChannelSummary, PublicUser } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  Switch,
  Textarea,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn, slugify } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import type { WorkspaceRole } from '@org/types';
import {
  Bot,
  Check,
  Copy,
  Hash,
  LayoutTemplate,
  Megaphone,
  PenLine,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  VenetianMask,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useAnonymousMessagingMutations,
  useChannelAnonymousSettings,
  useChannelEmailMutations,
  useChannelEmailSettings,
  useChannelMembers,
  useUpdateChannel,
} from '../use-channels.js';

export { AddPeopleDialog, type AddPeopleDialogProps } from './add-people-dialog.js';

export interface EditChannelDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
}

/** Edits the channel's name, topic, description and welcome message together. */
export function EditChannelDetailsDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: EditChannelDetailsDialogProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // #general keeps its name — the API refuses to rename it.
  const canRename = channel.slug !== 'general';
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [description, setDescription] = useState(channel.description ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(
    channel.welcomeMessage ?? '',
  );
  const update = useUpdateChannel(workspaceId);

  // Reopening after someone else edited the channel should show their text,
  // not the stale copy this dialog started with.
  useEffect(() => {
    if (open) {
      setName(channel.name);
      setTopic(channel.topic ?? '');
      setDescription(channel.description ?? '');
      setWelcomeMessage(channel.welcomeMessage ?? '');
    }
  }, [
    open,
    channel.name,
    channel.topic,
    channel.description,
    channel.welcomeMessage,
  ]);

  const nextName = slugify(name);
  const renamed = canRename && nextName !== channel.name;
  const nameError =
    renamed && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextName)
      ? 'Use lowercase letters, numbers and single hyphens.'
      : renamed && (nextName.length < 2 || nextName.length > 48)
        ? 'Channel names are 2–48 characters.'
        : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (nameError) return;

    update.mutate(
      {
        channelId: channel.id,
        input: {
          ...(renamed ? { name: nextName } : {}),
          topic: topic.trim() || null,
          description: description.trim() || null,
          welcomeMessage: welcomeMessage.trim() || null,
        },
      },
      {
        onSuccess: (updated) => {
          toast.success(
            renamed ? `Renamed to #${updated.name}` : 'Channel details updated',
          );
          onOpenChange(false);
          // The slug follows the name, so a page open on the old URL would
          // lose its channel — move it to the new one.
          const oldSegment = `/channels/${channel.slug}`;
          if (renamed && location.pathname.includes(oldSegment)) {
            navigate(
              location.pathname.replace(
                oldSegment,
                `/channels/${updated.slug}`,
              ) + location.search,
              { replace: true },
            );
          }
        },
        onError: (error) =>
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : 'Could not update this channel',
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="gap-2 flex items-center">
              <div className="size-8 flex items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <PenLine className="size-4" />
              </div>
              <div>
                <DialogTitle>Channel details</DialogTitle>
                <DialogDescription>
                  Tell people what #{channel.name} is for.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="channel-name"
                className="text-xs font-medium text-foreground"
              >
                Name
              </label>
              <Input
                id="channel-name"
                value={name}
                onChange={(event) =>
                  // Keep a trailing hyphen while typing; `slugify` tidies the
                  // edges on save.
                  setName(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, '-')
                      .replace(/-{2,}/g, '-')
                      .replace(/^-+/, ''),
                  )
                }
                prefix={<Hash className="size-3.5" />}
                maxLength={48}
                disabled={!canRename}
                aria-invalid={nameError ? true : undefined}
                aria-describedby="channel-name-hint"
              />
              <p
                id="channel-name-hint"
                className={cn(
                  'text-[11px]',
                  nameError ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {!canRename
                  ? '#general can’t be renamed.'
                  : (nameError ??
                    'Renaming changes the channel’s link. Lowercase, numbers and hyphens.')}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="channel-topic"
                className="text-xs font-medium text-foreground"
              >
                Topic
              </label>
              <Input
                id="channel-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="A short line shown next to the channel name"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="channel-description"
                className="text-xs font-medium text-foreground"
              >
                Description
              </label>
              <Textarea
                id="channel-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this channel is for, who belongs here, and what to post."
                maxLength={500}
                rows={4}
              />
              <p className="text-[11px] text-muted-foreground">
                {description.length}/500
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="channel-welcome-message"
                className="text-xs font-medium text-foreground"
              >
                Welcome message
              </label>
              <Textarea
                id="channel-welcome-message"
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                placeholder="Shown as the first message when someone opens this channel."
                maxLength={300}
                rows={2}
              />
              <p className="text-[11px] text-muted-foreground">
                {welcomeMessage.length}/300
              </p>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending || !!nameError}>
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------- Posting & broadcast --- */

export interface ChannelPostingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
}

const POSTING_TOGGLES: readonly {
  key: 'allowReplies' | 'allowReactions' | 'allowFileUploads';
  label: string;
  description: string;
}[] = [
  {
    key: 'allowReplies',
    label: 'Replies',
    description: 'Show a reply box on announcements for people who can post.',
  },
  {
    key: 'allowReactions',
    label: 'Reactions',
    description: 'Let everyone react with emoji, even when they cannot post.',
  },
  {
    key: 'allowFileUploads',
    label: 'File uploads',
    description: 'Allow attachments on announcements.',
  },
];

/**
 * Channel mode + granular posting permissions (brief §3).
 *
 * Standard — every member may post. Announcement — only channel admins,
 * workspace admins and the people named here. The switch is enforced on the
 * channel's Matrix room (`events_default`), so a standard member simply cannot
 * send there; the toggles below shape reactions (also enforced) and the reply /
 * upload affordances.
 */
const ANON_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'];

/**
 * Anonymous-messaging config for a channel (brief §2). Auto-saves each control
 * so it stays independent of the announcement-mode form around it.
 */
function AnonymousPostingSection({
  workspaceId,
  channelId,
}: {
  workspaceId: string | undefined;
  channelId: string;
}) {
  const settings = useChannelAnonymousSettings(workspaceId, channelId);
  const { updateSettings } = useAnonymousMessagingMutations(
    workspaceId,
    channelId,
  );
  const data = settings.data;
  if (!data) return null;

  const roleAllowed = (role: WorkspaceRole) =>
    data.allowedRoles.length === 0 || data.allowedRoles.includes(role);

  const toggleRole = (role: WorkspaceRole) => {
    const set = new Set<WorkspaceRole>(
      data.allowedRoles.length === 0 ? ANON_ROLES : data.allowedRoles,
    );
    if (set.has(role)) set.delete(role);
    else set.add(role);
    // All four selected ⇒ store empty ("everyone").
    const next = set.size === ANON_ROLES.length ? [] : [...set];
    updateSettings.mutate({ allowedRoles: next });
  };

  return (
    <div className="space-y-2.5 p-3 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <div className="gap-2 flex items-center">
          <VenetianMask className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-foreground">
              Anonymous messages
            </p>
            <p className="text-[11px] text-muted-foreground">
              Members can post as “Anonymous Participant”. Only moderators can
              see who sent one.
            </p>
          </div>
        </div>
        <Switch
          checked={data.isEnabled}
          onCheckedChange={(v) => updateSettings.mutate({ isEnabled: v })}
          aria-label="Enable anonymous messages"
        />
      </div>

      {data.isEnabled && (
        <>
          <div className="text-xs flex items-center justify-between">
            <span className="text-foreground">Allow anonymous replies</span>
            <Switch
              checked={data.allowReplies}
              onCheckedChange={(v) =>
                updateSettings.mutate({ allowReplies: v })
              }
              aria-label="Allow anonymous replies"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">
              Roles that may post anonymously
            </p>
            <div className="gap-1.5 flex flex-wrap">
              {ANON_ROLES.map((role) => {
                const on = roleAllowed(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-[11px] capitalize transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {role.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Inbound email → channel (brief §5). Auto-saves each control. */
function EmailIntegrationSection({
  workspaceId,
  channelId,
}: {
  workspaceId: string | undefined;
  channelId: string;
}) {
  const settings = useChannelEmailSettings(workspaceId, channelId);
  const { update } = useChannelEmailMutations(workspaceId, channelId);
  const [copied, setCopied] = useState(false);
  const data = settings.data;
  if (!data) return null;

  const copy = () => {
    if (!data.address) return;
    navigator.clipboard.writeText(data.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-2.5 p-3 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <div className="gap-2 flex items-center">
          <Send className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold text-foreground">Email</p>
            <p className="text-[11px] text-muted-foreground">
              Send email to this address to post it in the channel.
            </p>
          </div>
        </div>
        <Switch
          checked={data.isEnabled}
          onCheckedChange={(v) => update.mutate({ isEnabled: v })}
          aria-label="Enable incoming email"
        />
      </div>

      {data.address ? (
        <div className="gap-2 px-2.5 py-1.5 flex items-center rounded-lg border border-border bg-surface-muted">
          <code className="min-w-0 flex-1 truncate text-[11px] text-foreground">
            {data.address}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copy}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            {copied ? (
              <Check className="size-3 text-success-text" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Incoming email is not configured for this deployment.
        </p>
      )}

      {data.isEnabled && (
        <>
          <div className="text-xs flex items-center justify-between">
            <span className="text-foreground">Thread by subject</span>
            <Switch
              checked={data.threadPerSubject}
              onCheckedChange={(v) => update.mutate({ threadPerSubject: v })}
              aria-label="Thread by subject"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data.messageCount} email
            {data.messageCount === 1 ? '' : 's'} routed here so far.
          </p>
        </>
      )}
    </div>
  );
}

export function ChannelPostingDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: ChannelPostingDialogProps) {
  const [mode, setMode] = useState<ChannelSummary['mode']>(channel.mode);
  const [toggles, setToggles] = useState({
    allowReplies: channel.allowReplies,
    allowReactions: channel.allowReactions,
    allowFileUploads: channel.allowFileUploads,
  });
  const [posterIds, setPosterIds] = useState<string[]>(
    channel.announcementPosterIds ?? [],
  );
  const [search, setSearch] = useState('');
  const update = useUpdateChannel(workspaceId);

  useEffect(() => {
    if (open) {
      setMode(channel.mode);
      setToggles({
        allowReplies: channel.allowReplies,
        allowReactions: channel.allowReactions,
        allowFileUploads: channel.allowFileUploads,
      });
      setPosterIds(channel.announcementPosterIds ?? []);
      setSearch('');
    }
  }, [
    open,
    channel.mode,
    channel.allowReplies,
    channel.allowReactions,
    channel.allowFileUploads,
    channel.announcementPosterIds,
  ]);

  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: open && !!workspaceId && mode === 'ANNOUNCEMENT',
  });
  const channelMembers = useChannelMembers(
    open && mode === 'ANNOUNCEMENT' ? workspaceId : undefined,
    channel.id,
  );

  const posterSet = useMemo(() => new Set(posterIds), [posterIds]);

  /** Everyone who can already post, so they are counted rather than offered. */
  const alwaysPostIds = useMemo(() => {
    const ids = new Set<string>();
    if (channel.createdById) ids.add(channel.createdById);
    for (const m of membersQuery.data ?? []) {
      if (m.role === 'OWNER' || m.role === 'ADMIN') ids.add(m.user.id);
    }
    for (const m of channelMembers.data ?? []) {
      if (m.role === 'ADMIN') ids.add(m.user.id);
    }
    return ids;
  }, [membersQuery.data, channelMembers.data, channel.createdById]);

  /** Channel members (the only people who can post there) that can be named. */
  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (channelMembers.data ?? []).filter((m) => {
      if (alwaysPostIds.has(m.user.id) || posterSet.has(m.user.id))
        return false;
      if (!needle) return true;
      return (m.user.displayName ?? m.user.name).toLowerCase().includes(needle);
    });
  }, [channelMembers.data, alwaysPostIds, posterSet, search]);

  /** Named posters resolved to people (the workspace roster covers non-members). */
  const selectedPosters = useMemo(() => {
    const byId = new Map<string, PublicUser>();
    for (const m of membersQuery.data ?? []) byId.set(m.user.id, m.user);
    for (const m of channelMembers.data ?? []) byId.set(m.user.id, m.user);
    return posterIds.map((id) => ({ id, user: byId.get(id) }));
  }, [posterIds, membersQuery.data, channelMembers.data]);

  const togglePoster = (userId: string) =>
    setPosterIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );

  const dirty = useMemo(() => {
    if (mode !== channel.mode) return true;
    if (mode === 'STANDARD') return false;
    if (
      toggles.allowReplies !== channel.allowReplies ||
      toggles.allowReactions !== channel.allowReactions ||
      toggles.allowFileUploads !== channel.allowFileUploads
    ) {
      return true;
    }
    const saved = new Set(channel.announcementPosterIds ?? []);
    return (
      saved.size !== posterIds.length || posterIds.some((id) => !saved.has(id))
    );
  }, [mode, toggles, posterIds, channel]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        channelId: channel.id,
        input: {
          mode,
          allowReplies: toggles.allowReplies,
          allowReactions: toggles.allowReactions,
          allowFileUploads: toggles.allowFileUploads,
          announcementPosterIds: mode === 'ANNOUNCEMENT' ? posterIds : [],
        },
      },
      {
        onSuccess: () => {
          toast.success('Posting permissions updated');
          onOpenChange(false);
        },
        onError: () => toast.error('Could not update posting permissions'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="gap-2 flex items-center">
              <div className="size-8 flex items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <Megaphone className="size-4" />
              </div>
              <div>
                <DialogTitle>Posting &amp; permissions</DialogTitle>
                <DialogDescription>
                  Control who can post in #{channel.name}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Mode */}
            <div
              role="radiogroup"
              aria-label="Channel mode"
              className="gap-2 grid grid-cols-2"
            >
              {[
                {
                  value: 'STANDARD' as const,
                  icon: Hash,
                  title: 'Standard',
                  blurb: 'Every member can post.',
                },
                {
                  value: 'ANNOUNCEMENT' as const,
                  icon: Megaphone,
                  title: 'Announcement',
                  blurb: 'Only admins & named people post.',
                },
              ].map((option) => {
                const OptionIcon = option.icon;
                const active = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(option.value)}
                    className={cn(
                      'gap-1 p-3 flex flex-col rounded-xl border text-left transition-colors',
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                        : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <OptionIcon className="size-4 text-foreground" />
                    <span className="text-xs font-semibold text-foreground">
                      {option.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {option.blurb}
                    </span>
                  </button>
                );
              })}
            </div>

            {mode === 'ANNOUNCEMENT' && (
              <>
                <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
                  {POSTING_TOGGLES.map((row) => (
                    <div
                      key={row.key}
                      className="gap-3 px-3 py-2.5 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          {row.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {row.description}
                        </p>
                      </div>
                      <Switch
                        checked={toggles[row.key]}
                        onCheckedChange={(checked) =>
                          setToggles((prev) => ({
                            ...prev,
                            [row.key]: checked,
                          }))
                        }
                        aria-label={row.label}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      People who can post
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Channel admins, workspace admins and the creator
                      {alwaysPostIds.size > 0
                        ? ` (${alwaysPostIds.size})`
                        : ''}{' '}
                      can always post.
                    </p>
                  </div>

                  {selectedPosters.length > 0 && (
                    <ul className="gap-1.5 flex flex-wrap">
                      {selectedPosters.map(({ id, user }) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => togglePoster(id)}
                            aria-label={`Remove ${user?.displayName ?? user?.name ?? 'person'}`}
                            className="gap-1.5 py-0.5 pl-0.5 pr-2 flex items-center rounded-full border border-border bg-surface-raised text-[11px] transition-colors hover:bg-accent"
                          >
                            <UserAvatar
                              name={user?.displayName ?? user?.name ?? '?'}
                              src={user?.avatarUrl ?? undefined}
                              seed={id}
                              size="xs"
                              indicator={false}
                            />
                            <span className="max-w-32 truncate">
                              {user?.displayName ?? user?.name ?? 'Unknown'}
                            </span>
                            <X className="size-3 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="relative">
                    <Search className="left-2.5 size-3.5 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Add a channel member…"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <ScrollArea className="max-h-40 rounded-lg border border-border">
                    {channelMembers.isLoading ? (
                      <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                        Loading members…
                      </p>
                    ) : candidates.length === 0 ? (
                      <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                        {search
                          ? 'No matching members.'
                          : 'Everyone else in this channel is already listed.'}
                      </p>
                    ) : (
                      <ul className="p-1">
                        {candidates.map((m) => (
                          <li key={m.user.id}>
                            <button
                              type="button"
                              onClick={() => togglePoster(m.user.id)}
                              className="gap-2 px-2 py-1.5 text-xs flex w-full items-center rounded-md text-left transition-colors hover:bg-accent"
                            >
                              <UserAvatar
                                name={m.user.displayName ?? m.user.name}
                                src={m.user.avatarUrl ?? undefined}
                                seed={m.user.id}
                                size="xs"
                                indicator={false}
                              />
                              <span className="flex-1 truncate">
                                {m.user.displayName ?? m.user.name}
                              </span>
                              <Plus className="size-3.5 text-muted-foreground" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </ScrollArea>
                </div>
              </>
            )}

            <p className="pt-1 font-medium tracking-wide text-[11px] text-muted-foreground uppercase">
              Applied instantly
            </p>
            <AnonymousPostingSection
              workspaceId={workspaceId}
              channelId={channel.id}
            />
            <EmailIntegrationSection
              workspaceId={workspaceId}
              channelId={channel.id}
            />
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending || !dirty}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------- AI Agent Dialog --- */

export interface AIAgentOption {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  model: string;
  avatarSeed: string;
  tags: string[];
}

export interface AddAgentToChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelSummary;
  onAgentAdded?: (agent: AIAgentOption) => void;
}

export function AddAgentToChannelDialog({
  open,
  onOpenChange,
  channel,
  onAgentAdded,
}: AddAgentToChannelDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const isSubmitting = false;

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedAgentId(null);
    }
  }, [open]);

  // Real workspace agents — the ones that actually exist and can be linked to
  // a channel. The old hardcoded catalogue was a browser-only preview.
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(channel.workspaceId),
    queryFn: () => agentsApi.list(channel.workspaceId),
    enabled: open,
  });

  const options = useMemo<AIAgentOption[]>(
    () =>
      (agentsQuery.data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        handle:
          '@' +
          (a.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'agent'),
        role: a.role,
        description: a.description ?? '',
        model: a.model,
        avatarSeed: a.id,
        tags: [],
      })),
    [agentsQuery.data],
  );

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.handle.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query),
    );
  }, [search, options]);

  const handleAddAgent = () => {
    const agent = options.find((a) => a.id === selectedAgentId);
    if (!agent) return;
    onAgentAdded?.(agent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="gap-2.5 flex items-center">
            <div className="size-9 flex items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold gap-2 flex items-center">
                <span>Add AI Agent to #{channel.name}</span>
                <Badge variant="primary" className="py-0 h-4 text-[10px]">
                  AI Powered
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Add one of your workspace's AI agents to this channel. Once
                added, it can be @mentioned here and will reply in the channel
                for everyone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="relative">
            <Search className="size-4 left-3 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search AI agents by name, role, or skills..."
              className="pl-9 text-xs"
            />
          </div>

          <ScrollArea className="h-64 p-2 rounded-xl border border-border bg-surface/50">
            <div className="space-y-2">
              {agentsQuery.isLoading ? (
                <p className="text-xs p-3 text-muted-foreground">
                  Loading agents…
                </p>
              ) : filteredAgents.length === 0 ? (
                <p className="text-xs p-3 text-muted-foreground">
                  {options.length === 0
                    ? 'This workspace has no AI agents yet. Create one from the Agents section first.'
                    : 'No agents match your search.'}
                </p>
              ) : null}
              {filteredAgents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      'p-3 gap-3 flex w-full cursor-pointer items-start justify-between rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/70 bg-surface hover:border-border hover:bg-surface-raised',
                    )}
                  >
                    <div className="gap-2.5 min-w-0 flex flex-1 items-start">
                      <UserAvatar
                        name={agent.name}
                        seed={agent.avatarSeed}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="gap-2 flex flex-wrap items-center">
                          <span className="text-xs font-bold text-foreground">
                            {agent.name}
                          </span>
                          <span className="font-mono text-[11px] text-primary">
                            {agent.handle}
                          </span>
                          <Badge
                            variant="outline"
                            className="py-0 h-4 font-mono text-[10px]"
                          >
                            {agent.model}
                          </Badge>
                        </div>
                        <p className="text-xs mt-1 leading-relaxed line-clamp-2 text-muted-foreground">
                          {agent.description}
                        </p>
                        <div className="gap-1.5 mt-2 flex items-center">
                          {agent.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded font-medium bg-muted text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'size-5 mt-0.5 flex shrink-0 items-center justify-center rounded-full border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface',
                      )}
                    >
                      {isSelected ? (
                        <Check className="size-3 stroke-[3]" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter className="py-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedAgentId || isSubmitting}
            loading={isSubmitting}
            onClick={handleAddAgent}
            className="gap-1.5"
          >
            <Sparkles className="size-3.5" />
            <span>Add Agent to Channel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------- Channel Templates Dialog --- */

export interface ChannelTemplateOption {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  topic: string;
  starterBookmarks: { label: string; href: string; emoji: string }[];
  recommendedAgents: string[];
}

const CHANNEL_TEMPLATES: ChannelTemplateOption[] = [
  {
    id: 'tpl-engineering',
    name: 'Sprint & Agile Engineering',
    icon: '⚡',
    category: 'Software',
    description:
      'Organized for sprint planning, daily standups, pull requests, and deployment updates.',
    topic: 'Sprint active goals, PR reviews, and blocker discussions.',
    starterBookmarks: [
      { label: 'Sprint Board', href: 'https://linear.app', emoji: '📋' },
      { label: 'CI/CD Pipeline', href: 'https://github.com', emoji: '🚀' },
    ],
    recommendedAgents: ['@codereview', '@standup'],
  },
  {
    id: 'tpl-incident',
    name: 'Incident War Room',
    icon: '🚨',
    category: 'Operations',
    description:
      'High-urgency coordination channel with incident post-mortems and alert paging.',
    topic:
      'Live incident triage, root cause analysis, and resolution timeline.',
    starterBookmarks: [
      { label: 'Status Page', href: 'https://status.io', emoji: '🔴' },
      { label: 'Incident Doc', href: 'https://notion.so', emoji: '📝' },
    ],
    recommendedAgents: ['@triage', '@copilot'],
  },
  {
    id: 'tpl-product',
    name: 'Product & Feature Launch',
    icon: '🎯',
    category: 'Product',
    description:
      'Cross-functional channel aligning design, engineering, and marketing on milestone launches.',
    topic:
      'Feature requirements, design specs, user feedback, and release schedule.',
    starterBookmarks: [
      { label: 'Figma Design', href: 'https://figma.com', emoji: '🎨' },
      { label: 'PRD Document', href: 'https://docs.google.com', emoji: '📄' },
    ],
    recommendedAgents: ['@copilot', '@docs'],
  },
  {
    id: 'tpl-watercooler',
    name: 'Team Watercooler & General',
    icon: '☕',
    category: 'Culture',
    description:
      'Casual company-wide space for wins, greetings, random links, and celebrations.',
    topic: 'Casual chatter, team celebrations, and interesting articles.',
    starterBookmarks: [{ label: 'Team Directory', href: '#', emoji: '👥' }],
    recommendedAgents: ['@standup'],
  },
];

export interface ChannelTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelSummary;
}

export function ChannelTemplatesDialog({
  open,
  onOpenChange,
  channel,
}: ChannelTemplatesDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = () => {
    const tpl = CHANNEL_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;

    setIsApplying(true);
    setTimeout(() => {
      setIsApplying(false);
      toast.success(`Applied template "${tpl.name}" to #${channel.name}`);
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="gap-2.5 flex items-center">
            <div className="size-9 flex items-center justify-center rounded-xl border border-border bg-surface-raised text-primary">
              <LayoutTemplate className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Channel Templates
              </DialogTitle>
              <DialogDescription className="text-xs">
                Apply pre-configured structure, topic, bookmarks, and workflows
                to #{channel.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="sm:grid-cols-2 gap-3 grid">
          {CHANNEL_TEMPLATES.map((tpl) => {
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={cn(
                  'p-3.5 flex cursor-pointer flex-col justify-between rounded-xl border text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised',
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{tpl.icon}</span>
                    <Badge variant="outline" className="py-0 h-4 text-[10px]">
                      {tpl.category}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-xs mt-2 text-foreground">
                    {tpl.name}
                  </h4>
                  <p className="mt-1 leading-relaxed line-clamp-2 text-[11px] text-muted-foreground">
                    {tpl.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-border/60 font-mono text-[10px] text-muted-foreground">
                  <span>{tpl.starterBookmarks.length} bookmarks</span>
                  <span>{tpl.recommendedAgents.join(' ')}</span>
                </div>
              </button>
            );
          })}
        </DialogBody>

        <DialogFooter className="py-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedTemplateId || isApplying}
            loading={isApplying}
            onClick={handleApply}
          >
            Apply Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------- Channel Workflows Dialog --- */

export interface ChannelWorkflowItem {
  id: string;
  title: string;
  description: string;
  trigger: string;
  active: boolean;
}

export interface ChannelWorkflowsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelSummary;
}

export function ChannelWorkflowsDialog({
  open,
  onOpenChange,
  channel,
}: ChannelWorkflowsDialogProps) {
  const [workflows, setWorkflows] = useState<ChannelWorkflowItem[]>([
    {
      id: 'wf-1',
      title: 'Welcome New Member Message',
      description:
        'Automatically sends an introductory onboarding message when someone joins this channel.',
      trigger: 'On Member Join',
      active: true,
    },
    {
      id: 'wf-2',
      title: 'Daily Async Standup Recap',
      description:
        'Prompts channel members for daily updates at 9:30 AM and publishes a consolidated digest.',
      trigger: 'Every Weekday at 9:30 AM',
      active: true,
    },
    {
      id: 'wf-3',
      title: 'AI Thread Auto-Summarizer',
      description:
        'Generates a 3-bullet executive summary when any thread exceeds 10 replies.',
      trigger: 'Thread > 10 replies',
      active: false,
    },
    {
      id: 'wf-4',
      title: 'Keyword Incident Escalation',
      description:
        'Alerts workspace on-call engineers when "URGENT" or "INCIDENT" is posted.',
      trigger: 'On Keyword Match',
      active: false,
    },
  ]);

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const next = !w.active;
        toast.success(`${w.title} ${next ? 'enabled' : 'disabled'}`);
        return { ...w, active: next };
      }),
    );
  };

  const runWorkflowNow = (w: ChannelWorkflowItem) => {
    toast.success(`Triggered workflow: ${w.title}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="gap-2.5 flex items-center">
            <div className="size-9 flex items-center justify-center rounded-xl border border-border bg-surface-raised text-primary">
              <Workflow className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Workflows &amp; Automations
              </DialogTitle>
              <DialogDescription className="text-xs">
                Active automated actions and bots connected to #{channel.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-2.5">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="p-3 gap-3 flex items-start justify-between rounded-xl border border-border bg-surface"
            >
              <div className="min-w-0 flex-1">
                <div className="gap-2 flex flex-wrap items-center">
                  <h4 className="text-xs font-bold text-foreground">
                    {wf.title}
                  </h4>
                  <Badge
                    variant={wf.active ? 'primary' : 'neutral'}
                    className="py-0 h-4 text-[10px]"
                  >
                    {wf.active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <p className="text-xs mt-1 leading-relaxed text-muted-foreground">
                  {wf.description}
                </p>
                <span className="gap-1 mt-1.5 flex items-center font-mono text-[10px] text-primary">
                  <Zap className="size-3" />
                  <span>Trigger: {wf.trigger}</span>
                </span>
              </div>

              <div className="gap-1.5 flex shrink-0 items-center">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => runWorkflowNow(wf)}
                  title="Run now"
                >
                  <Play className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={wf.active ? 'outline' : 'primary'}
                  className="h-7 text-xs"
                  onClick={() => toggleWorkflow(wf.id)}
                >
                  {wf.active ? 'Pause' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
        </DialogBody>

        <DialogFooter className="py-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              toast.success('Opening automation builder...');
              onOpenChange(false);
            }}
          >
            <Plus className="size-3.5" />
            <span>Create Workflow</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
