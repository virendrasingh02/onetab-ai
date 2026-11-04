import { useCallback, useEffect, useRef, useState } from 'react';
import {
  planTransitions,
  playbackDelay,
  type CanvasNodeStatus,
  type RunPlaybackEvent,
  type ShownNodeStatus,
} from './run-flow.js';

export interface RunPlaybackMeta {
  runId: string;
  /** The server is done with this run. */
  settled?: boolean;
  /** An old run being looked at: show where it ended, don't replay it. */
  instant?: boolean;
}

export interface RunPlaybackView {
  shown: Record<string, ShownNodeStatus>;
  /** The run is over and the canvas has caught up. */
  settled: boolean;
}

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Plays a run on the canvas one step at a time. The server is polled, so
 * quick steps can finish between two reads; this keeps the order they ran in
 * and gives each one time to be seen. View state only, never saved.
 */
export function useRunPlayback() {
  const [view, setView] = useState<RunPlaybackView | null>(null);
  const live = useRef({
    runId: null as string | null,
    planned: {} as Record<string, ShownNodeStatus>,
    queue: [] as RunPlaybackEvent[],
    timer: null as ReturnType<typeof setTimeout> | null,
    settled: false,
  });

  const stop = useCallback(() => {
    const state = live.current;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.queue = [];
  }, []);

  const playNext = useCallback(() => {
    const state = live.current;
    const event = state.queue.shift();
    if (!event) {
      state.timer = null;
      return;
    }
    const settled = state.settled && state.queue.length === 0;
    setView((v) => ({
      shown: { ...v?.shown, [event.id]: event.status },
      settled,
    }));
    state.timer = setTimeout(playNext, playbackDelay(event, state.queue));
  }, []);

  const push = useCallback(
    (
      statuses: Record<string, CanvasNodeStatus> | null,
      meta?: RunPlaybackMeta,
    ) => {
      const state = live.current;
      if (!statuses || !meta) {
        stop();
        state.runId = null;
        state.planned = {};
        setView(null);
        return;
      }
      if (meta.runId !== state.runId) {
        stop();
        state.runId = meta.runId;
        state.planned = {};
        setView({ shown: {}, settled: false });
      }
      state.settled = !!meta.settled;
      const { events, planned } = planTransitions(state.planned, statuses);
      state.planned = planned;
      if (meta.instant || prefersReducedMotion()) {
        stop();
        setView({ shown: { ...planned }, settled: state.settled });
        return;
      }
      state.queue.push(...events);
      if (state.timer) return;
      if (state.queue.length) playNext();
      else setView((v) => v && { ...v, settled: state.settled });
    },
    [playNext, stop],
  );

  useEffect(() => stop, [stop]);

  return { view, push };
}
