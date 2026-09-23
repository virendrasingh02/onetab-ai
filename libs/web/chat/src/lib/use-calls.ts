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
  CallView,
} from '@org/types';
import type {
  AppendCallTranscriptInput,
  CallSummaryFeedbackInput,
  CreateCallActionItemInput,
  CreateCallDecisionInput,
  CreateCallInput,
  EndCallInput,
  RegenerateCallSummarySectionInput,
  ShareCallSummaryInput,
  UpdateCallActionItemInput,
  UpdateCallDecisionInput,
  UpdateCallSummaryInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

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

export function useCall(
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
// Realtime Invalidation
// ============================================================================

export function useCallRealtimeSync(workspaceId: string | undefined, callId: string | null | undefined) {
  const queryClient = useQueryClient();

  useRealtimeListener('call.started', () => {
    if (!workspaceId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.calls.list(workspaceId) });
  });

  useRealtimeListener('call.ended', (payload: any) => {
    if (!workspaceId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.calls.list(workspaceId) });
    if (callId && payload?.callId === callId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.detail(workspaceId, callId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.summary(workspaceId, callId) });
    }
  });

  useRealtimeListener('note.updated', (payload: any) => {
    if (!workspaceId) return;
    if (callId && payload?.callId === callId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.notes(workspaceId, callId) });
    }
  });

  useRealtimeListener('summary.updated', (payload: any) => {
    if (!workspaceId) return;
    if (callId && payload?.callId === callId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.summary(workspaceId, callId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.detail(workspaceId, callId) });
    }
  });

  useRealtimeListener('action_item.updated', (payload: any) => {
    if (!workspaceId) return;
    if (callId && payload?.callId === callId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.actionItems(workspaceId, callId) });
    }
  });

  useRealtimeListener('decision.updated', (payload: any) => {
    if (!workspaceId) return;
    if (callId && payload?.callId === callId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.decisions(workspaceId, callId) });
    }
  });
}

// ============================================================================
// Call Session & Summary Mutations
// ============================================================================

export function useCallMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = workspaceId ?? '';

  const startCall = useMutation({
    mutationFn: (input: CreateCallInput) => callsApi.startCall(ws, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.list(ws) });
    },
  });

  const endCall = useMutation({
    mutationFn: ({ callId }: { callId: string; input?: EndCallInput }) =>
      callsApi.endCall(ws, callId),
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.list(ws) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.detail(ws, callId) });
    },
  });

  const generateSummary = useMutation({
    mutationFn: (callId: string) => callsApi.generateSummary(ws, callId),
    onSuccess: (_data, callId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.summary(ws, callId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.detail(ws, callId) });
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
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.summary(ws, callId) });
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
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.summary(ws, callId) });
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
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.actionItems(ws, callId) });
    },
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
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.actionItems(ws, callId) });
    },
  });

  const deleteActionItem = useMutation({
    mutationFn: ({ callId, itemId }: { callId: string; itemId: string }) =>
      callsApi.deleteActionItem(ws, callId, itemId),
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.actionItems(ws, callId) });
    },
  });

  const convertActionItemToTask = useMutation({
    mutationFn: ({ callId, itemId }: { callId: string; itemId: string }) =>
      callsApi.convertActionItemToTask(ws, callId, itemId),
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.actionItems(ws, callId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workTools.all(ws) });
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
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.decisions(ws, callId) });
    },
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
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.decisions(ws, callId) });
    },
  });

  const deleteDecision = useMutation({
    mutationFn: ({ callId, decisionId }: { callId: string; decisionId: string }) =>
      callsApi.deleteDecision(ws, callId, decisionId),
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.decisions(ws, callId) });
    },
  });

  const appendTranscript = useMutation({
    mutationFn: ({
      callId,
      input,
    }: {
      callId: string;
      input: AppendCallTranscriptInput;
    }) => callsApi.appendTranscript(ws, callId, input),
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.transcripts(ws, callId) });
    },
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
// Notes Debounced Autosave Hook with Offline Fallback
// ============================================================================

export type AutosaveStatus = 'saved' | 'saving' | 'failed' | 'offline';

export interface UseCallNotesAutosaveOptions {
  workspaceId: string | undefined;
  callId: string | undefined;
  initialContent?: string;
  debounceMs?: number;
}

export function useCallNotesAutosave({
  workspaceId,
  callId,
  initialContent = '',
  debounceMs = 800,
}: UseCallNotesAutosaveOptions) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const localKey = `onetab:call-note:${callId}`;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initialContent when it loads from server if user hasn't typed anything
  useEffect(() => {
    if (initialContent && !content) {
      setContent(initialContent);
      setLastSavedContent(initialContent);
    }
  }, [initialContent]);

  // Check local offline backup on mount
  useEffect(() => {
    if (!callId) return;
    try {
      const cached = localStorage.getItem(localKey);
      if (cached && cached !== initialContent && !content) {
        setContent(cached);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [callId]);

  const saveToServer = useCallback(
    async (textToSave: string) => {
      if (!workspaceId || !callId) return;
      if (textToSave === lastSavedContent) {
        setStatus('saved');
        return;
      }

      if (!navigator.onLine) {
        setStatus('offline');
        try {
          localStorage.setItem(localKey, textToSave);
        } catch {
          // Private mode / quota exceeded — the in-memory draft still holds.
        }
        return;
      }

      setStatus('saving');
      try {
        await callsApi.addNote(workspaceId, callId, { content: textToSave });
        setLastSavedContent(textToSave);
        setLastSavedAt(new Date());
        setStatus('saved');
        try {
          localStorage.removeItem(localKey);
        } catch {
          // Ignore — the backup is stale now regardless.
        }
        queryClient.invalidateQueries({
          queryKey: queryKeys.calls.notes(workspaceId, callId),
        });
      } catch {
        setStatus('failed');
        try {
          localStorage.setItem(localKey, textToSave);
        } catch {
          // Private mode / quota exceeded — the in-memory draft still holds.
        }
      }
    },
    [workspaceId, callId, lastSavedContent, localKey, queryClient],
  );

  const updateContent = useCallback(
    (newText: string) => {
      setContent(newText);
      setStatus('saving');

      // Update local storage backup immediately
      try {
        localStorage.setItem(localKey, newText);
      } catch {
        // Private mode / quota exceeded — the in-memory draft still holds.
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        void saveToServer(newText);
      }, debounceMs);
    },
    [debounceMs, localKey, saveToServer],
  );

  const retry = useCallback(() => {
    void saveToServer(content);
  }, [content, saveToServer]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    content,
    updateContent,
    status,
    lastSavedAt,
    retry,
  };
}
