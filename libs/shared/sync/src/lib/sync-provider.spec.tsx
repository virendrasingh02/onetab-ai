import type * as Realtime from '@org/realtime';
import { RealtimeEventBus, RealtimeEventType } from '@org/realtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const realtime = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock('@org/realtime', async (importOriginal) => ({
  ...(await importOriginal<typeof Realtime>()),
  useRealtime: () => realtime.value,
}));

import { SyncProvider } from './sync-provider.js';

const WORKSPACE = 'ws-1';

function renderProvider() {
  const bus = new RealtimeEventBus();
  realtime.value = { bus, client: null, connectionState: 'connected' };
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const view = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SyncProvider workspaceId={WORKSPACE}>
          <div />
        </SyncProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

  const emitKanbanUpdate = () =>
    act(() => {
      bus.emit({
        id: `evt-${Math.random()}`,
        type: RealtimeEventType.KanbanUpdated,
        workspaceId: WORKSPACE,
        payload: {},
      } as never);
    });

  return { view, invalidate, emitKanbanUpdate };
}

describe('SyncProvider', () => {
  it('still applies realtime events after StrictMode re-runs its effects', async () => {
    const { invalidate, emitKanbanUpdate } = renderProvider();
    // Past the tick a stray disposal would have fired on.
    await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
    invalidate.mockClear();

    emitKanbanUpdate();

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['work-tools', WORKSPACE, 'tasks'],
    });
  });

  it('stops applying realtime events after a real unmount', async () => {
    const { view, invalidate, emitKanbanUpdate } = renderProvider();
    view.unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
    invalidate.mockClear();

    emitKanbanUpdate();

    expect(invalidate).not.toHaveBeenCalled();
  });
});
