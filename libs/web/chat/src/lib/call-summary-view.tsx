import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  useConfirm,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
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
import React, { useState } from 'react';
import type {
  CallActionItemView,
  CallDecisionView,
  CallTranscriptItemView,
} from '@org/types';
import {
  useCall,
  useCallActionItems,
  useCallDecisions,
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
  isLive?: boolean;
}

export function CallSummaryView({
  workspaceId,
  callId,
  onClose,
  className,
  isLive = false,
}: CallSummaryViewProps) {
  useCallRealtimeSync(workspaceId, callId);

  const { data: call } = useCall(workspaceId, callId);
  const { data: notes } = useCallNotes(workspaceId, callId);
  const { data: summary, isLoading: isSummaryLoading } = useCallSummary(workspaceId, callId);
  const { data: actionItems = [] } = useCallActionItems(workspaceId, callId);
  const { data: decisions = [] } = useCallDecisions(workspaceId, callId);
  const { data: transcripts = [] } = useCallTranscripts(workspaceId, callId);

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
  } = useCallMutations(workspaceId);

  const confirm = useConfirm();

  // Active tab
  const [activeTab, setActiveTab] = useState<'summary' | 'notes' | 'actions' | 'decisions' | 'transcript'>('summary');

  // Notes autosave
  const activeNote = notes?.[0];
  const {
    content: noteContent,
    updateContent: updateNoteContent,
    status: noteStatus,
    retry: retryNoteSave,
  } = useCallNotesAutosave({
    workspaceId,
    callId,
    initialContent: activeNote?.content ?? '',
  });

  // Notes AI assistant prompt state
  const [isAssistLoading, setIsAssistLoading] = useState(false);

  // Ask about this call Q&A state
  const [askDrawerOpen, setAskDrawerOpen] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string }>>([]);

  // Transcript search filter
  const [transcriptQuery, setTranscriptQuery] = useState('');

  // New action item state
  const [newActionTitle, setNewActionTitle] = useState('');

  // New decision state
  const [newDecisionText, setNewDecisionText] = useState('');

  // Feedback state
  const [feedbackSent, setFeedbackSent] = useState<'helpful' | 'unhelpful' | null>(null);

  // Edit overview inline
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState('');

  const handleSaveOverview = async (newOverview: string) => {
    try {
      await updateSummary.mutateAsync({
        callId,
        input: { overview: newOverview },
      });
      setIsEditingOverview(false);
      toast.success('Overview updated.');
    } catch {
      toast.error('Failed to update overview.');
    }
  };

  const handleNotesAssist = async (
    action: 'summarize' | 'cleanup' | 'extract_actions' | 'extract_decisions' | 'generate_followup' | 'format',
  ) => {
    if (!noteContent.trim()) {
      toast.error('Write some notes first before running AI actions.');
      return;
    }
    setIsAssistLoading(true);
    try {
      const resp = await assistNotes.mutateAsync({
        callId,
        input: { notes: noteContent, action },
      });
      updateNoteContent(resp.result);
      toast.success(`Notes improved with ${action.replace('_', ' ')}!`);
    } catch {
      toast.error('Failed to run AI assistance on notes.');
    } finally {
      setIsAssistLoading(false);
    }
  };

  const handleAskQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!questionInput.trim() || askQuestion.isPending) return;

    const currentQ = questionInput.trim();
    setQuestionInput('');
    try {
      const resp = await askQuestion.mutateAsync({
        callId,
        input: { question: currentQ },
      });
      setChatHistory((prev) => [...prev, { q: currentQ, a: resp.answer }]);
    } catch {
      toast.error('Failed to get an answer.');
    }
  };

  const handleRegenerateSection = async (
    section:
      | 'all'
      | 'overview'
      | 'keyPoints'
      | 'decisions'
      | 'actionItems'
      | 'openQuestions'
      | 'followUps',
  ) => {
    const ok = await confirm({
      title: `Regenerate ${section}?`,
      description: `This will query the AI to recreate the "${section}" section. Any manual changes in this section will be replaced.`,
      confirmLabel: 'Regenerate',
    });
    if (!ok) return;

    try {
      await regenerateSummarySection.mutateAsync({
        callId,
        input: { section, confirmOverwrite: true },
      });
      toast.success(`Regenerated ${section}!`);
    } catch {
      toast.error('Regeneration failed.');
    }
  };

  const handleCreateAction = async () => {
    if (!newActionTitle.trim()) return;
    try {
      await createActionItem.mutateAsync({
        callId,
        input: {
          title: newActionTitle.trim(),
          priority: 'MEDIUM',
        },
      });
      setNewActionTitle('');
      toast.success('Action item added.');
    } catch {
      toast.error('Failed to add action item.');
    }
  };

  const handleShare = async (target: 'participants' | 'workspace') => {
    try {
      await shareSummary.mutateAsync({
        callId,
        input: { target, postMessageToChat: false },
      });
      toast.success(
        target === 'workspace'
          ? 'Notified the workspace about this call summary.'
          : 'Notified the call participants.',
      );
    } catch {
      toast.error('Failed to share this summary.');
    }
  };

  const handleCreateDecision = async () => {
    if (!newDecisionText.trim()) return;
    try {
      await createDecision.mutateAsync({
        callId,
        input: { content: newDecisionText.trim() },
      });
      setNewDecisionText('');
      toast.success('Decision recorded.');
    } catch {
      toast.error('Failed to record decision.');
    }
  };

  const filteredTranscripts = transcripts.filter(
    (t) =>
      !transcriptQuery.trim() ||
      t.text.toLowerCase().includes(transcriptQuery.toLowerCase()) ||
      t.speakerName?.toLowerCase().includes(transcriptQuery.toLowerCase()),
  );

  return (
    <div className={cn('flex flex-col h-full bg-background border-l border-border select-text', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {call?.title || 'Call Notes & Summary'}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Meeting
                </span>
              ) : (
                <span>Recorded Call Session</span>
              )}
              {summary?.status && (
                <Badge
                  variant={
                    summary.status === 'READY' ||
                    summary.status === 'EDITED' ||
                    summary.status === 'APPROVED'
                      ? 'success'
                      : summary.status === 'FAILED'
                      ? 'destructive'
                      : 'neutral'
                  }
                  className="text-[10px] py-0"
                >
                  {summary.status}
                </Badge>
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
                title="Share this call summary"
              >
                <Share2 className="size-3.5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void handleShare('participants')}>
                Notify call participants
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleShare('workspace')}>
                Notify the whole workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAskDrawerOpen(!askDrawerOpen)}
            className="text-xs gap-1.5 h-8"
            title="Ask anything grounded in this call"
          >
            <Bot className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Ask AI</span>
          </Button>

          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close notes">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Header */}
      <div className="px-4 pt-2 border-b border-border bg-card/20">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-5 h-8 bg-muted/40 p-0.5 rounded-lg text-xs">
            <TabsTrigger value="summary" className="py-1">
              Summary
            </TabsTrigger>
            <TabsTrigger value="notes" className="py-1">
              Notes
              {noteStatus === 'saving' && <Loader2 className="size-2.5 animate-spin ml-1 text-primary" />}
            </TabsTrigger>
            <TabsTrigger value="actions" className="py-1">
              Actions
              {actionItems.length > 0 && <span className="ml-1 text-[10px] opacity-70">({actionItems.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="decisions" className="py-1">
              Decisions
              {decisions.length > 0 && <span className="ml-1 text-[10px] opacity-70">({decisions.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="transcript" className="py-1">
              Transcript
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Tab Contents */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {/* TAB 1: SUMMARY */}
        {activeTab === 'summary' && (
          <div className="p-4 space-y-6">
            {!summary && isSummaryLoading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <Spinner />
                <p className="text-xs text-muted-foreground">Loading AI summary...</p>
              </div>
            ) : !summary ? (
              <EmptyState
                icon={<Sparkles className="size-8 text-primary" />}
                title="No summary generated yet"
                description="Generate an AI-powered structured summary with decisions, action items, and key takeaways."
                action={
                  <Button
                    onClick={() => generateSummary.mutate(callId)}
                    disabled={generateSummary.isPending}
                    className="gap-1.5 text-xs"
                  >
                    {generateSummary.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Generate AI Summary
                  </Button>
                }
              />
            ) : summary.status === 'PROCESSING' ? (
              <div className="p-8 flex flex-col items-center justify-center space-y-4 border border-border/80 rounded-2xl bg-card/40">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                  <Sparkles className="size-5" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="text-sm font-semibold">Generating AI Call Summary...</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Analyzing transcript, agenda, and participant notes to extract structured insights and action items.
                  </p>
                </div>
                <Spinner />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Section: Overview */}
                <div className="p-4 rounded-xl border border-border bg-card/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" /> Overview
                    </h4>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setOverviewDraft(summary.overview || '');
                          setIsEditingOverview(!isEditingOverview);
                        }}
                        className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground"
                      >
                        {isEditingOverview ? 'Cancel' : 'Edit'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRegenerateSection('overview')}
                        disabled={regenerateSummarySection.isPending}
                        className="text-[11px] h-6 px-2 text-primary"
                        title="Regenerate Overview"
                      >
                        <RefreshCw className={cn('size-3', regenerateSummarySection.isPending && 'animate-spin')} />
                      </Button>
                    </div>
                  </div>

                  {isEditingOverview ? (
                    <div className="space-y-2 pt-1">
                      <Textarea
                        value={overviewDraft}
                        onChange={(e) => setOverviewDraft(e.target.value)}
                        className="text-xs min-h-[80px]"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="xs"
                          onClick={() => handleSaveOverview(overviewDraft)}
                          className="text-xs"
                        >
                          Save Overview
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {summary.overview}
                    </p>
                  )}
                </div>

                {/* Section: Key Points */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Key Discussion Points
                      </h4>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRegenerateSection('keyPoints')}
                        disabled={regenerateSummarySection.isPending}
                        className="text-[11px] h-6 px-2 text-primary"
                        title="Regenerate Key Points"
                      >
                        <RefreshCw className={cn('size-3', regenerateSummarySection.isPending && 'animate-spin')} />
                      </Button>
                    </div>
                    <ul className="space-y-1.5 pl-1">
                      {summary.keyPoints.map((point: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-foreground/90">
                          <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Section: Decisions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-500" /> Decisions ({decisions.length})
                    </h4>
                    <Button variant="ghost" size="xs" onClick={() => setActiveTab('decisions')} className="text-xs text-primary">
                      Manage
                    </Button>
                  </div>
                  {decisions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No decisions captured yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {decisions.map((d: CallDecisionView) => (
                        <div key={d.id} className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-foreground flex items-start justify-between">
                          <span>{d.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section: Action Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ListTodo className="size-3.5 text-primary" /> Action Items ({actionItems.length})
                    </h4>
                    <Button variant="ghost" size="xs" onClick={() => setActiveTab('actions')} className="text-xs text-primary">
                      Manage
                    </Button>
                  </div>
                  {actionItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No action items yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {actionItems.map((item: CallActionItemView) => (
                        <div key={item.id} className="p-2.5 rounded-lg border border-border bg-card/40 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.status === 'DONE'}
                              onChange={(e) =>
                                updateActionItem.mutate({
                                  callId,
                                  itemId: item.id,
                                  input: { status: e.target.checked ? 'DONE' : 'TODO' },
                                })
                              }
                              className="rounded border-border text-primary focus:ring-primary size-3.5"
                            />
                            <span className={cn('truncate', item.status === 'DONE' && 'line-through text-muted-foreground')}>
                              {item.title}
                            </span>
                          </div>
                          {item.taskId ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600">
                              Task Linked
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => convertActionItemToTask.mutate({ callId, itemId: item.id })}
                              className="text-[10px] h-6 px-1.5 text-primary"
                              title="Convert to Workspace Task"
                            >
                              Convert to Task
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section: Open Questions & Follow-ups */}
                {Array.isArray(summary.openQuestions) && summary.openQuestions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <HelpCircle className="size-3.5 text-amber-500" /> Open Questions
                    </h4>
                    <ul className="space-y-1 pl-4 list-disc text-xs text-foreground">
                      {summary.openQuestions.map((q: string, idx: number) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary Feedback Footer */}
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>Was this AI summary helpful?</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={feedbackSent === 'helpful' ? 'default' : 'ghost'}
                      size="icon-sm"
                      onClick={() => {
                        submitSummaryFeedback.mutate({ callId, input: { rating: 'HELPFUL' } });
                        setFeedbackSent('helpful');
                        toast.success('Thanks for your feedback!');
                      }}
                      title="Helpful"
                    >
                      <ThumbsUp className="size-3.5" />
                    </Button>
                    <Button
                      variant={feedbackSent === 'unhelpful' ? 'destructive' : 'ghost'}
                      size="icon-sm"
                      onClick={() => {
                        submitSummaryFeedback.mutate({ callId, input: { rating: 'NOT_HELPFUL' } });
                        setFeedbackSent('unhelpful');
                        toast.info('Thanks, we will improve future summaries.');
                      }}
                      title="Not helpful"
                    >
                      <ThumbsDown className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NOTES */}
        {activeTab === 'notes' && (
          <div className="p-4 flex flex-col h-full space-y-3">
            {/* AI Action Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleNotesAssist('cleanup')}
                disabled={isAssistLoading}
                className="text-[11px] gap-1 h-7 whitespace-nowrap"
              >
                <Sparkles className="size-3 text-primary" /> Clean up
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleNotesAssist('extract_actions')}
                disabled={isAssistLoading}
                className="text-[11px] gap-1 h-7 whitespace-nowrap"
              >
                <ListTodo className="size-3 text-emerald-500" /> Extract actions
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleNotesAssist('extract_decisions')}
                disabled={isAssistLoading}
                className="text-[11px] gap-1 h-7 whitespace-nowrap"
              >
                <CheckCircle2 className="size-3 text-blue-500" /> Extract decisions
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleNotesAssist('format')}
                disabled={isAssistLoading}
                className="text-[11px] gap-1 h-7 whitespace-nowrap"
              >
                Format notes
              </Button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-h-[300px] border border-border rounded-xl bg-card/40 overflow-hidden focus-within:ring-1 focus-within:ring-primary">
              <Textarea
                value={noteContent}
                onChange={(e) => updateNoteContent(e.target.value)}
                placeholder="Take running call notes here... Auto-saved in real-time."
                className="flex-1 resize-none border-none p-4 text-sm font-sans focus-visible:ring-0 rounded-none bg-transparent"
              />
              <div className="px-3 py-1.5 bg-muted/20 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  {noteStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-primary">
                      <Loader2 className="size-3 animate-spin" /> Saving draft...
                    </span>
                  )}
                  {noteStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Check className="size-3" /> Saved
                    </span>
                  )}
                  {noteStatus === 'failed' && (
                    <button type="button" onClick={retryNoteSave} className="flex items-center gap-1 text-destructive hover:underline">
                      <AlertCircle className="size-3" /> Save failed (click to retry)
                    </button>
                  )}
                  {noteStatus === 'offline' && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Clock className="size-3" /> Offline (backed up locally)
                    </span>
                  )}
                </div>
                <span>{noteContent.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACTION ITEMS */}
        {activeTab === 'actions' && (
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newActionTitle}
                onChange={(e) => setNewActionTitle(e.target.value)}
                placeholder="Add action item..."
                className="text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateAction();
                }}
              />
              <Button
                size="sm"
                onClick={handleCreateAction}
                disabled={!newActionTitle.trim() || createActionItem.isPending}
                className="gap-1 text-xs"
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </div>

            <div className="space-y-2">
              {actionItems.length === 0 ? (
                <EmptyState
                  icon={<ListTodo className="size-6 text-muted-foreground" />}
                  title="No action items yet"
                  description="Capture next steps or extract them directly from your notes."
                />
              ) : (
                actionItems.map((item: CallActionItemView) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border bg-card/30 flex items-center justify-between gap-3 group hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.status === 'DONE'}
                        onChange={(e) =>
                          updateActionItem.mutate({
                            callId,
                            itemId: item.id,
                            input: { status: e.target.checked ? 'DONE' : 'TODO' },
                          })
                        }
                        className="rounded border-border text-primary focus:ring-primary size-4"
                      />
                      <span className={cn('text-xs font-medium text-foreground truncate', item.status === 'DONE' && 'line-through text-muted-foreground')}>
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.taskId ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-600">
                          Workspace Task Linked
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => convertActionItemToTask.mutate({ callId, itemId: item.id })}
                          className="text-[11px] h-7"
                        >
                          Convert to Task
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteActionItem.mutate({ callId, itemId: item.id })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete action item"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DECISIONS */}
        {activeTab === 'decisions' && (
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newDecisionText}
                onChange={(e) => setNewDecisionText(e.target.value)}
                placeholder="Record a key decision made..."
                className="text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateDecision();
                }}
              />
              <Button
                size="sm"
                onClick={handleCreateDecision}
                disabled={!newDecisionText.trim() || createDecision.isPending}
                className="gap-1 text-xs"
              >
                <Plus className="size-3.5" /> Record
              </Button>
            </div>

            <div className="space-y-2">
              {decisions.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-6 text-emerald-500" />}
                  title="No decisions recorded"
                  description="Decisions keep the team aligned on agreed outcomes."
                />
              ) : (
                decisions.map((decision: CallDecisionView) => (
                  <div
                    key={decision.id}
                    className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-xs text-foreground leading-relaxed">{decision.content}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteDecision.mutate({ callId, decisionId: decision.id })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete decision"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: TRANSCRIPT */}
        {activeTab === 'transcript' && (
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={transcriptQuery}
                onChange={(e) => setTranscriptQuery(e.target.value)}
                placeholder="Search transcript by keyword or speaker..."
                className="pl-8 text-xs h-8"
              />
            </div>

            {filteredTranscripts.length === 0 ? (
              <EmptyState
                icon={<Clock className="size-6 text-muted-foreground" />}
                title={transcriptQuery ? 'No matching transcript lines' : 'No transcript recorded yet'}
                description={
                  transcriptQuery
                    ? 'Try another search keyword.'
                    : 'Transcripts appear automatically when audio transcription is active.'
                }
              />
            ) : (
              <div className="space-y-3 pt-2">
                {filteredTranscripts.map((t: CallTranscriptItemView) => (
                  <div key={t.id} className="text-xs space-y-1 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-semibold text-foreground">{t.speakerName || 'Speaker'}</span>
                      <span className="font-mono text-[10px]">
                        {Math.floor(t.timestamp / 60)}:{(t.timestamp % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed pl-2 border-l-2 border-primary/40">{t.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grounded "Ask about this call" Drawer */}
        {askDrawerOpen && (
          <div className="absolute inset-x-0 bottom-0 top-1/4 bg-card/95 backdrop-blur-md border-t border-border z-30 flex flex-col shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Bot className="size-4 text-primary" />
                <span>Ask about this call (Grounded AI)</span>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setAskDrawerOpen(false)}>
                <X className="size-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {chatHistory.length === 0 && (
                <div className="text-center p-6 space-y-2">
                  <p className="text-muted-foreground">Ask questions strictly grounded in this call's transcript & notes.</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {['What were the main decisions?', 'Who is responsible for the database migration?', 'Did anyone disagree?'].map(
                      (q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setQuestionInput(q);
                          }}
                          className="px-2.5 py-1 rounded-full border border-border text-[11px] bg-card hover:bg-muted/40 transition-colors"
                        >
                          {q}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {chatHistory.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary font-medium w-fit max-w-[85%] self-end ml-auto">
                    {item.q}
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-border text-foreground leading-relaxed whitespace-pre-wrap">
                    {item.a}
                  </div>
                </div>
              ))}

              {askQuestion.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground italic">
                  <Loader2 className="size-3 animate-spin text-primary" /> Thinking...
                </div>
              )}
            </div>

            <form onSubmit={handleAskQuestion} className="p-3 border-t border-border flex gap-2">
              <Input
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Ask about something discussed in this call..."
                className="text-xs flex-1"
              />
              <Button size="sm" type="submit" disabled={!questionInput.trim() || askQuestion.isPending} className="px-3">
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
