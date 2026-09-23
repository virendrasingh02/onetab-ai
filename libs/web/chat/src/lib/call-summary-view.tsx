import { useCurrentUser } from '@org/auth';
import type {
  CallActionItemView,
  CallDecisionView,
  CallNotesAssistRequest,
  CallSummaryStatus,
  CallTranscriptItemView,
} from '@org/types';
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  UserAvatar,
  toast,
  useConfirm,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Link2,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  useCallActionItems,
  useCallDecisions,
  useCallDetail,
  useCallMutations,
  useCallNotes,
  useCallNotesAutosave,
  useCallRealtimeSync,
  useCallSummary,
  useCallTranscripts,
} from './use-calls.js';

export interface CallSummaryViewProps {
  workspaceId: string;
  callId: string;
  onClose?: () => void;
  className?: string;
  /** Docked beside a live call rather than opened afterwards. */
  isLive?: boolean;
}

type Tab = 'summary' | 'notes' | 'actions' | 'decisions' | 'transcript';
type Section = 'overview' | 'keyPoints' | 'openQuestions' | 'followUps';

const STATUS_BADGE: Record<
  CallSummaryStatus,
  { label: string; variant: 'success' | 'destructive' | 'neutral' | 'primary' }
> = {
  PROCESSING: { label: 'Generating', variant: 'neutral' },
  READY: { label: 'AI summary', variant: 'primary' },
  EDITED: { label: 'Edited', variant: 'neutral' },
  APPROVED: { label: 'Approved', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};

const ASSIST_LABEL: Record<CallNotesAssistRequest['action'], string> = {
  cleanup: 'Notes cleaned up',
  format: 'Notes formatted',
  summarize: 'Notes summarized',
  generate_followup: 'Follow-up drafted',
  extract_actions: 'Action items extracted',
  extract_decisions: 'Decisions extracted',
};

const clock = (secs: number) =>
  `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

function SectionHeading({
  icon,
  children,
  actions,
}: {
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}
        {children}
      </h4>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </div>
  );
}

/**
 * Notes, AI summary, decisions, action items and transcript for one call —
 * docked beside the live call, in the post-call dialog, and on `/calls`.
 */
export function CallSummaryView({
  workspaceId,
  callId,
  onClose,
  className,
  isLive = false,
}: CallSummaryViewProps) {
  useCallRealtimeSync(workspaceId, callId);

  const currentUser = useCurrentUser();
  const { slug } = useCurrentWorkspace();
  const { data: call } = useCallDetail(workspaceId, callId);
  const notesQuery = useCallNotes(workspaceId, callId);
  const { data: summary, isLoading: isSummaryLoading } = useCallSummary(workspaceId, callId);
  const { data: actionItems = [] } = useCallActionItems(workspaceId, callId);
  const { data: decisions = [] } = useCallDecisions(workspaceId, callId);
  const { data: transcripts = [] } = useCallTranscripts(workspaceId, callId);

  const mutations = useCallMutations(workspaceId);
  const {
    generateSummary,
    regenerateSummarySection,
    updateSummary,
    submitSummaryFeedback,
    shareSummary,
    askQuestion,
    assistNotes,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    convertActionItemToTask,
    createDecision,
    deleteDecision,
  } = mutations;

  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  // Each person edits their own running note; everyone else's is read-only.
  const myNote = notesQuery.data?.find((note) => note.authorId === currentUser?.id);
  const otherNotes = (notesQuery.data ?? []).filter(
    (note) => note.authorId !== currentUser?.id && note.content.trim(),
  );
  const notes = useCallNotesAutosave({
    workspaceId,
    callId,
    savedContent: myNote?.content,
    isLoaded: notesQuery.isSuccess,
  });

  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Array<{ q: string; a: string }>>([]);
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newDecisionText, setNewDecisionText] = useState('');
  const [feedback, setFeedback] = useState<'HELPFUL' | 'NOT_HELPFUL' | null>(null);
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState('');

  const humanEdited = summary?.status === 'EDITED' || summary?.status === 'APPROVED';

  const handleRegenerate = async (section: 'all' | Section) => {
    // Only a person's edits are worth a confirmation — replacing the model's
    // own previous answer loses nothing.
    if (humanEdited) {
      const ok = await confirm({
        title: section === 'all' ? 'Regenerate the summary?' : 'Regenerate this section?',
        description:
          'This summary was edited by hand. Regenerating replaces those edits with a fresh AI version.',
        confirmLabel: 'Regenerate',
      });
      if (!ok) return;
    }
    try {
      await regenerateSummarySection.mutateAsync({
        callId,
        input: { section, confirmOverwrite: humanEdited },
      });
      toast.success(section === 'all' ? 'Summary regenerated' : 'Section regenerated');
    } catch (err) {
      toast.error(errorMessage(err, 'Regeneration failed.'));
    }
  };

  const handleSaveOverview = async () => {
    try {
      await updateSummary.mutateAsync({ callId, input: { overview: overviewDraft } });
      setEditingOverview(false);
      toast.success('Overview updated');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the overview.'));
    }
  };

  const handleApprove = async () => {
    try {
      await updateSummary.mutateAsync({ callId, input: { status: 'APPROVED' } });
      toast.success('Summary approved');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not approve the summary.'));
    }
  };

  const handleNotesAssist = async (action: CallNotesAssistRequest['action']) => {
    const before = notes.content;
    if (!before.trim()) {
      toast.error('Write some notes first.');
      return;
    }
    try {
      const response = await assistNotes.mutateAsync({
        callId,
        input: { notes: before, action },
      });

      // Extraction turns lines into real items; it never overwrites the notes.
      if (action === 'extract_actions') {
        const items = response.actionItems ?? [];
        for (const item of items) {
          await createActionItem.mutateAsync({
            callId,
            input: { title: item.title, priority: 'MEDIUM' },
          });
        }
        toast.success(
          items.length
            ? `Added ${items.length} action ${items.length === 1 ? 'item' : 'items'}`
            : 'No action items found in your notes',
        );
        if (items.length) setActiveTab('actions');
        return;
      }
      if (action === 'extract_decisions') {
        const found = response.decisions ?? [];
        for (const content of found) {
          await createDecision.mutateAsync({ callId, input: { content } });
        }
        toast.success(
          found.length
            ? `Recorded ${found.length} ${found.length === 1 ? 'decision' : 'decisions'}`
            : 'No decisions found in your notes',
        );
        if (found.length) setActiveTab('decisions');
        return;
      }

      notes.updateContent(response.result);
      toast.success(ASSIST_LABEL[action], {
        action: { label: 'Undo', onClick: () => notes.updateContent(before) },
      });
    } catch (err) {
      toast.error(errorMessage(err, 'The AI assistant is unavailable right now.'));
    }
  };

  const handleAsk = async (event?: FormEvent) => {
    event?.preventDefault();
    const q = question.trim();
    if (!q || askQuestion.isPending) return;
    setQuestion('');
    try {
      const response = await askQuestion.mutateAsync({ callId, input: { question: q } });
      setAnswers((prev) => [...prev, { q, a: response.answer }]);
    } catch (err) {
      setQuestion(q);
      toast.error(errorMessage(err, 'Could not get an answer.'));
    }
  };

  const handleCreateAction = async () => {
    const title = newActionTitle.trim();
    if (!title) return;
    try {
      await createActionItem.mutateAsync({ callId, input: { title, priority: 'MEDIUM' } });
      setNewActionTitle('');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the action item.'));
    }
  };

  const handleCreateDecision = async () => {
    const content = newDecisionText.trim();
    if (!content) return;
    try {
      await createDecision.mutateAsync({ callId, input: { content } });
      setNewDecisionText('');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the decision.'));
    }
  };

  const handleConvert = async (item: CallActionItemView) => {
    try {
      await convertActionItemToTask.mutateAsync({ callId, itemId: item.id });
      toast.success('Added to tasks', { description: item.title });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the task.'));
    }
  };

  const handleDeleteAction = async (item: CallActionItemView) => {
    const ok = await confirm({
      title: 'Delete this action item?',
      description: item.taskId
        ? `"${item.title}" will be removed from this call. The task it created stays on the board.`
        : `"${item.title}" will be removed from this call.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteActionItem.mutate({ callId, itemId: item.id });
  };

  const handleDeleteDecision = async (decision: CallDecisionView) => {
    const ok = await confirm({
      title: 'Delete this decision?',
      description: `"${decision.content}" will be removed from this call.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteDecision.mutate({ callId, decisionId: decision.id });
  };

  const handleShare = async (target: 'participants' | 'workspace') => {
    try {
      const result = await shareSummary.mutateAsync({
        callId,
        input: { target, postMessageToChat: false },
      });
      toast.success(
        result.recipientCount > 0
          ? `Shared with ${result.recipientCount} ${result.recipientCount === 1 ? 'person' : 'people'}`
          : target === 'workspace'
            ? 'Shared with the workspace'
            : 'Everyone on the call can already see it',
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Could not share the summary.'));
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/w/${slug}/calls?callId=${callId}`;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Could not copy the link.'));
  };

  const handleFeedback = (rating: 'HELPFUL' | 'NOT_HELPFUL') => {
    setFeedback(rating);
    submitSummaryFeedback.mutate(
      { callId, input: { rating } },
      {
        onSuccess: () => toast.success('Thanks for the feedback'),
        onError: () => setFeedback(null),
      },
    );
  };

  const filteredTranscripts = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    return q
      ? transcripts.filter(
          (t) => t.text.toLowerCase().includes(q) || t.speakerName.toLowerCase().includes(q),
        )
      : transcripts;
  }, [transcripts, transcriptQuery]);

  const assistBusy = assistNotes.isPending || createActionItem.isPending || createDecision.isPending;
  const statusBadge = summary ? STATUS_BADGE[summary.status] : null;

  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-background select-text', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary-text shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {call?.title || 'Call notes & summary'}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {isLive ? (
                <span className="flex items-center gap-1.5 font-medium text-success-text">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Live call
                </span>
              ) : call?.endedAt ? (
                <span>
                  {new Date(call.startedAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              ) : null}
              {statusBadge && (
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 h-8"
                disabled={shareSummary.isPending}
              >
                <Share2 className="size-3.5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => void handleShare('participants')}>
                Notify people on the call
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleShare('workspace')}>
                Share with the workspace
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleCopyLink}>
                <Link2 className="mr-2 size-4" />
                Copy link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={askOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setAskOpen((open) => !open)}
            className="text-xs gap-1.5 h-8"
            aria-pressed={askOpen}
          >
            <Bot className="size-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </Button>

          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2 border-b border-border">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
          <TabsList className="grid grid-cols-5 h-8 text-xs">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1">
              Notes
              {notes.status === 'saving' && <Loader2 className="size-2.5 animate-spin" />}
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1">
              Actions
              {actionItems.length > 0 && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {actionItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="decisions" className="gap-1">
              Decisions
              {decisions.length > 0 && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {decisions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {/* SUMMARY */}
        {activeTab === 'summary' && (
          <div className="p-4 space-y-6">
            {!summary && isSummaryLoading ? (
              <div className="flex flex-col items-center justify-center p-12 gap-3">
                <Spinner />
                <p className="text-xs text-muted-foreground">Loading summary…</p>
              </div>
            ) : !summary ? (
              <EmptyState
                icon={<Sparkles className="size-8 text-primary-text" />}
                title={isLive ? 'The summary is written when the call ends' : 'No summary yet'}
                description="Decisions, action items and key points are extracted from the call's notes and transcript."
                action={
                  isLive ? undefined : (
                    <Button
                      onClick={() => generateSummary.mutate(callId)}
                      loading={generateSummary.isPending}
                      className="gap-1.5 text-xs"
                    >
                      <Sparkles className="size-4" />
                      Generate summary
                    </Button>
                  )
                }
              />
            ) : summary.status === 'PROCESSING' ? (
              <div className="p-8 flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface">
                <Spinner />
                <div className="text-center space-y-1">
                  <h4 className="text-sm font-semibold">Writing the summary…</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Reading the notes and transcript for decisions, action items and key points.
                    This usually takes a few seconds.
                  </p>
                </div>
              </div>
            ) : summary.status === 'FAILED' ? (
              <div className="p-6 flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 text-center">
                <AlertCircle className="size-6 text-destructive-text" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">The summary could not be generated</h4>
                  <p className="text-xs text-muted-foreground">
                    {summary.failureReason || 'Something went wrong while writing it.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => generateSummary.mutate(callId)}
                  loading={generateSummary.isPending}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="size-3.5" />
                  Try again
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {summary.failureReason ? (
                  <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-text">
                    <AlertCircle className="size-4 shrink-0 mt-px" />
                    <span className="flex-1">{summary.failureReason}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-6 px-2 text-warning-text hover:text-warning-text"
                      onClick={() => void handleRegenerate('all')}
                      loading={regenerateSummarySection.isPending}
                    >
                      Regenerate
                    </Button>
                  </div>
                ) : null}

                {/* Overview */}
                <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
                  <SectionHeading
                    icon={<Sparkles className="size-3.5 text-primary-text" />}
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setOverviewDraft(summary.overview ?? '');
                            setEditingOverview((editing) => !editing);
                          }}
                          className="h-6 px-2 text-[11px] text-muted-foreground"
                        >
                          {editingOverview ? 'Cancel' : 'Edit'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => void handleRegenerate('overview')}
                          disabled={regenerateSummarySection.isPending}
                          className="h-6 px-2 text-muted-foreground"
                          aria-label="Regenerate overview"
                        >
                          <RefreshCw
                            className={cn(
                              'size-3',
                              regenerateSummarySection.isPending && 'animate-spin',
                            )}
                          />
                        </Button>
                      </>
                    }
                  >
                    Overview
                  </SectionHeading>

                  {editingOverview ? (
                    <div className="space-y-2 pt-1">
                      <Textarea
                        value={overviewDraft}
                        onChange={(e) => setOverviewDraft(e.target.value)}
                        className="text-xs min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex justify-end">
                        <Button
                          size="xs"
                          onClick={() => void handleSaveOverview()}
                          loading={updateSummary.isPending}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground leading-relaxed">{summary.overview}</p>
                  )}
                </div>

                {summary.keyPoints.length > 0 && (
                  <div className="space-y-2">
                    <SectionHeading
                      actions={
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => void handleRegenerate('keyPoints')}
                          disabled={regenerateSummarySection.isPending}
                          className="h-6 px-2 text-muted-foreground"
                          aria-label="Regenerate key points"
                        >
                          <RefreshCw className="size-3" />
                        </Button>
                      }
                    >
                      Key points
                    </SectionHeading>
                    <ul className="space-y-1.5">
                      {summary.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-foreground">
                          <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <SectionHeading
                    icon={<CheckCircle2 className="size-3.5 text-success-text" />}
                    actions={
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setActiveTab('decisions')}
                        className="h-6 px-2 text-xs"
                      >
                        Manage
                      </Button>
                    }
                  >
                    Decisions ({decisions.length})
                  </SectionHeading>
                  {decisions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No decisions captured.</p>
                  ) : (
                    <ul className="space-y-2">
                      {decisions.map((d) => (
                        <li
                          key={d.id}
                          className="p-2.5 rounded-lg border border-success/25 bg-success/10 text-xs text-foreground"
                        >
                          {d.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <SectionHeading
                    icon={<ListTodo className="size-3.5 text-primary-text" />}
                    actions={
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setActiveTab('actions')}
                        className="h-6 px-2 text-xs"
                      >
                        Manage
                      </Button>
                    }
                  >
                    Action items ({actionItems.length})
                  </SectionHeading>
                  {actionItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No action items.</p>
                  ) : (
                    <div className="space-y-2">
                      {actionItems.map((item) => (
                        <ActionItemRow
                          key={item.id}
                          item={item}
                          compact
                          onToggle={(done) =>
                            updateActionItem.mutate({
                              callId,
                              itemId: item.id,
                              input: { status: done ? 'DONE' : 'TODO' },
                            })
                          }
                          onConvert={() => void handleConvert(item)}
                          converting={
                            convertActionItemToTask.isPending &&
                            convertActionItemToTask.variables?.itemId === item.id
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>

                {summary.openQuestions.length > 0 && (
                  <div className="space-y-2">
                    <SectionHeading icon={<HelpCircle className="size-3.5 text-warning-text" />}>
                      Open questions
                    </SectionHeading>
                    <ul className="space-y-1 pl-4 list-disc text-xs text-foreground">
                      {summary.openQuestions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.followUps.length > 0 && (
                  <div className="space-y-2">
                    <SectionHeading>Follow-ups</SectionHeading>
                    <ul className="space-y-1 pl-4 list-disc text-xs text-foreground">
                      {summary.followUps.map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.importantLinks.length > 0 && (
                  <div className="space-y-2">
                    <SectionHeading>Links</SectionHeading>
                    <ul className="space-y-1 text-xs">
                      {summary.importantLinks
                        .filter((link) => /^https?:\/\//i.test(link.url))
                        .map((link) => (
                          <li key={link.url}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary-text hover:underline"
                            >
                              {link.title}
                              <ExternalLink className="size-3" />
                            </a>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="mr-1">Was this summary helpful?</span>
                    <Button
                      variant={feedback === 'HELPFUL' ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      onClick={() => handleFeedback('HELPFUL')}
                      aria-label="Helpful"
                      aria-pressed={feedback === 'HELPFUL'}
                    >
                      <ThumbsUp className="size-3.5" />
                    </Button>
                    <Button
                      variant={feedback === 'NOT_HELPFUL' ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      onClick={() => handleFeedback('NOT_HELPFUL')}
                      aria-label="Not helpful"
                      aria-pressed={feedback === 'NOT_HELPFUL'}
                    >
                      <ThumbsDown className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => void handleRegenerate('all')}
                      disabled={regenerateSummarySection.isPending}
                      className="gap-1 text-xs"
                    >
                      <RefreshCw className="size-3" />
                      Regenerate
                    </Button>
                    {summary.status !== 'APPROVED' ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => void handleApprove()}
                        loading={updateSummary.isPending}
                        className="gap-1 text-xs"
                      >
                        <Check className="size-3" />
                        Approve
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTES */}
        {activeTab === 'notes' && (
          <div className="p-4 flex flex-col h-full gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  ['cleanup', 'Clean up'],
                  ['format', 'Format'],
                  ['extract_actions', 'Extract actions'],
                  ['extract_decisions', 'Extract decisions'],
                ] as const
              ).map(([action, label]) => (
                <Button
                  key={action}
                  variant="outline"
                  size="xs"
                  onClick={() => void handleNotesAssist(action)}
                  disabled={assistBusy}
                  className="text-[11px] gap-1 h-7 whitespace-nowrap"
                >
                  <Sparkles className="size-3 text-primary-text" />
                  {label}
                </Button>
              ))}
              {assistBusy ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
            </div>

            <div className="flex-1 flex flex-col min-h-[260px] rounded-xl border border-border bg-surface overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <Textarea
                value={notes.content}
                onChange={(e) => notes.updateContent(e.target.value)}
                placeholder={
                  notesQuery.isSuccess ? 'Your notes — saved as you type.' : 'Loading your notes…'
                }
                disabled={!notesQuery.isSuccess}
                aria-label="Your call notes"
                className="flex-1 resize-none border-none p-4 text-sm focus-visible:ring-0 rounded-none bg-transparent"
              />
              <div className="px-3 py-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span aria-live="polite" className="flex items-center gap-1">
                  {notes.status === 'saving' && (
                    <>
                      <Loader2 className="size-3 animate-spin" /> Saving…
                    </>
                  )}
                  {notes.status === 'saved' && (
                    <>
                      <Check className="size-3 text-success-text" /> Saved
                    </>
                  )}
                  {notes.status === 'failed' && (
                    <button
                      type="button"
                      onClick={notes.retry}
                      className="flex items-center gap-1 text-destructive-text hover:underline"
                    >
                      <AlertCircle className="size-3" /> Not saved — retry
                    </button>
                  )}
                  {notes.status === 'offline' && (
                    <span className="flex items-center gap-1 text-warning-text">
                      <Clock className="size-3" /> Offline — kept on this device
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {notes.content.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            </div>

            {otherNotes.length > 0 ? (
              <div className="space-y-2">
                <SectionHeading>Notes from others</SectionHeading>
                {otherNotes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-border bg-surface p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <UserAvatar
                        name={note.author.displayName || note.author.name}
                        src={note.author.avatarUrl}
                        seed={note.author.id}
                        size="xs"
                      />
                      <span className="font-medium text-foreground">
                        {note.author.displayName || note.author.name}
                      </span>
                    </div>
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* ACTION ITEMS */}
        {activeTab === 'actions' && (
          <div className="p-4 space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateAction();
              }}
            >
              <Input
                value={newActionTitle}
                onChange={(e) => setNewActionTitle(e.target.value)}
                placeholder="Add an action item…"
                className="text-xs flex-1"
                aria-label="New action item"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newActionTitle.trim()}
                loading={createActionItem.isPending}
                className="gap-1 text-xs"
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </form>

            {actionItems.length === 0 ? (
              <EmptyState
                icon={<ListTodo className="size-6 text-muted-foreground" />}
                title="No action items yet"
                description="Add next steps here, or extract them from your notes."
              />
            ) : (
              <div className="space-y-2">
                {actionItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    onToggle={(done) =>
                      updateActionItem.mutate({
                        callId,
                        itemId: item.id,
                        input: { status: done ? 'DONE' : 'TODO' },
                      })
                    }
                    onConvert={() => void handleConvert(item)}
                    converting={
                      convertActionItemToTask.isPending &&
                      convertActionItemToTask.variables?.itemId === item.id
                    }
                    onDelete={() => void handleDeleteAction(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* DECISIONS */}
        {activeTab === 'decisions' && (
          <div className="p-4 space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateDecision();
              }}
            >
              <Input
                value={newDecisionText}
                onChange={(e) => setNewDecisionText(e.target.value)}
                placeholder="Record a decision…"
                className="text-xs flex-1"
                aria-label="New decision"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newDecisionText.trim()}
                loading={createDecision.isPending}
                className="gap-1 text-xs"
              >
                <Plus className="size-3.5" /> Record
              </Button>
            </form>

            {decisions.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-6 text-muted-foreground" />}
                title="No decisions recorded"
                description="Decisions keep everyone aligned on what was agreed."
              />
            ) : (
              <div className="space-y-2">
                {decisions.map((decision) => (
                  <div
                    key={decision.id}
                    className="group p-3 rounded-xl border border-success/25 bg-success/10 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <CheckCircle2 className="size-4 text-success-text shrink-0 mt-0.5" />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs text-foreground leading-relaxed">{decision.content}</p>
                        {decision.madeBy || decision.sourceTimestamp != null ? (
                          <p className="text-[11px] text-muted-foreground">
                            {decision.madeBy
                              ? decision.madeBy.displayName || decision.madeBy.name
                              : null}
                            {decision.madeBy && decision.sourceTimestamp != null ? ' · ' : null}
                            {decision.sourceTimestamp != null ? clock(decision.sourceTimestamp) : null}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void handleDeleteDecision(decision)}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      aria-label="Delete decision"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRANSCRIPT */}
        {activeTab === 'transcript' && (
          <div className="p-4 space-y-3">
            <Input
              value={transcriptQuery}
              onChange={(e) => setTranscriptQuery(e.target.value)}
              placeholder="Search by keyword or speaker…"
              className="text-xs h-8"
              leadingIcon={<Search />}
              aria-label="Search transcript"
            />

            {filteredTranscripts.length === 0 ? (
              <EmptyState
                icon={<Clock className="size-6 text-muted-foreground" />}
                title={transcriptQuery ? 'No matching lines' : 'No transcript for this call'}
                description={
                  transcriptQuery
                    ? 'Try another keyword.'
                    : 'Lines appear here when transcription is on during the call.'
                }
              />
            ) : (
              <div className="space-y-3 pt-2">
                {filteredTranscripts.map((t: CallTranscriptItemView) => (
                  <div key={t.id} className="text-xs space-y-1 p-2 rounded-lg hover:bg-accent transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-semibold text-foreground">{t.speakerName}</span>
                      <span className="font-mono text-[10px] tabular-nums">{clock(t.timestamp)}</span>
                    </div>
                    <p className="text-foreground leading-relaxed pl-2 border-l-2 border-primary/40">
                      {t.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ask about this call */}
        {askOpen && (
          <div className="absolute inset-x-0 bottom-0 top-1/4 z-30 flex flex-col border-t border-border bg-surface shadow-overlay animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Bot className="size-4 text-primary-text" />
                Ask about this call
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setAskOpen(false)} aria-label="Close">
                <X className="size-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {answers.length === 0 && (
                <div className="text-center p-4 space-y-2">
                  <p className="text-muted-foreground">
                    Answers come only from this call&apos;s notes, summary and transcript.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {['What was decided?', 'Who owns the next steps?', 'What is still open?'].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuestion(q)}
                        className="px-2.5 py-1 rounded-full border border-border text-[11px] bg-background hover:bg-accent transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {answers.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="ml-auto w-fit max-w-[85%] rounded-xl bg-primary/10 p-2.5 font-medium text-primary-text">
                    {item.q}
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3 text-foreground leading-relaxed whitespace-pre-wrap">
                    {item.a}
                  </div>
                </div>
              ))}

              {askQuestion.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            <form onSubmit={handleAsk} className="p-3 border-t border-border flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about something discussed…"
                className="text-xs flex-1"
                aria-label="Question about this call"
              />
              <Button
                size="sm"
                type="submit"
                disabled={!question.trim() || askQuestion.isPending}
                aria-label="Ask"
              >
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionItemRow({
  item,
  compact = false,
  onToggle,
  onConvert,
  converting,
  onDelete,
}: {
  item: CallActionItemView;
  compact?: boolean;
  onToggle: (done: boolean) => void;
  onConvert: () => void;
  converting: boolean;
  onDelete?: () => void;
}) {
  const done = item.status === 'DONE';
  const assigneeName = item.assignee?.displayName || item.assignee?.name;
  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface',
        compact ? 'p-2.5' : 'p-3',
      )}
    >
      <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
        <Checkbox
          checked={done}
          onCheckedChange={(checked) => onToggle(checked === true)}
          aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
        />
        <span
          className={cn(
            'text-xs text-foreground truncate',
            !compact && 'font-medium',
            done && 'line-through text-muted-foreground',
          )}
        >
          {item.title}
        </span>
      </label>

      <div className="flex items-center gap-2 shrink-0">
        {item.assignee && assigneeName ? (
          <UserAvatar
            name={assigneeName}
            src={item.assignee.avatarUrl}
            seed={item.assignee.id}
            size="xs"
            title={`Assigned to ${assigneeName}`}
          />
        ) : null}
        {item.taskId ? (
          <Badge variant="success">In tasks</Badge>
        ) : (
          <Button
            variant={compact ? 'ghost' : 'outline'}
            size="xs"
            onClick={onConvert}
            loading={converting}
            className="text-[11px] h-6 px-2"
          >
            Add to tasks
          </Button>
        )}
        {onDelete ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-label="Delete action item"
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
