import { act, renderHook, waitFor } from '@testing-library/react';
import { useIconEditor, type IconSource } from './use-icon-editor.js';

/**
 * A source whose stored icon only moves when the "server" says so, so a test
 * can hold a save open and watch what the editor shows in the meantime.
 */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useIconEditor', () => {
  it('shows the stored icon when nothing has been changed', () => {
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: '#4EA7FC', save: vi.fn() }),
    );

    expect(result.current.icon).toBe('Rocket');
    expect(result.current.iconColor).toBe('#4EA7FC');
    expect(result.current.isPending).toBe(false);
    expect(result.current.canEdit).toBe(true);
  });

  it('shows the new icon while the save is still in flight', async () => {
    const gate = deferred();
    const { result } = renderHook(() =>
      useIconEditor({
        icon: 'Rocket',
        iconColor: '#4EA7FC',
        save: () => gate.promise,
      }),
    );

    act(() => result.current.select('Star', '#EB5757'));

    expect(result.current.icon).toBe('Star');
    expect(result.current.iconColor).toBe('#EB5757');
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it('keeps showing the new icon when a stale read lands mid-save', async () => {
    const gate = deferred();
    const source: IconSource = {
      icon: 'Rocket',
      iconColor: '#4EA7FC',
      save: () => gate.promise,
    };

    const { result, rerender } = renderHook(
      (props: IconSource) => useIconEditor(props),
      { initialProps: source },
    );

    act(() => result.current.select('Star'));

    // A refetch resolves with the pre-change row — the case that used to
    // flicker the old icon back into the trigger.
    rerender({ ...source, icon: 'Rocket' });
    expect(result.current.icon).toBe('Star');

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });

    // Once the source catches up, the editor reads straight through again.
    rerender({ ...source, icon: 'Star' });
    await waitFor(() => expect(result.current.icon).toBe('Star'));
  });

  it('restores the previous icon and reports why when the save fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Network unreachable'));
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: '#4EA7FC', save }),
    );

    await act(async () => {
      result.current.select('Star');
    });

    await waitFor(() =>
      expect(result.current.error).toBe('Network unreachable'),
    );
    expect(result.current.icon).toBe('Rocket');
    expect(result.current.isPending).toBe(false);
  });

  it('refuses a second save while one is in flight', async () => {
    const gate = deferred();
    const save = vi.fn().mockReturnValue(gate.promise);
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: null, save }),
    );

    act(() => result.current.select('Star'));
    act(() => result.current.select('Heart'));

    expect(save).toHaveBeenCalledOnce();
    expect(result.current.icon).toBe('Star');

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
  });

  it('clears both fields, so render sites fall back to their own default', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: '#4EA7FC', save }),
    );

    await act(async () => {
      result.current.clear();
    });

    expect(save).toHaveBeenCalledWith({ icon: null, iconColor: null });
  });

  it('carries the current colour forward when only the icon is picked', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: '#EB5757', save }),
    );

    await act(async () => {
      result.current.select('Star');
    });

    expect(save).toHaveBeenCalledWith({ icon: 'Star', iconColor: '#EB5757' });
  });

  it('does not save at all when the viewer cannot edit', () => {
    const save = vi.fn();
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: null, save, canEdit: false }),
    );

    expect(result.current.canEdit).toBe(false);

    act(() => result.current.select('Star'));

    expect(save).not.toHaveBeenCalled();
    expect(result.current.icon).toBe('Rocket');
  });

  it('stores the uploaded URL rather than the file itself', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const upload = vi.fn().mockResolvedValue('/workspaces/w1/logo?v=abc');
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: '#4EA7FC', save, upload }),
    );

    const file = new File(['bytes'], 'logo.png', { type: 'image/png' });
    await act(async () => {
      result.current.uploadFile?.(file);
    });

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        icon: '/workspaces/w1/logo?v=abc',
        iconColor: null,
      }),
    );
    expect(upload).toHaveBeenCalledWith(file);
  });

  it('reports a rejected upload without touching the stored icon', async () => {
    const save = vi.fn();
    const upload = vi
      .fn()
      .mockRejectedValue(new Error('Logos must be 2 MB or smaller.'));
    const { result } = renderHook(() =>
      useIconEditor({ icon: 'Rocket', iconColor: null, save, upload }),
    );

    await act(async () => {
      result.current.uploadFile?.(
        new File(['x'], 'huge.png', { type: 'image/png' }),
      );
    });

    await waitFor(() =>
      expect(result.current.error).toBe('Logos must be 2 MB or smaller.'),
    );
    expect(save).not.toHaveBeenCalled();
    expect(result.current.icon).toBe('Rocket');
  });

  it('offers no upload action when the source cannot take a file', () => {
    const { result } = renderHook(() =>
      useIconEditor({ icon: null, iconColor: null, save: vi.fn() }),
    );

    expect(result.current.uploadFile).toBeUndefined();
  });
});
