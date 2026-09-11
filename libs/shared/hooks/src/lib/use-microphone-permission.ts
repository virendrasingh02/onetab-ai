import { useEffect, useState } from 'react';

/**
 * Passive read of the browser's current microphone permission — never itself
 * prompts. `'unsupported'` means this browser/device has no `getUserMedia` at
 * all (nothing to ask for); `'prompt'` covers both "never asked" and every
 * browser without the Permissions API for `microphone` (Safari, Firefox),
 * where the only way to actually learn granted/denied is to try recording —
 * see {@link import('./use-voice-recorder.js').useVoiceRecorder}.
 */
export type MicrophonePermissionState =
  | 'unsupported'
  | 'prompt'
  | 'granted'
  | 'denied';

function hasGetUserMedia(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Tracks microphone permission for UI that wants to react *before* the user
 * clicks record — e.g. disabling the mic button with an explanatory tooltip
 * when it's already blocked, instead of only finding out after a doomed
 * `getUserMedia` call.
 *
 * Chrome/Edge expose `navigator.permissions.query({ name: 'microphone' })`
 * with live `onchange` updates (e.g. the user flips the site's mic toggle in
 * another tab); this hook uses it where available. Safari and Firefox
 * implement no such query for `microphone`, so there this stays `'prompt'`
 * forever — the recording hook itself is the source of truth for
 * granted/denied there, discovered the only way those browsers allow: by
 * actually calling `getUserMedia`.
 */
export function useMicrophonePermission(): MicrophonePermissionState {
  const [state, setState] = useState<MicrophonePermissionState>(() =>
    hasGetUserMedia() ? 'prompt' : 'unsupported',
  );

  useEffect(() => {
    if (!hasGetUserMedia()) {
      setState('unsupported');
      return;
    }
    if (typeof navigator.permissions?.query !== 'function') return;

    let cancelled = false;
    const onChange = (result: PermissionStatus) => () => {
      setState(result.state as MicrophonePermissionState);
    };
    let detach: (() => void) | undefined;

    void navigator.permissions
      // Not every engine recognises 'microphone' as a PermissionName even
      // when `permissions.query` exists — caught below rather than typed
      // away, since TS's own `PermissionName` union is broader than reality.
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        setState(result.state as MicrophonePermissionState);
        const handler = onChange(result);
        result.addEventListener('change', handler);
        detach = () => result.removeEventListener('change', handler);
      })
      .catch(() => {
        /* Unsupported PermissionName — stay in the 'prompt' default. */
      });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, []);

  return state;
}
