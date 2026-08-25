import { renderHook } from '@testing-library/react';
import { useMediaPreviewKeys } from './use-media-preview-keys.js';

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

describe('useMediaPreviewKeys', () => {
  it('does nothing while closed', () => {
    const onNext = vi.fn();
    renderHook(() => useMediaPreviewKeys(false, { onNext }));
    press('ArrowRight');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('fires the matching handler for each shortcut while open', () => {
    const handlers = {
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomReset: vi.fn(),
      onRotate: vi.fn(),
      onFullscreen: vi.fn(),
      onDownload: vi.fn(),
      onPlayPause: vi.fn(),
    };
    renderHook(() => useMediaPreviewKeys(true, handlers));

    press('ArrowLeft');
    press('ArrowRight');
    press('+');
    press('-');
    press('0');
    press('r');
    press('f');
    press('d');
    press(' ');

    expect(handlers.onPrevious).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomIn).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomOut).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomReset).toHaveBeenCalledTimes(1);
    expect(handlers.onRotate).toHaveBeenCalledTimes(1);
    expect(handlers.onFullscreen).toHaveBeenCalledTimes(1);
    expect(handlers.onDownload).toHaveBeenCalledTimes(1);
    expect(handlers.onPlayPause).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts typed into a text field', () => {
    const onDownload = vi.fn();
    renderHook(() => useMediaPreviewKeys(true, { onDownload }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

    expect(onDownload).not.toHaveBeenCalled();
    input.remove();
  });

  it('ignores the shortcut when a modifier key is held, so browser shortcuts are not shadowed', () => {
    const onDownload = vi.fn();
    const onFullscreen = vi.fn();
    renderHook(() => useMediaPreviewKeys(true, { onDownload, onFullscreen }));

    press('d', { ctrlKey: true });
    press('f', { metaKey: true });

    expect(onDownload).not.toHaveBeenCalled();
    expect(onFullscreen).not.toHaveBeenCalled();
  });

  it('does not handle Escape itself (left to Radix)', () => {
    const onNext = vi.fn();
    renderHook(() => useMediaPreviewKeys(true, { onNext }));
    press('Escape');
    expect(onNext).not.toHaveBeenCalled();
  });
});
