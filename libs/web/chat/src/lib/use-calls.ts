import { callsApi, queryKeys } from '@org/api-client';
import { useRealtimeListener } from '@org/realtime';
import type {
  AskCallQuestionRequest,
  AskCallQuestionResponse,
  CallActionItemView,
  CallDecisionView,
  CallDetailView,
  CallNoteView,
  CallNotesAssistRequest,
  CallNotesAssistResponse,
  CallSummaryView,
  CallTranscriptItemView,
  CallUpdatedRealtimePayload,
  CallView,
} from '@org/types';
import type {
  AppendCallTranscriptInput,
  CallSummaryFeedbackInput,
  CreateCallActionItemInput,
  CreateCallDecisionInput,
  CreateCallInput,
  RegenerateCallSummarySectionInput,
  ShareCallSummaryInput,
  UpdateCallActionItemInput,
  UpdateCallDecisionInput,
  UpdateCallSummaryInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

/** How often an open summary re-checks while the model is still working. */
const PROCESSING_POLL_MS = 4_000;

// ============================================================================
// Queries
// ============================================================================

export function useCallsList(
  workspaceId: string | undefined,
  filters?: { status?: string; conversationId?: string; meetingId?: string },
) {
  return useQuery<CallView[]>({
    queryKey: queryKeys.calls.list(workspaceId ?? '', filters),
    queryFn: () => callsApi.listCalls(workspaceId as string, filters),
    enabled: !!workspaceId,
    staleTime: 10_000,
  });
}

/** One call with its notes, summary, decisions, action items and transcript. */
export function useCallDetail(
  workspaceId: string | undefined,
  callId: string | null | undefined,
) {
  return useQuery<CallDetailView>({
    queryKey: queryKeys.calls.detail(workspaceId ?? '', callId ?? ''),
    queryFn: () => callsApi.getCall(workspaceId as string, callId as string),
    enabled: !!workspaceId && !!callId,
  });
}

export function useCallNotes(
  workspaceId: string | undefined,
  callId: string | null | undefined,
) {
  return useQuery<CallNoteView[]>({
    queryKey: queryKeys.calls.notes(workspaceId ?? '', callId ?? ''),
    queryFn: () => callsApi.getNotes(workspaceId as string, callId as string),
    enabled: !!workspaceId && !!callId,
  });
}

export function useCallSummary(
  workspaceId: string | undefined,
  callId: string | null | undefined,
) {
  return useQuery<CallSummaryView | null>({
    queryKey: queryKeys.calls.summary(workspaceId ?? '', callId ?? ''),
    queryFn: () => callsApi.getSummary(workspaceId as string, callId as string),
    enabled: !!workspaceId && !!callId,
    // Realtime announces the READY flip; the poll only covers a missed event
    // (reconnecting tab, API restart) so the spinner can never hang forever.
    refetchInterval: (query) =>
      query.state.data?.status === 'PROCESSING' ? PROCESSING_POLL_MS : false,
  });
}

export function useCallActionItems(
  workspaceId: string | undefined,
  callId: string | null | undefined,
) {
  return useQuery<CallActionItemView[]>({
    queryKey: queryKeys.calls.actionItems(workspaceId ?? '', callId ?? ''),
    queryFn: () => callsApi.getActionItems(workspaceId as string, callId as string),
    enabled: !!workspaceId && !!callId,
  });
}

export function useCallDecisions(
  workspaceId: string | undefined,
  callId: string | null | undefined,
) {
  return useQuery<CallDecisionView[]>({
    queryKey: queryKeys.calls.decisions(workspaceId ?? '', callId ?? ''),
    queryFn: () => callsApi.getDecisions(workspaceId as string, callId as string),
    enabled: !!workspaceId && !!callId,
  });
}

export function useCallTranscripts(
  workspaceId: string | undefined,
  callId: string | null | undefined,
) {
  return useQuery<CallTranscriptItemView[]>({
    queryKey: queryKeys.calls.transcripts(workspaceId ?? '', callId ?? ''),
    queryFn: () => callsApi.getTranscripts(workspaceId as string, callId as string),
    enabled: !!workspaceId && !!callId,
  });
}

// ============================================================================
// Realtime invalidation
// ============================================================================

/**
 * Keeps an open call view live. The server broadcasts `call.started` /
 * `call.ended` / `call.updated` with ids only; this refetches just the slices
 * that changed, through the access-checked API.
 */
export function useCallRealtimeSync(
  workspaceId: string | undefined,
  callId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    (key: readonly unknown[]) => void queryClient.invalidateQueries({ queryKey: key }),
    [queryClient],
  );

  useRealtimeListener<{ callId: string }>('call.started', () => {
    if (workspaceId) invalidate(queryKeys.calls.list(workspaceId));
  });

  useRealtimeListener<{ callId: string }>('call.ended', (event) => {
    if (!workspaceId) return;
    invalidate(queryKeys.calls.list(workspaceId));
    if (callId && event.payload?.callId === callId) {
      invalidate(queryKeys.calls.detail(workspaceId, callId));
    }
  });

  useRealtimeListener<CallUpdatedRealtimePayload>('call.updated', (event) => {
    if (!workspaceId || !callId || event.payload?.callId !== callId) return;
    const keys = queryKeys.calls;
    switch (event.payload.entity) {
      case 'note':
        invalidate(keys.notes(workspaceId, callId));
        break;
      case 'summary':
        invalidate(keys.summary(workspaceId, callId));
        // A finished summary brings extracted decisions and action items.
        invalidate(keys.decisions(workspaceId, callId));
        invalidate(keys.actionItems(workspaceId, callId));
        break;
      case 'action_item':
        invalidate(keys.actionItems(workspaceId, callId));
        break;
      case 'decision':
        invalidate(keys.decisions(workspaceId, callId));
        break;
      case 'transcript':
        invalidate(keys.transcripts(workspaceId, callId));
        break;
      default:
        break;
    }
    invalidate(keys.detail(workspaceId, callId));
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCallMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = workspaceId ?? '';
  const keys = queryKeys.calls;
  const invalidate = (key: readonly unknown[]) =>
    void queryClient.invalidateQueries({ queryKey: key });

  const startCall = useMutation({
    mutationFn: (input: CreateCallInput) => callsApi.startCall(ws, input),
    onSuccess: () => invalidate(keys.list(ws)),
  });

  const endCall = useMutation({
    mutationFn: (callId: string) => callsApi.endCall(ws, callId),
    onSuccess: (_data, callId) => {
      invalidate(keys.list(ws));
      invalidate(keys.detail(ws, callId));
    },
  });

  const generateSummary = useMutation({
    mutationFn: (callId: string) => callsApi.generateSummary(ws, callId),
    onSuccess: (summary, callId) => {
      queryClient.setQueryData(keys.summary(ws, callId), summary);
      invalidate(keys.detail(ws, callId));
      invalidate(keys.decisions(ws, callId));
      invalidate(keys.actionItems(ws, callId));
    },
  });

  const regenerateSummarySection = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: RegenerateCallSummarySectionInput;
    }) => callsApi.regenerateSummarySection(ws, callId, input),
    onSuccess: (summary, { callId }) => {
      queryClient.setQueryData(keys.summary(ws, callId), summary);
      invalidate(keys.decisions(ws, callId));
      invalidate(keys.actionItems(ws, callId));
    },
  });

  const updateSummary = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: UpdateCallSummaryInput;
    }) => callsApi.updateSummary(ws, callId, input),
    onSuccess: (summary, { callId }) => {
      queryClient.setQueryData(keys.summary(ws, callId), summary);
    },
  });

  const submitSummaryFeedback = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: CallSummaryFeedbackInput;
    }) => callsApi.submitSummaryFeedback(ws, callId, input),
  });

  const shareSummary = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: ShareCallSummaryInput;
    }) => callsApi.shareSummary(ws, callId, input),
    onSuccess: (_data, { callId }) => invalidate(keys.detail(ws, callId)),
  });

  const askQuestion = useMutation<
    AskCallQuestionResponse,
    Error,
    { callId: string; input: AskCallQuestionRequest }
  >({
    mutationFn: ({ callId, input }) => callsApi.askQuestion(ws, callId, input),
  });

  const assistNotes = useMutation<
    CallNotesAssistResponse,
    Error,
    { callId: string; input: CallNotesAssistRequest }
  >({
    mutationFn: ({ callId, input }) => callsApi.assistNotes(ws, callId, input),
  });

  const createActionItem = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: CreateCallActionItemInput;
    }) => callsApi.createActionItem(ws, callId, input),
    onSuccess: (_data, { callId }) => invalidate(keys.actionItems(ws, callId)),
  });

  const updateActionItem = useMutation({
    mutationFn: ({
      callId,
      itemId,
      input,
    }: {
      callId: string;
      itemId: string;
      input: UpdateCallActionItemInput;
    }) => callsApi.updateActionItem(ws, callId, itemId, input),
    onSuccess: (_data, { callId }) => invalidate(keys.actionItems(ws, callId)),
  });

  const deleteActionItem = useMutation({
    mutationFn: ({ callId, itemId }: { callId: string; itemId: string }) =>
      callsApi.deleteActionItem(ws, callId, itemId),
    onSuccess: (_data, { callId }) => invalidate(keys.actionItems(ws, callId)),
  });

  const convertActionItemToTask = useMutation({
    mutationFn: ({ callId, itemId }: { callId: string; itemId: string }) =>
      callsApi.convertActionItemToTask(ws, callId, itemId),
    onSuccess: (_data, { callId }) => {
      invalidate(keys.actionItems(ws, callId));
      invalidate(queryKeys.workTools.all(ws));
    },
  });

  const createDecision = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: CreateCallDecisionInput;
    }) => callsApi.createDecision(ws, callId, input),
    onSuccess: (_data, { callId }) => invalidate(keys.decisions(ws, callId)),
  });

  const updateDecision = useMutation({
    mutationFn: ({
      callId,
      decisionId,
      input,
    }: {
      callId: string;
      decisionId: string;
      input: UpdateCallDecisionInput;
    }) => callsApi.updateDecision(ws, callId, decisionId, input),
    onSuccess: (_data, { callId }) => invalidate(keys.decisions(ws, callId)),
  });

  const deleteDecision = useMutation({
    mutationFn: ({ callId, decisionId }: { callId: string; decisionId: string }) =>
      callsApi.deleteDecision(ws, callId, decisionId),
    onSuccess: (_data, { callId }) => invalidate(keys.decisions(ws, callId)),
  });

  const appendTranscript = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: AppendCallTranscriptInput;
    }) => callsApi.appendTranscript(ws, callId, input),
    onSuccess: (_data, { callId }) => invalidate(keys.transcripts(ws, callId)),
  });

  return {
    startCall,
    endCall,
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
    updateDecision,
    deleteDecision,
    appendTranscript,
  };
}

// ============================================================================
// Live notes autosave
// ============================================================================

export type AutosaveStatus = 'saved' | 'saving' | 'failed' | 'offline';

export interface UseCallNotesAutosaveOptions {
  workspaceId: string | undefined;
  callId: string | undefined;
  /** The caller's own saved note, once loaded — never someone else's. */
  savedContent?: string;
  /** False until the notes query settles, so a slow load can't clobber typing. */
  isLoaded?: boolean;
  debounceMs?: number;
}

const draftKey = (callId: string) => `onetab:call-note:${callId}`;

function readDraft(callId: string): string | null {
  try {
    return localStorage.getItem(draftKey(callId));
  } catch {
    return null;
  }
}

function writeDraft(callId: string, content: string | null): void {
  try {
    if (content === null) localStorage.removeItem(draftKey(callId));
    else localStorage.setItem(draftKey(callId), content);
  } catch {
    // Private mode / quota — the in-memory draft still holds.
  }
}

/**
 * The live notes editor's state. Every save upserts the caller's single running
 * note (`PUT …/notes/mine`), debounced while typing and flushed when the editor
 * closes. A local draft covers offline gaps and is restored on the next open if
 * it is newer than what the server has.
 */
export function useCallNotesAutosave({
  workspaceId,
  callId,
  savedContent,
  isLoaded = true,
  debounceMs = 800,
}: UseCallNotesAutosaveOptions) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastSaved = useRef('');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededFor = useRef<string | null>(null);

  // Seed once per call: the server copy, unless an unsent local draft differs.
  useEffect(() => {
    if (!callId || !isLoaded || seededFor.current === callId) return;
    seededFor.current = callId;
    const server = savedContent ?? '';
    const draft = readDraft(callId);
    lastSaved.current = server;
    if (draft !== null && draft !== server) {
      setContent(draft);
      pending.current = draft;
      setStatus('saving');
    } else {
      setContent(server);
      setStatus('saved');
    }
  }, [callId, isLoaded, savedContent]);

  const save = useCallback(
    async (text: string) => {
      if (!workspaceId || !callId) return;
      if (text === lastSaved.current) {
        pending.current = null;
        setStatus('saved');
        writeDraft(callId, null);
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatus('offline');
        writeDraft(callId, text);
        return;
      }
      setStatus('saving');
      try {
        const note = await callsApi.upsertMyNote(workspaceId, callId, { content: text });
        lastSaved.current = note.content;
        if (pending.current === text) pending.current = null;
        setLastSavedAt(new Date(note.updatedAt));
        setStatus(pending.current === null ? 'saved' : 'saving');
        writeDraft(callId, pending.current);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.calls.notes(workspaceId, callId),
        });
      } catch {
        setStatus('failed');
        writeDraft(callId, text);
      }
    },
    [workspaceId, callId, queryClient],
  );

  const updateContent = useCallback(
    (text: string) => {
      setContent(text);
      pending.current = text;
      setStatus('saving');
      if (callId) writeDraft(callId, text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(text), debounceMs);
    },
    [callId, debounceMs, save],
  );

  const retry = useCallback(() => {
    if (pending.current !== null) void save(pending.current);
  }, [save]);

  // Coming back online retries whatever was typed while offline.
  useEffect(() => {
    const onOnline = () => {
      if (pending.current !== null) void save(pending.current);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [save]);

  // Closing the editor (hang-up, dialog close) must not drop the last words
  // typed inside the debounce window.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) void save(pending.current);
    };
  }, [save]);

  return { content, updateContent, status, lastSavedAt, retry };
}
