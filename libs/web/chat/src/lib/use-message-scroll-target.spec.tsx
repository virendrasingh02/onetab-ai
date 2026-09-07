import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import type { MessageListHandle } from '@org/chat-ui';
import type { Message } from '@org/matrix-client';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('@org/ui', () => ({ toast: { error: toastError } }));

import { useMessageScrollTarget } from './use-message-scroll-target.js';

function message(id: string): Message {
  return { id } as Message;
}

function fakeHandle(): MessageListHandle {
  return {
    scrollToMessage: vi.fn().mockReturnValue(true),
    getScrollElement: () => null,
  };
}

beforeEach(() => {
  toastError.mockReset();
});

describe('useMessageScrollTarget', () => {
  it('scrolls straight to a loaded message, highlights it, then clears it', async () => {
    const listRef = createRef<MessageListHandle>();
    (listRef as { current: MessageListHandle }).current = fakeHandle();
    const onHighlight = vi.fn();

    const { result } = renderHook(() =>
      useMessageScrollTarget({
        messagesById: new Map([['m1', message('m1')]]),
        hasMore: true,
        isLoadingOlder: false,
        loadOlder: vi.fn(),
        listRef,
        onHighlight,
      }),
    );

    await expect(result.current('m1', { highlightMs: 40 })).resolves.toBe(true);
    expect(listRef.current?.scrollToMessage).toHaveBeenCalledWith('m1');
    expect(onHighlight).toHaveBeenCalledWith('m1');

    await waitFor(() => expect(onHighlight).toHaveBeenLastCalledWith(null));
  });

  it('pages older history in when the target is not loaded, then scrolls to it', async () => {
    const store = new Map<string, Message>();
    const loadOlder = vi.fn(() => {
      store.set('old', message('old'));
    });
    const listRef = createRef<MessageListHandle>();
    (listRef as { current: MessageListHandle }).current = fakeHandle();

    const { result, rerender } = renderHook(
      ({ map, more }: { map: Map<string, Message>; more: boolean }) =>
        useMessageScrollTarget({
          messagesById: map,
          hasMore: more,
          isLoadingOlder: false,
          loadOlder,
          listRef,
          onHighlight: vi.fn(),
        }),
      { initialProps: { map: store, more: true } },
    );

    let outcome!: Promise<boolean>;
    act(() => {
      outcome = result.current('old', { highlightMs: 0 });
    });
    await waitFor(() => expect(loadOlder).toHaveBeenCalled());
    rerender({ map: new Map(store), more: false });

    await expect(outcome).resolves.toBe(true);
    expect(listRef.current?.scrollToMessage).toHaveBeenCalledWith('old');
  });

  it('gives up gracefully with a toast when the message is unreachable', async () => {
    const listRef = createRef<MessageListHandle>();
    (listRef as { current: MessageListHandle }).current = fakeHandle();

    const { result } = renderHook(() =>
      useMessageScrollTarget({
        messagesById: new Map(),
        hasMore: false,
        isLoadingOlder: false,
        loadOlder: vi.fn(),
        listRef,
        onHighlight: vi.fn(),
      }),
    );

    await expect(result.current('missing', { highlightMs: 0 })).resolves.toBe(
      false,
    );
    expect(toastError).toHaveBeenCalled();
    expect(listRef.current?.scrollToMessage).not.toHaveBeenCalled();
  });
});
