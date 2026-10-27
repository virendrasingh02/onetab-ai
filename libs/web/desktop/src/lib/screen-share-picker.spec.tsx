import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopDisplayMediaRequest, OneTabDesktopApi } from './desktop-api.js';
import { groupCaptureSources, ScreenSharePicker } from './screen-share-picker.js';

const thumb = 'data:image/jpeg;base64,AA==';
const request: DesktopDisplayMediaRequest = {
  requestId: 'r1',
  sources: [
    { id: 'window:7:0', name: 'Design review', kind: 'window', thumbnail: thumb },
    { id: 'screen:0:0', name: 'Screen 1', kind: 'screen', thumbnail: thumb },
  ],
};

describe('groupCaptureSources', () => {
  it('separates screens from windows and keeps each group in order', () => {
    const { screens, windows } = groupCaptureSources(request.sources);
    expect(screens.map((s) => s.id)).toEqual(['screen:0:0']);
    expect(windows.map((s) => s.id)).toEqual(['window:7:0']);
  });
});

describe('ScreenSharePicker', () => {
  let emit: (request: DesktopDisplayMediaRequest) => void;
  const respond = vi.fn(async () => true);
  const openSystemSettings = vi.fn(async () => true);

  beforeEach(() => {
    respond.mockClear();
    openSystemSettings.mockClear();
    window.onetabDesktop = {
      displayMedia: {
        onRequest: (handler: (r: DesktopDisplayMediaRequest) => void) => {
          emit = handler;
          return () => undefined;
        },
        respond,
      },
      shell: { openSystemSettings },
    } as unknown as OneTabDesktopApi;
  });

  afterEach(() => {
    cleanup();
    delete window.onetabDesktop;
  });

  const open = (r: DesktopDisplayMediaRequest = request) => {
    render(<ScreenSharePicker />);
    act(() => emit(r));
  };

  it('renders nothing until a page asks to share', () => {
    const { container } = render(<ScreenSharePicker />);
    expect(container.innerHTML).toBe('');
  });

  it('shares the source that was picked', () => {
    open();
    const share = screen.getByRole('button', { name: 'Share' }) as HTMLButtonElement;
    expect(share.disabled).toBe(true); // nothing chosen yet

    fireEvent.click(screen.getByRole('button', { name: /Design review/ }));
    expect(share.disabled).toBe(false);
    fireEvent.click(share);

    expect(respond).toHaveBeenCalledWith('r1', 'window:7:0');
    expect(screen.queryByText('Share your screen')).toBeNull();
  });

  it('shares straight away on a double-click', () => {
    open();
    fireEvent.doubleClick(screen.getByRole('button', { name: /Screen 1/ }));
    expect(respond).toHaveBeenCalledWith('r1', 'screen:0:0');
  });

  it('cancels, so the page sees the share declined', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(respond).toHaveBeenCalledWith('r1', null);
  });

  it('explains a macOS permission block instead of showing an empty list', () => {
    open({ requestId: 'r2', sources: [], blocked: 'os-permission' });
    fireEvent.click(screen.getByRole('button', { name: 'Open System Settings' }));
    expect(openSystemSettings).toHaveBeenCalledWith('screen-recording');
    expect(respond).toHaveBeenCalledWith('r2', null);
  });

  it('says so when there is nothing to share', () => {
    open({ requestId: 'r3', sources: [] });
    expect(screen.getByText('There is nothing to share right now.')).toBeDefined();
  });
});
