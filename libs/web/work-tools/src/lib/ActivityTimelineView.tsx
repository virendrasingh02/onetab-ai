import type { Accent } from '@org/design-system';
import {
  Badge,
  Button,
  Card,
  Input,
  Page,
  PageHeader,
  Panel,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Heart,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';

export type ActivityCategory =
  | 'all'
  | 'ai'
  | 'tasks'
  | 'messages'
  | 'status';

export interface PulseItem {
  id: string;
  user: {
    name: string;
    avatar?: string;
    role?: string;
  };
  action: string;
  target?: string;
  category: 'ai' | 'tasks' | 'messages' | 'status';
  timestamp: string;
  accent: Accent;
  details?: string;
  linkText?: string;
  reactions: {
    thumbsUp: number;
    heart: number;
    rocket: number;
    userReacted?: Record<string, boolean>;
  };
}

const INITIAL_PULSE_ITEMS: PulseItem[] = [
  {
    id: 'p-1',
    user: { name: 'Virendra Singh', role: 'Lead Architect' },
    action: 'posted a pulse status',
    details: '🚀 Successfully migrated Ask AI button to top header & updated Pulse live stream!',
    category: 'status',
    timestamp: '2 mins ago',
    accent: 'violet',
    reactions: { thumbsUp: 5, heart: 3, rocket: 8, userReacted: {} },
  },
  {
    id: 'p-2',
    user: { name: 'OneTab Copilot Bot', role: 'AI Agent' },
    action: 'executed automated workflow',
    target: 'Vector Indexing & Embedding Sync',
    category: 'ai',
    timestamp: '12 mins ago',
    accent: 'blue',
    details: 'Indexed 1,420 workspace nodes in 340ms with 99.8% precision rate.',
    linkText: 'View Execution Log',
    reactions: { thumbsUp: 7, heart: 2, rocket: 6, userReacted: {} },
  },
  {
    id: 'p-3',
    user: { name: 'Sarah Chen', role: 'Senior Developer' },
    action: 'completed task',
    target: 'Setup Qdrant Vector Collection',
    category: 'tasks',
    timestamp: '25 mins ago',
    accent: 'green',
    details: 'Collection parameters configured for high throughput dot-product similarity search.',
    linkText: 'Open Task Board',
    reactions: { thumbsUp: 4, heart: 1, rocket: 3, userReacted: {} },
  },
  {
    id: 'p-4',
    user: { name: 'Alex Rivera', role: 'Product Manager' },
    action: 'started a Huddle',
    target: '#general-huddles',
    category: 'messages',
    timestamp: '1 hour ago',
    accent: 'amber',
    details: '4 team members currently active in voice session discussing Q3 roadmap.',
    linkText: 'Join Huddle',
    reactions: { thumbsUp: 6, heart: 4, rocket: 2, userReacted: {} },
  },
  {
    id: 'p-5',
    user: { name: 'Dev User', role: 'Frontend Engineer' },
    action: 'updated document',
    target: 'AI Assistant Architecture Spec v2',
    category: 'tasks',
    timestamp: '2 hours ago',
    accent: 'sky',
    details: 'Added API integration specs for local Ollama and Anthropic Claude 3.5 Sonnet.',
    linkText: 'Open Document',
    reactions: { thumbsUp: 3, heart: 2, rocket: 4, userReacted: {} },
  },
  {
    id: 'p-6',
    user: { name: 'GitHub Integration', role: 'System Automation' },
    action: 'merged pull request',
    target: 'PR #184: Linear Inspired Design System',
    category: 'ai',
    timestamp: '3 hours ago',
    accent: 'purple',
    details: '14 commits merged into main with 0 build warnings.',
    linkText: 'View Commit',
    reactions: { thumbsUp: 9, heart: 5, rocket: 11, userReacted: {} },
  },
];

export function ActivityTimelineView() {
  const [items, setItems] = useState<PulseItem[]>(INITIAL_PULSE_ITEMS);
  const [activeTab, setActiveTab] = useState<ActivityCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newStatusText, setNewStatusText] = useState('');

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusText.trim()) return;

    const newItem: PulseItem = {
      id: `p-${Date.now()}`,
      user: { name: 'You', role: 'Workspace Member' },
      action: 'posted a pulse status',
      details: newStatusText.trim(),
      category: 'status',
      timestamp: 'Just now',
      accent: 'violet',
      reactions: { thumbsUp: 0, heart: 0, rocket: 0, userReacted: {} },
    };

    setItems((prev) => [newItem, ...prev]);
    setNewStatusText('');
  };

  const handleToggleReaction = (itemId: string, reactionType: 'thumbsUp' | 'heart' | 'rocket') => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const currentReacted = item.reactions.userReacted?.[reactionType] ?? false;
        const currentCount = item.reactions[reactionType];
        return {
          ...item,
          reactions: {
            ...item.reactions,
            [reactionType]: currentReacted ? Math.max(0, currentCount - 1) : currentCount + 1,
            userReacted: {
              ...(item.reactions.userReacted ?? {}),
              [reactionType]: !currentReacted,
            },
          },
        };
      }),
    );
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesTab = activeTab === 'all' || item.category === activeTab;
      const matchesSearch =
        searchQuery === '' ||
        item.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.target && item.target.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.details && item.details.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [items, activeTab, searchQuery]);

  return (
    <Page>
      <PageHeader
        title="Pulse"
        description="Real-time stream of team activity, AI automation events, and status check-ins across your workspace."
        icon={<Activity />}
        accent="violet"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems([...INITIAL_PULSE_ITEMS])}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh Feed</span>
          </Button>
        }
      />

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3.5 bg-surface border-border flex items-center gap-3">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Users className="size-4" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-foreground">12</div>
            <div className="text-[11px] text-muted-foreground font-medium">Active Teammates</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-surface border-border flex items-center gap-3">
          <div className="size-9 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
            <Zap className="size-4" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-foreground">48</div>
            <div className="text-[11px] text-muted-foreground font-medium">Events Today</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-surface border-border flex items-center gap-3">
          <div className="size-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-foreground">18</div>
            <div className="text-[11px] text-muted-foreground font-medium">AI Actions</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-surface border-border flex items-center gap-3">
          <div className="size-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-foreground">9</div>
            <div className="text-[11px] text-muted-foreground font-medium">Tasks Completed</div>
          </div>
        </Card>
      </div>

      {/* Share Status Check-in Form */}
      <Card className="p-4 mb-6 bg-surface border border-border rounded-card">
        <form onSubmit={handleAddStatus} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <UserAvatar name="You" size="sm" presence="online" />
            <Input
              value={newStatusText}
              onChange={(e) => setNewStatusText(e.target.value)}
              placeholder="Post a quick pulse update or team status check-in…"
              className="flex-1 text-xs"
            />
          </div>
          <Button type="submit" size="sm" disabled={!newStatusText.trim()} className="gap-1.5 shrink-0">
            <Send className="size-3.5" />
            <span>Post Update</span>
          </Button>
        </form>
      </Card>

      <Panel>
        {/* Controls Header: Tabs & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-4 border-b border-border mb-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 md:pb-0">
            {(
              [
                { id: 'all', label: 'All Activity' },
                { id: 'status', label: 'Pulse Updates' },
                { id: 'ai', label: 'AI & Automations' },
                { id: 'tasks', label: 'Tasks & Docs' },
                { id: 'messages', label: 'Huddles & Channels' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-btn transition-colors shrink-0',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-48 max-w-72">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feed…"
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {/* Timeline Feed */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            No activity events match your filter or search query.
          </div>
        ) : (
          <ol className="space-y-6 pl-6 relative border-l border-border/60">
            {filteredItems.map((entry) => {
              const categoryIcon =
                entry.category === 'ai'
                  ? Sparkles
                  : entry.category === 'tasks'
                    ? CheckCircle2
                    : entry.category === 'messages'
                      ? Video
                      : Flame;

              const Icon = categoryIcon;

              return (
                <li key={entry.id} className="relative group">
                  {/* Category Marker Dot */}
                  <span
                    aria-hidden
                    className={cn(
                      'top-1 size-7 absolute -left-[35px] flex items-center justify-center rounded-full border border-border bg-surface shadow-sm transition-transform group-hover:scale-110',
                      entry.category === 'ai'
                        ? 'text-primary bg-primary/10'
                        : entry.category === 'tasks'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : entry.category === 'messages'
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-violet-400 bg-violet-500/10',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>

                  {/* Card Container */}
                  <div className="p-4 rounded-card border border-border bg-surface hover:bg-surface-raised/40 transition-colors space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={entry.user.name} size="sm" seed={entry.id} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {entry.user.name}
                            </span>
                            {entry.user.role ? (
                              <Badge variant="subtle" className="text-[10px] py-0 px-1.5 font-normal">
                                {entry.user.role}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.action}{' '}
                            {entry.target ? (
                              <span className="font-medium text-foreground">{entry.target}</span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-subtle">
                        <Clock className="size-3" />
                        <span>{entry.timestamp}</span>
                      </div>
                    </div>

                    {/* Details Content */}
                    {entry.details ? (
                      <p className="text-xs text-foreground/90 leading-relaxed bg-surface-raised/60 p-2.5 rounded-md border border-border/50">
                        {entry.details}
                      </p>
                    ) : null}

                    {/* Footer Actions & Reactions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleReaction(entry.id, 'thumbsUp')}
                          className={cn(
                            'px-2 py-0.5 text-[11px] font-medium rounded-md border flex items-center gap-1 transition-colors',
                            entry.reactions.userReacted?.thumbsUp
                              ? 'bg-primary/10 border-primary/40 text-primary'
                              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <ThumbsUp className="size-3" />
                          <span>{entry.reactions.thumbsUp}</span>
                        </button>

                        <button
                          onClick={() => handleToggleReaction(entry.id, 'heart')}
                          className={cn(
                            'px-2 py-0.5 text-[11px] font-medium rounded-md border flex items-center gap-1 transition-colors',
                            entry.reactions.userReacted?.heart
                              ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Heart className="size-3" />
                          <span>{entry.reactions.heart}</span>
                        </button>

                        <button
                          onClick={() => handleToggleReaction(entry.id, 'rocket')}
                          className={cn(
                            'px-2 py-0.5 text-[11px] font-medium rounded-md border flex items-center gap-1 transition-colors',
                            entry.reactions.userReacted?.rocket
                              ? 'bg-violet-500/10 border-violet-500/40 text-violet-400'
                              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Flame className="size-3" />
                          <span>{entry.reactions.rocket}</span>
                        </button>
                      </div>

                      {entry.linkText ? (
                        <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary h-7 px-2">
                          <span>{entry.linkText}</span>
                          <ArrowRight className="size-3" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </Page>
  );
}

