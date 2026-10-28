import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('./connector-nodes.js', () => ({
  useConnectorNode: () => hook.value,
  useConnectorCatalogNodes: () => ({ nodes: [], loading: false }),
}));

import { AppConnectorNode } from './custom-nodes.js';

const connector = { name: 'BambooHR', slug: 'bamboohr', category: 'hr', capabilities: [{}, {}, {}, {}, {}] };
const writeCap = { kind: 'action', permissionLevel: 'write', requiresConfirmation: true };

function renderCard(app: Record<string, unknown>, data: Record<string, unknown> = {}, selected = false) {
  hook.value = { loading: false, connected: false, slug: 'bamboohr', ...app };
  const props = {
    id: 'n1',
    type: 'GENERIC_CONNECTOR',
    selected,
    data: { label: 'App', onEdit: vi.fn(), config: {}, ...data },
  } as any;
  const { container } = render(
    <ReactFlowProvider>
      <AppConnectorNode {...props} />
    </ReactFlowProvider>,
  );
  return container.firstElementChild as HTMLElement;
}

describe('AppConnectorNode states', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => document.body.replaceChildren());

  it('not connected: amber edge, status line, Connect CTA, kind + approval tags', () => {
    const card = renderCard(
      { provider: 'bamboohr', label: 'Request time off', connector, capability: writeCap },
      { config: { actionIds: ['a'] } },
    );
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.getByText('Request time off')).toBeTruthy();
    expect(screen.getByText('5 actions')).toBeTruthy();
    expect(screen.getByText('Writes')).toBeTruthy();
    expect(screen.getByText('Needs approval')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Connect BambooHR/ })).toBeTruthy();
    expect(card.className).toContain('border-warning/50');
    expect(card.className).toContain('w-[280px]');
  });

  it('connected read action: Reads tag, Configure, no amber, no approval tag', () => {
    const card = renderCard({
      provider: 'shopify',
      label: 'List orders',
      connected: true,
      connector: { ...connector, name: 'Shopify', capabilities: [{}] },
      capability: { kind: 'query', permissionLevel: 'read' },
    });
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('1 action')).toBeTruthy();
    expect(screen.getByText('Reads')).toBeTruthy();
    expect(screen.queryByText('Needs approval')).toBeNull();
    expect(screen.getByRole('button', { name: /Configure/ })).toBeTruthy();
    expect(card.className).not.toContain('border-warning');
  });

  it('destructive action shows Deletes tag', () => {
    renderCard({ provider: 'x', label: 'Delete record', connected: true, connector, capability: { kind: 'action', permissionLevel: 'destructive' } });
    expect(screen.getByText('Deletes')).toBeTruthy();
  });

  it('no action picked: muted prompt, no connection CTA', () => {
    renderCard({ provider: undefined, label: undefined, connector });
    expect(screen.getAllByText('Pick an action').length).toBe(2);
    expect(screen.getByRole('button', { name: /Configure/ })).toBeTruthy();
  });

  it('checking connection: loading line, no Connect CTA yet', () => {
    renderCard({ provider: 'bamboohr', label: 'Request time off', loading: true, connector });
    expect(screen.getByText('Checking connection…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Connect/ })).toBeNull();
  });

  it('unknown app: flagged, falls back to Configure', () => {
    renderCard({ provider: 'gone', label: 'Old action', connector: undefined });
    expect(screen.getByText('Unknown app')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Configure/ })).toBeTruthy();
  });

  it('as agent tool: enabled count, no kind tag or total', () => {
    renderCard(
      { provider: 'bamboohr', label: 'Request time off', connected: true, connector, capability: writeCap },
      { config: { actionIds: ['a', 'b'] }, attachedTo: { slot: 'Tools', label: 'Agent 1' } },
    );
    expect(screen.getByText('2 of 5 actions enabled')).toBeTruthy();
    expect(screen.queryByText('Writes')).toBeNull();
    expect(screen.queryByText('Needs approval')).toBeNull();
    expect(screen.queryByText('5 actions')).toBeNull();
    expect(screen.getByText(/Tools · Agent 1/)).toBeTruthy();
  });

  it('shows up to two input params inside the action block', () => {
    renderCard(
      { provider: 'bamboohr', label: 'Request time off', connected: true, connector },
      { config: { input: { employeeId: '42', days: 3, note: 'x', empty: '' } } },
    );
    expect(screen.getByText('employeeId:')).toBeTruthy();
    expect(screen.getByText('days:')).toBeTruthy();
    expect(screen.queryByText('note:')).toBeNull();
  });

  it('run states override the amber edge', () => {
    const card = renderCard({ provider: 'bamboohr', label: 'Request time off', connector }, { status: 'failed' });
    expect(card.className).toContain('border-destructive');
    expect(card.className).not.toContain('border-warning/50');
  });

  it('selected card drops the amber edge for the selection ring', () => {
    const card = renderCard({ provider: 'bamboohr', label: 'Request time off', connector }, {}, true);
    expect(card.className).toContain('ring-foreground/60');
    expect(card.className).not.toContain('border-warning/50');
  });
});
