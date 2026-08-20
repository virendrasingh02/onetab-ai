import { memberApi, queryKeys } from '@org/api-client';
import type { ChannelSummary } from '@org/types';
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
  Sparkles,
  UserPlus,
  Workflow,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  const [selected, setSelected] = useState<string[]>([]);
  const { add } = useChannelMemberMutations(workspaceId);

  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: open && !!workspaceId,
  });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected([]);
    }
  }, [open]);

  const alreadyIn = useMemo(
    () => new Set(existingMemberIds),
    [existingMemberIds],
  );

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (membersQuery.data ?? []).filter((member) => {
      if (!needle) return true;
      const name = member.user.displayName ?? member.user.name;
      return (
        name.toLowerCase().includes(needle) ||
        member.user.name.toLowerCase().includes(needle)
      );
    });
  }, [membersQuery.data, search]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) return;

    add.mutate(
      {
        channelId: channel.id,
        input: { userIds: selected, role: 'MEMBER' },
      },
      {
        onSuccess: () => {
          toast.success(
            selected.length === 1
              ? 'Added 1 person to the channel'
              : `Added ${selected.length} people to the channel`,
          );
          onOpenChange(false);
        },
        onError: () => toast.error('Could not add people to this channel'),
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
                <UserPlus className="size-4" />
              </div>
              <div>
                <DialogTitle>Add people</DialogTitle>
                <DialogDescription>
                  Invite workspace members to #{channel.name}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 px-6 py-4">
            <div className="relative">
              <Search className="top-2.5 left-2.5 size-3.5 absolute text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name…"
                aria-label="Search workspace members"
                className="pl-8"
                autoFocus
              />
            </div>

            <ScrollArea
              className="max-h-64"
              contentClassName="space-y-0.5 pr-1"
            >
              {membersQuery.isLoading ? (
                <p className="py-6 text-xs text-center text-muted-foreground">
                  Loading members…
                </p>
              ) : candidates.length === 0 ? (
                <p className="py-6 text-xs text-center text-muted-foreground">
                  No workspace members match that search.
                </p>
              ) : (
                candidates.map((member) => {
                  const name = member.user.displayName ?? member.user.name;
                  const joined = alreadyIn.has(member.user.id);
                  const isSelected = selected.includes(member.user.id);

                  return (
                    <button
                      key={member.id}
                      type="button"
                      disabled={joined}
                      onClick={() =>
                        setSelected((current) =>
                          current.includes(member.user.id)
                            ? current.filter((id) => id !== member.user.id)
                            : [...current, member.user.id],
                        )
                      }
                      className={cn(
                        'gap-2.5 px-2 py-1.5 flex w-full items-center rounded-lg text-left transition-colors',
                        joined
                          ? 'opacity-50'
                          : isSelected
                            ? 'bg-primary/15'
                            : 'hover:bg-accent/60',
                      )}
                    >
                      <UserAvatar
                        name={name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-xs font-semibold block truncate text-foreground">
                          {name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          @{member.user.name}
                        </span>
                      </span>
                      {joined ? (
                        <span className="tracking-wide text-[10px] text-muted-foreground uppercase">
                          In channel
                        </span>
                      ) : isSelected ? (
                        <Check className="size-4 text-primary-text" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selected.length === 0 || add.isPending}
            >
              {selected.length > 0 ? `Add ${selected.length}` : 'Add'}
            </Button>
          </DialogFooter>
        </form>
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
