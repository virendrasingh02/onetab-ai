import type { NodeRunResult } from './node-chrome.js';

/** A step's state in a run. */
export type CanvasNodeStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed'
  | 'waiting'
  | 'skipped'
  | 'cancelled';

/** What a card shows: `entering` is the moment the wire into it is lighting up. */
export type ShownNodeStatus = CanvasNodeStatus | 'entering';

/** What a wire shows while a run is on the canvas. */
export type EdgeRunStatus =
  | 'pending'
  | 'flowing'
  | 'done'
  | 'running'
  | 'waiting'
  | 'failed'
  | 'skipped';

export interface RunPlaybackEvent {
  id: string;
  status: ShownNodeStatus;
}

/** How long the pulse takes to cross a wire; matches `.run-wire-*` in styles.css. */
export const WIRE_TRAVEL_MS = 520;
/** A step that was over between two polls still reads as having run. */
const MIN_RUNNING_MS = 340;
const AFTER_FINISH_MS = 120;
/** A long run that settled between polls catches up within this time. */
const MAX_PLAYBACK_MS = 4_000;

/**
 * Steps reach us later than they happened; these are the moves the canvas
 * still has to show, in run order. Every step passes through `entering` and
 * `running`, however quickly it really finished, so a run reads as data moving
 * through the graph rather than everything lighting up at once.
 *
 * @param planned the status each node will have once the queue has played
 * @param target the server's latest statuses, in run order
 */
export function planTransitions(
  planned: Record<string, ShownNodeStatus>,
  target: Record<string, CanvasNodeStatus>,
): { events: RunPlaybackEvent[]; planned: Record<string, ShownNodeStatus> } {
  const next = { ...planned };
  const events: RunPlaybackEvent[] = [];
  const move = (id: string, status: ShownNodeStatus) => {
    events.push({ id, status });
    next[id] = status;
  };
  for (const [id, status] of Object.entries(target)) {
    const current = next[id];
    if (status === 'idle' || status === current) continue;
    if (current === undefined && status !== 'skipped') {
      // The first step has no wire coming into it
      if (Object.keys(next).length > 0) move(id, 'entering');
      if (status !== 'running') move(id, 'running');
    }
    move(id, status);
  }
  return { events, planned: next };
}

function delayAfter(status: ShownNodeStatus): number {
  if (status === 'entering') return WIRE_TRAVEL_MS;
  if (status === 'running') return MIN_RUNNING_MS;
  return AFTER_FINISH_MS;
}

/** The wait after `event`, shortened when much is left to play. */
export function playbackDelay(
  event: RunPlaybackEvent,
  queue: RunPlaybackEvent[],
): number {
  const left = queue.reduce((sum, e) => sum + delayAfter(e.status), 0);
  return (
    delayAfter(event.status) * Math.min(1, MAX_PLAYBACK_MS / Math.max(left, 1))
  );
}

/** A wire's state, from the two cards it joins. `shown` is null with no run on the canvas. */
export function edgeRunStatus(
  shown: Record<string, ShownNodeStatus> | null,
  source: string,
  target: string,
  attachment: boolean,
): EdgeRunStatus | undefined {
  if (!shown) return undefined;
  const from = shown[source];
  const to = shown[target];
  // Plugged into an agent: live while that agent works, otherwise left alone
  if (attachment) return from === 'running' ? 'running' : undefined;
  if (to === 'skipped') return 'skipped';
  // A skipped step still hands on what it was given (a simulated write in a test run)
  if ((from !== 'success' && from !== 'skipped') || !to) return 'pending';
  if (to === 'entering') return 'flowing';
  if (to === 'failed') return 'failed';
  if (to === 'waiting') return 'waiting';
  return 'done';
}

/**
 * The run's results as far as the canvas has played: nothing for a step it
 * hasn't reached, and no output for one it still shows as working.
 */
export function revealResults(
  results: Record<string, NodeRunResult>,
  shown: Record<string, ShownNodeStatus> | null,
): Record<string, NodeRunResult> {
  if (!shown) return results;
  const visible: Record<string, NodeRunResult> = {};
  for (const [id, result] of Object.entries(results)) {
    const status = shown[id];
    if (result.cleared) visible[id] = result;
    else if (status === 'running' && result.status !== 'running')
      visible[id] = {
        ...result,
        status,
        output: '',
        error: undefined,
        tokens: 0,
      };
    else if (status && status !== 'entering')
      visible[id] = { ...result, status };
  }
  return visible;
}

/** The step the canvas has got to: the latest one at work or being reached. */
export function activeStep(
  shown: Record<string, ShownNodeStatus> | null,
): string | undefined {
  return Object.entries(shown ?? {})
    .filter(([, status]) => status === 'running' || status === 'entering')
    .pop()?.[0];
}

/** The card a step belongs to: `compileStudioGraph` puts helper steps in front of app cards. */
export function stepOwner(stepId: string): string {
  return stepId.replace(/__(input|approval)$/, '');
}
