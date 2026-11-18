import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {}, Notification: {}, shell: {} }));
vi.mock('./window.js', () => ({ getMainWindow: () => null, showMainWindow: () => undefined }));

const { aggregateProgress, downloadNotice } = await import('./downloads.js');

describe('aggregateProgress', () => {
  it('clears the bar when nothing is downloading', () => {
    expect(aggregateProgress([])).toBe(-1);
  });

  it('combines several downloads by bytes', () => {
    expect(
      aggregateProgress([
        { received: 50, total: 100 },
        { received: 0, total: 100 },
      ]),
    ).toBe(0.25);
  });

  it('goes indeterminate when a size is unknown', () => {
    expect(aggregateProgress([{ received: 10, total: 0 }])).toBe(2);
  });
});

describe('downloadNotice', () => {
  it('announces completed and failed downloads, not cancelled ones', () => {
    expect(downloadNotice('completed', 'a.pdf')?.title).toBe('Download complete');
    expect(downloadNotice('interrupted', 'a.pdf')?.title).toBe('Download failed');
    expect(downloadNotice('cancelled', 'a.pdf')).toBeNull();
  });
});
