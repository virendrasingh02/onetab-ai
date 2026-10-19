import { describe, expect, it, vi } from 'vitest';
import { runWebAlert, type BrowserDialogs } from './web-alert';

function dialogs(answers: { confirm?: boolean; prompt?: string | null } = {}) {
  return {
    alert: vi.fn(),
    confirm: vi.fn(() => answers.confirm ?? false),
    prompt: vi.fn((_message: string, _defaultValue?: string) =>
      answers.prompt === undefined ? null : answers.prompt,
    ),
  } satisfies BrowserDialogs;
}

describe('runWebAlert', () => {
  it('shows a plain message with alert', () => {
    const d = dialogs();
    runWebAlert(d, 'Upload failed', 'Try again.');
    expect(d.alert).toHaveBeenCalledWith('Upload failed\n\nTry again.');
  });

  it('runs the only button after the alert', () => {
    const d = dialogs();
    const ok = vi.fn();
    runWebAlert(d, 'Saved', undefined, [{ text: 'OK', onPress: ok }]);
    expect(d.alert).toHaveBeenCalledWith('Saved');
    expect(ok).toHaveBeenCalled();
  });

  it('maps action + cancel onto confirm', () => {
    const remove = vi.fn();
    const cancel = vi.fn();
    const buttons = [
      { text: 'Cancel', style: 'cancel' as const, onPress: cancel },
      { text: 'Delete', style: 'destructive' as const, onPress: remove },
    ];

    const yes = dialogs({ confirm: true });
    runWebAlert(yes, 'Delete agent?', 'This cannot be undone.', buttons);
    expect(yes.confirm).toHaveBeenCalledWith(
      'Delete agent?\n\nThis cannot be undone.\n\nPress OK to delete.',
    );
    expect(remove).toHaveBeenCalledTimes(1);

    runWebAlert(dialogs({ confirm: false }), 'Delete agent?', '', buttons);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('offers several actions as a numbered prompt', () => {
    const camera = vi.fn();
    const file = vi.fn();
    const buttons = [
      { text: 'Take photo', onPress: camera },
      { text: 'File', onPress: file },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    const d = dialogs({ prompt: '2' });
    runWebAlert(d, 'Attach', undefined, buttons);
    expect(d.prompt.mock.calls[0]?.[0]).toContain('1. Take photo\n2. File');
    expect(file).toHaveBeenCalled();
    expect(camera).not.toHaveBeenCalled();
  });

  it('treats a dismissed or invalid choice as cancel', () => {
    const cancel = vi.fn();
    const pick = vi.fn();
    const buttons = [
      { text: 'A', onPress: pick },
      { text: 'B', onPress: pick },
      { text: 'Cancel', style: 'cancel' as const, onPress: cancel },
    ];
    runWebAlert(dialogs({ prompt: null }), 'Pick', undefined, buttons);
    runWebAlert(dialogs({ prompt: '9' }), 'Pick', undefined, buttons);
    expect(pick).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
