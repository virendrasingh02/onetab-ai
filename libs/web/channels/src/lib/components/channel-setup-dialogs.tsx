import { invitationApi, memberApi, queryKeys } from '@org/api-client';
import type { ChannelSummary, PublicUser } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  Textarea,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Check,
  LayoutTemplate,
  PenLine,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  useChannelMemberMutations,
  useUpdateChannel,
} from '../use-channels.js';

export interface AddPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
  /** Ids already in the channel; they are shown as joined rather than offered. */
  existingMemberIds: string[];
}

/**
 * Adds workspace members to a channel.
 *
 * People already in the channel stay listed, greyed out and unselectable —
 * hiding them makes a short list look wrong ("where is everyone?") and invites
 * the same person to be invited twice.
 */
export function AddPeopleDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
  existingMemberIds,
}: AddPeopleDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<PublicUser[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { add } = useChannelMemberMutations(workspaceId);

  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: open && !!workspaceId,
  });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedUsers([]);
      setSelectedEmails([]);
      setFocusedIndex(0);
    }
  }, [open]);

  const alreadyIn = useMemo(
    () => new Set(existingMemberIds),
    [existingMemberIds],
  );

  const selectedUserIds = useMemo(
    () => new Set(selectedUsers.map((u) => u.id)),
    [selectedUsers],
  );

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (membersQuery.data ?? []).filter((member) => {
      if (alreadyIn.has(member.user.id) || selectedUserIds.has(member.user.id)) {
        return false;
      }
      if (!needle) return true;
      const name = member.user.displayName ?? member.user.name;
      return (
        name.toLowerCase().includes(needle) ||
        member.user.name.toLowerCase().includes(needle)
      );
    });
  }, [membersQuery.data, alreadyIn, selectedUserIds, search]);

  const isEmailLike = search.includes('@') && search.trim().length > 3;

  const selectUser = (user: PublicUser) => {
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers((prev) => [...prev, user]);
    }
    setSearch('');
    setFocusedIndex(0);
    inputRef.current?.focus();
  };

  const selectEmail = (email: string) => {
    const trimmed = email.trim();
    if (trimmed && !selectedEmails.includes(trimmed)) {
      setSelectedEmails((prev) => [...prev, trimmed]);
    }
    setSearch('');
    setFocusedIndex(0);
    inputRef.current?.focus();
  };

  const handleAdd = async (event?: FormEvent) => {
    if (event) event.preventDefault();

    const finalUsers = [...selectedUsers];
    const finalEmails = [...selectedEmails];

    if (isEmailLike && !finalEmails.includes(search.trim())) {
      finalEmails.push(search.trim());
    } else if (
      search.trim() &&
      candidates.length > 0 &&
      !finalUsers.some((u) => u.id === candidates[0].user.id)
    ) {
      finalUsers.push(candidates[0].user);
    }

    if (finalUsers.length === 0 && finalEmails.length === 0) return;

    setIsSubmitting(true);

    try {
      if (finalUsers.length > 0) {
        await add.mutateAsync({
          channelId: channel.id,
          input: { userIds: finalUsers.map((u) => u.id), role: 'MEMBER' },
        });
      }

      if (finalEmails.length > 0 && workspaceId) {
        await invitationApi.create(workspaceId, {
          emails: finalEmails,
          role: 'MEMBER' as any,
          channelId: channel.id,
        });
      }

      const totalCount = finalUsers.length + finalEmails.length;
      toast.success(
        totalCount === 1
          ? 'Added 1 person to the channel'
          : `Added ${totalCount} people to the channel`,
      );
      setIsSubmitting(false);
      onOpenChange(false);
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err?.message || 'Could not add people to this channel');
    }
  };

  const hasItems =
    selectedUsers.length > 0 ||
    selectedEmails.length > 0 ||
    search.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-visible gap-0 border-border bg-surface shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Add people or agents to #{channel.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              #{channel.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Input & Autocomplete Area */}
        <form onSubmit={handleAdd} className="px-5 pb-4 space-y-3">
          <div className="relative">
            <div
              onClick={() => inputRef.current?.focus()}
              className="min-h-12 w-full p-2 gap-1.5 flex flex-wrap items-center rounded-xl border border-border bg-surface-inset/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all cursor-text"
            >
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="h-7 pl-1.5 pr-2 gap-1.5 flex items-center rounded-lg bg-surface border border-border text-xs font-medium text-foreground shrink-0 select-none shadow-xs"
                >
                  <UserAvatar
                    name={user.displayName ?? user.name}
                    src={user.avatarUrl}
                    seed={user.id}
                    size="xs"
                    shape="rounded"
                  />
                  <span className="truncate max-w-[120px]">
                    {user.displayName ?? user.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUsers((prev) =>
                        prev.filter((u) => u.id !== user.id),
                      );
                    }}
                    className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              {selectedEmails.map((email) => (
                <span
                  key={email}
                  className="h-7 pl-2 pr-2 gap-1.5 flex items-center rounded-lg bg-primary/10 border border-primary/30 text-xs font-medium text-primary shrink-0 select-none shadow-xs"
                >
                  <Send className="size-3" />
                  <span className="truncate max-w-[150px]">{email}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmails((prev) =>
                        prev.filter((item) => item !== email),
                      );
                    }}
                    className="p-0.5 rounded-full text-primary hover:bg-primary/20"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !search) {
                    if (selectedEmails.length > 0) {
                      setSelectedEmails((prev) => prev.slice(0, -1));
                    } else if (selectedUsers.length > 0) {
                      setSelectedUsers((prev) => prev.slice(0, -1));
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isEmailLike) {
                      selectEmail(search.trim());
                    } else if (candidates.length > 0 && candidates[focusedIndex]) {
                      selectUser(candidates[focusedIndex].user);
                    } else if (hasItems) {
                      void handleAdd();
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedIndex((prev) =>
                      Math.min(prev + 1, candidates.length - 1),
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIndex((prev) => Math.max(prev - 1, 0));
                  }
                }}
                placeholder={
                  selectedUsers.length === 0 && selectedEmails.length === 0
                    ? 'ex. Nathalie, or james@acme.com'
                    : 'Add more...'
                }
                className="flex-1 min-w-[160px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-1"
                autoFocus
              />
            </div>

            {/* Dropdown suggestions popover when search query is active */}
            {search.trim() ? (
              <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface-raised shadow-2xl p-1.5 space-y-0.5">
                {isEmailLike ? (
                  <button
                    type="button"
                    onClick={() => selectEmail(search.trim())}
                    className="w-full px-3 py-2 flex items-center justify-between rounded-lg bg-surface hover:bg-primary/10 text-foreground transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Send className="size-3.5" />
                      </div>
                      <span className="text-xs font-medium truncate">
                        Invite{' '}
                        <span className="font-semibold text-primary">
                          {search.trim()}
                        </span>
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono py-0 h-4 px-1.5 bg-background shrink-0"
                    >
                      Enter
                    </Badge>
                  </button>
                ) : null}

                {candidates.map((member, index) => {
                  const isFocused = index === focusedIndex;
                  const name =
                    member.user.displayName ?? member.user.name;
                  const isOnline =
                    member.user.presence === 'ONLINE' ||
                    member.user.presence?.toLowerCase() === 'online';

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => selectUser(member.user)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={cn(
                        'w-full px-2.5 py-1.5 flex items-center justify-between gap-2.5 rounded-lg text-left transition-colors cursor-pointer',
                        isFocused
                          ? 'bg-accent text-foreground'
                          : 'hover:bg-accent/60',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <UserAvatar
                          name={name}
                          src={member.user.avatarUrl}
                          seed={member.user.id}
                          size="sm"
                          shape="rounded"
                          className="shrink-0"
                        />
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {name}
                          </span>
                          <span className="shrink-0 flex items-center justify-center">
                            {isOnline ? (
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="size-1.5 rounded-full border border-muted-foreground/60" />
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {member.user.name}
                          </span>
                        </div>
                      </div>
                      {isFocused ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono py-0 h-4 px-1.5 bg-background shrink-0"
                        >
                          Enter
                        </Badge>
                      ) : null}
                    </button>
                  );
                })}

                {!isEmailLike && candidates.length === 0 ? (
                  <p className="py-4 text-xs text-center text-muted-foreground">
                    No matching workspace members. Type an email address to invite them.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={!hasItems || isSubmitting}
              loading={isSubmitting}
              className="h-8 px-4 text-xs font-medium rounded-lg"
            >
              Add
            </Button>
          </div>
        </form>

        {/* Footer / Connect Banner */}
        <div className="px-5 py-3.5 border-t border-border/60 bg-surface-inset/20 space-y-1 rounded-b-2xl">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground">
              Try OneTab Connect
            </span>
            <Badge className="bg-fuchsia-600/20 text-fuchsia-400 border-fuchsia-500/30 text-[10px] font-bold py-0 h-4 px-1.5 uppercase tracking-wide">
              PRO
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Working with external people? Simply type their email above to get started.{' '}
            <button
              type="button"
              onClick={() =>
                toast.info(
                  'OneTab Connect is available on Enterprise and Pro plans.',
                )
              }
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Learn more
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface EditChannelDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  channel: ChannelSummary;
}

/** Edits the one-line topic and the longer description together. */
export function EditChannelDetailsDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: EditChannelDetailsDialogProps) {
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [description, setDescription] = useState(channel.description ?? '');
  const update = useUpdateChannel(workspaceId);

  // Reopening after someone else edited the channel should show their text,
  // not the stale copy this dialog started with.
  useEffect(() => {
    if (open) {
      setTopic(channel.topic ?? '');
      setDescription(channel.description ?? '');
    }
  }, [open, channel.topic, channel.description]);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    update.mutate(
      {
        channelId: channel.id,
        input: {
          topic: topic.trim() || null,
          description: description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Channel details updated');
          onOpenChange(false);
        },
        onError: () => toast.error('Could not update this channel'),
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

          <div className="space-y-4 px-6 py-4">
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
                autoFocus
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Save details
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

const AVAILABLE_AI_AGENTS: AIAgentOption[] = [
  {
    id: 'agent-copilot',
    name: 'OneTab Copilot',
    handle: '@copilot',
    role: 'Assistant',
    description: 'Context-aware channel assistant for Q&A, thread summarization, and task drafting.',
    model: 'Gemini 2.5 Pro',
    avatarSeed: 'copilot',
    tags: ['General', 'Summaries', 'Q&A'],
  },
  {
    id: 'agent-code-reviewer',
    name: 'Code Reviewer',
    handle: '@codereview',
    role: 'Developer Tool',
    description: 'Inspects code snippets, detects bugs, and suggests optimized refactors in real time.',
    model: 'Claude 3.7 Sonnet',
    avatarSeed: 'codereview',
    tags: ['Engineering', 'Code', 'Debugging'],
  },
  {
    id: 'agent-triage',
    name: 'Incident & Bug Triage',
    handle: '@triage',
    role: 'Operations',
    description: 'Monitors channel errors, assigns priority, and generates incident timeline post-mortems.',
    model: 'GPT-4o',
    avatarSeed: 'triage',
    tags: ['Ops', 'Incident', 'Tracking'],
  },
  {
    id: 'agent-standup',
    name: 'Daily Standup Bot',
    handle: '@standup',
    role: 'Productivity',
    description: 'Collects async standups, aggregates blockers, and posts daily morning summaries.',
    model: 'Gemini 2.5 Flash',
    avatarSeed: 'standup',
    tags: ['Agile', 'Standup', 'Recap'],
  },
  {
    id: 'agent-docs',
    name: 'Docs & Researcher',
    handle: '@docs',
    role: 'Knowledge Base',
    description: 'Synthesizes conversation conclusions and writes structured markdown documentation.',
    model: 'Claude 3.7 Sonnet',
    avatarSeed: 'docs',
    tags: ['Docs', 'Research', 'Markdown'],
  },
];

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedAgentId(null);
    }
  }, [open]);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return AVAILABLE_AI_AGENTS;
    return AVAILABLE_AI_AGENTS.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.handle.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }, [search]);

  const handleAddAgent = () => {
    const agent = AVAILABLE_AI_AGENTS.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success(`Added ${agent.name} (${agent.handle}) to #${channel.name}`);
      onAgentAdded?.(agent);
      onOpenChange(false);
    }, 400);
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
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Add AI Agent to #{channel.name}</span>
                <Badge variant="primary" className="text-[10px] py-0 h-4">
                  AI Powered
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select an intelligent AI agent to participate and assist directly in this channel.
                {' '}Local preview — only visible to you in this browser, not
                the rest of the channel.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6 py-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search AI agents by name, role, or skills..."
              className="pl-9 text-xs"
            />
          </div>

          <ScrollArea className="h-64 rounded-xl border border-border bg-surface/50 p-2">
            <div className="space-y-2">
              {filteredAgents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/70 bg-surface hover:border-border hover:bg-surface-raised',
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <UserAvatar
                        name={agent.name}
                        seed={agent.avatarSeed}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {agent.name}
                          </span>
                          <span className="text-[11px] font-mono text-primary">
                            {agent.handle}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 h-4 font-mono">
                            {agent.model}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {agent.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {agent.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'size-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface',
                      )}
                    >
                      {isSelected ? <Check className="size-3 stroke-[3]" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border">
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
    description: 'Organized for sprint planning, daily standups, pull requests, and deployment updates.',
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
    description: 'High-urgency coordination channel with incident post-mortems and alert paging.',
    topic: 'Live incident triage, root cause analysis, and resolution timeline.',
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
    description: 'Cross-functional channel aligning design, engineering, and marketing on milestone launches.',
    topic: 'Feature requirements, design specs, user feedback, and release schedule.',
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
    description: 'Casual company-wide space for wins, greetings, random links, and celebrations.',
    topic: 'Casual chatter, team celebrations, and interesting articles.',
    starterBookmarks: [
      { label: 'Team Directory', href: '#', emoji: '👥' },
    ],
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
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
                Apply pre-configured structure, topic, bookmarks, and workflows to #{channel.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 px-6 py-2">
          {CHANNEL_TEMPLATES.map((tpl) => {
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={cn(
                  'text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised',
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{tpl.icon}</span>
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      {tpl.category}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-xs text-foreground mt-2">
                    {tpl.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{tpl.starterBookmarks.length} bookmarks</span>
                  <span>{tpl.recommendedAgents.join(' ')}</span>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border">
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
      description: 'Automatically sends an introductory onboarding message when someone joins this channel.',
      trigger: 'On Member Join',
      active: true,
    },
    {
      id: 'wf-2',
      title: 'Daily Async Standup Recap',
      description: 'Prompts channel members for daily updates at 9:30 AM and publishes a consolidated digest.',
      trigger: 'Every Weekday at 9:30 AM',
      active: true,
    },
    {
      id: 'wf-3',
      title: 'AI Thread Auto-Summarizer',
      description: 'Generates a 3-bullet executive summary when any thread exceeds 10 replies.',
      trigger: 'Thread > 10 replies',
      active: false,
    },
    {
      id: 'wf-4',
      title: 'Keyword Incident Escalation',
      description: 'Alerts workspace on-call engineers when "URGENT" or "INCIDENT" is posted.',
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

        <div className="space-y-2.5 px-6 py-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="p-3 rounded-xl border border-border bg-surface flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-bold text-foreground">{wf.title}</h4>
                  <Badge variant={wf.active ? 'primary' : 'neutral'} className="text-[10px] py-0 h-4">
                    {wf.active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {wf.description}
                </p>
                <span className="text-[10px] font-mono text-primary flex items-center gap-1 mt-1.5">
                  <Zap className="size-3" />
                  <span>Trigger: {wf.trigger}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
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
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border">
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
