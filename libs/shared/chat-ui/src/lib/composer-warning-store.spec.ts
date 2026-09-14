import { describe, it, expect, beforeEach } from 'vitest';
import { useComposerWarningStore } from './composer-warning-store.js';

describe('useComposerWarningStore', () => {
  beforeEach(() => {
    useComposerWarningStore.setState({ dismissed: {} });
  });

  it('initially reports not dismissed', () => {
    const { isDismissed } = useComposerWarningStore.getState();
    expect(isDismissed('conv-1', 'user-a,user-b')).toBe(false);
  });

  it('dismiss marks signature as dismissed for conversationId', () => {
    const store = useComposerWarningStore.getState();
    store.dismiss('conv-1', 'user-a,user-b');
    expect(store.isDismissed('conv-1', 'user-a,user-b')).toBe(true);
    // Different signature is not dismissed
    expect(store.isDismissed('conv-1', 'user-a')).toBe(false);
    // Different conversationId is not dismissed
    expect(store.isDismissed('conv-2', 'user-a,user-b')).toBe(false);
  });

  it('clearDismissal resets the conversation dismissal', () => {
    const store = useComposerWarningStore.getState();
    store.dismiss('conv-1', 'user-a');
    expect(store.isDismissed('conv-1', 'user-a')).toBe(true);
    store.clearDismissal('conv-1');
    expect(store.isDismissed('conv-1', 'user-a')).toBe(false);
  });
});
