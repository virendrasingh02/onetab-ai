import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./connector-nodes.js', () => ({
  useConnectorNode: () => ({}),
  useConnectorCatalogNodes: () => ({ nodes: [], loading: false }),
}));

import { EndNode, STUDIO_NODE_TYPES } from './custom-nodes.js';

function renderNode(Node: React.ComponentType<any>, data: Record<string, unknown>, type = 'END') {
  return render(
    <ReactFlowProvider>
      <Node id="n1" type={type} selected={false} data={{ label: 'Output', config: {}, ...data }} />
    </ReactFlowProvider>,
  );
}

describe('Output card', () => {
  afterEach(() => document.body.replaceChildren());

  it('empty: offers "Run a test", which starts a test run', () => {
    const onTest = vi.fn();
    renderNode(EndNode, { onTest });
    fireEvent.click(screen.getByRole('button', { name: /Run a test/ }));
    expect(onTest).toHaveBeenCalledWith('n1');
    expect((screen.getByRole('button', { name: 'Copy output' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Clear output' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('running: waits, no "Run a test"', () => {
    renderNode(EndNode, { onTest: vi.fn(), run: { status: 'running', output: '', tokens: 0, latencyMs: 0 } });
    expect(screen.getByText('Waiting for the agent…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Run a test/ })).toBeNull();
  });

  it('with output: renders it and enables clear', () => {
    const onClearRun = vi.fn();
    renderNode(EndNode, { onClearRun, run: { status: 'success', output: '**Done**', tokens: 10, latencyMs: 5 } });
    expect(screen.getByText('Done')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear output' }));
    expect(onClearRun).toHaveBeenCalled();
  });

  it('has no output handle or add-next', () => {
    const { container } = renderNode(EndNode, {});
    expect(container.querySelectorAll('.react-flow__handle-right, .react-flow__handle.source').length).toBe(0);
    expect(screen.queryByTitle('Add connected node')).toBeNull();
  });
});

describe('issue badge', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows compiler and team issues once, in one badge', () => {
    const Node = (STUDIO_NODE_TYPES as Record<string, React.ComponentType<any>>)['END'];
    renderNode(Node, {
      issues: [{ level: 'error', message: 'No model' }],
      team: { role: 'solo', model: null, issues: ['No model', 'No instructions'] },
    });
    const badges = screen.getAllByRole('button', { name: /problem/ });
    expect(badges.length).toBe(1);
    expect(badges[0].getAttribute('aria-label')).toBe('Output: 2 problems — No model No instructions');
  });
});
