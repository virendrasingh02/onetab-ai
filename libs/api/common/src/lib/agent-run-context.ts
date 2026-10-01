import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which AI agent run, if any, the current code is executing inside.
 *
 * `WorkflowEngineService` opens this scope around every step it runs, so work
 * a step causes further down the stack — a task created through
 * `WorkToolsService`, the domain event that emits, the trigger listener that
 * reacts to it — can tell it came from an agent without every signature in
 * between carrying it. Two things read it:
 *  - attribution: a task created by an agent records which agent and run;
 *  - loop safety: an event raised by an agent run does not re-trigger the
 *    workflow that raised it, and chains of agents triggering agents stop at
 *    {@link MAX_AGENT_TRIGGER_DEPTH}.
 */
export interface AgentRunScope {
  workflowId: string;
  runId: string;
  agentName: string;
  /** 0 for a run started by a person, a schedule or a non-agent event. */
  depth: number;
  /** A test run: attribution is skipped because nothing is written. */
  test?: boolean;
}

export const MAX_AGENT_TRIGGER_DEPTH = 2;

const storage = new AsyncLocalStorage<AgentRunScope>();

export function runInAgentScope<T>(scope: AgentRunScope, fn: () => Promise<T>): Promise<T> {
  return storage.run(scope, fn);
}

/** The agent run the caller is inside, or undefined outside one. */
export function currentAgentRun(): AgentRunScope | undefined {
  return storage.getStore();
}
