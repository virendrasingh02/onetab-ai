import { beforeEach, describe, expect, it } from 'vitest';
import { useSplitViewStore } from './split-view-store.js';

const dev = { id: 'c-dev', slug: 'dev', name: 'dev' };
const random = { id: 'c-random', slug: 'random', name: 'random' };

describe('useSplitViewStore', () => {
  beforeEach(() => {
    useSplitViewStore.setState({ byWorkspace: {} });
  });

  it('starts with nothing open', () => {
    expect(useSplitViewStore.getState().byWorkspace).toEqual({});
  });

  it('opens a channel for one workspace only', () => {
    useSplitViewStore.getState().open('ws-1', dev);

    const { byWorkspace } = useSplitViewStore.getState();
    expect(byWorkspace['ws-1']).toEqual(dev);
    expect(byWorkspace['ws-2']).toBeUndefined();
  });

  it('replaces the channel when another is opened in the same workspace', () => {
    useSplitViewStore.getState().open('ws-1', dev);
    useSplitViewStore.getState().open('ws-1', random);

    expect(useSplitViewStore.getState().byWorkspace['ws-1']).toEqual(random);
  });

  it('keeps each workspace’s pane when another workspace closes its own', () => {
    useSplitViewStore.getState().open('ws-1', dev);
    useSplitViewStore.getState().open('ws-2', random);
    useSplitViewStore.getState().close('ws-2');

    const { byWorkspace } = useSplitViewStore.getState();
    expect(byWorkspace['ws-1']).toEqual(dev);
    expect(byWorkspace['ws-2']).toBeUndefined();
  });

  it('closing a workspace with nothing open is a no-op', () => {
    const before = useSplitViewStore.getState();
    useSplitViewStore.getState().close('ws-1');
    expect(useSplitViewStore.getState()).toBe(before);
  });
});
