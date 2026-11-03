import type { AIAgentMessageContent } from '@org/types';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentRunProgress } from './agent-run-progress.js';

function createRun(
  overrides: Partial<AIAgentMessageContent> = {},
): AIAgentMessageContent {
  return {
    type: 'mie.ai.agent',
    agentId: 'agent-1',
    status: 'running',
    startedAt: Date.now(),
    ...overrides,
  };
}

describe('AgentRunProgress', () => {
  it('folds tools into one nameless step when tool calls are hidden', () => {
    render(
      <AgentRunProgress
        event={createRun({
          tools: [
            {
              name: 'gmail.search_messages',
              status: 'running',
              input: { q: 'invoices' },
            },
          ],
        })}
        hasContent={false}
        showTools={false}
      />,
    );

    const steps = within(screen.getByRole('list'));
    expect(steps.getByText('Using tools')).toBeInTheDocument();
    expect(screen.queryByText(/gmail/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /inspect/i }),
    ).not.toBeInTheDocument();
  });

  it('announces the current step, never the ticking timer', () => {
    render(
      <AgentRunProgress
        event={createRun({ startedAt: Date.now() - 12_000 })}
        hasContent={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /working on it · 12s/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe(
      'Understanding your request',
    );
  });

  it('starts a finished run open when asked to', () => {
    render(
      <AgentRunProgress
        event={createRun({
          status: 'completed',
          durationMs: 3_000,
          tools: [{ name: 'Collect Sources', status: 'success' }],
        })}
        hasContent
        openWhenDone
      />,
    );

    expect(
      screen.getByRole('button', { name: /worked for 3s · used 1 tool/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Collect Sources')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
