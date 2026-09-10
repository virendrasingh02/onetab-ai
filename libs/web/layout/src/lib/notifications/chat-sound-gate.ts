import {
  useNotificationPreferences,
  useWorkspaceSoundMuted,
} from '@org/notifications';
import type { ChannelSummary, WorkspaceMember } from '@org/types';
import { useFocusStore } from '@org/ui';
import { useDirectMessagePreferences } from '@org/web-chat';
import { useMemo } from 'react';

/**
 * Resolves the per-workspace gate values the {@link NotificationSoundBridge}
 * needs, from data the app shell already has loaded. Kept out of `app-shell.tsx`
 * only to stop that file growing further.
 *
 * Behavioural per-workspace isolation of notification sound lives here: the
 * global on/off / volume / timbre are shared across workspaces (a user
 * preference), but *whether a given message chimes* depends on this workspace's
 * muted channels, "mentions only" delivery, quiet hours, the per-workspace sound
 * mute, and Focus Mode — all read for the active workspace, so switching
 * workspace switches the behaviour without touching another workspace's state.
 */
export interface ChatSoundGate {
  suppressed: boolean;
  mentionsOnly: boolean;
  mutedChannelNames: ReadonlySet<string>;
  mutedPeerNames: ReadonlySet<string>;
}

/** `"HH:MM"` (local) → minutes since midnight, or null if unparseable. */
function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function withinQuietHours(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): boolean {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null || startMin === endMin) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return startMin < endMin
    ? nowMin >= startMin && nowMin < endMin
    : // window wraps past midnight (e.g. 22:00 → 07:00)
      nowMin >= startMin || nowMin < endMin;
}

export function useChatNotificationSoundGate(params: {
  workspaceId: string | undefined;
  channels: ChannelSummary[] | undefined;
  members: WorkspaceMember[] | undefined;
}): ChatSoundGate {
  const { workspaceId, channels, members } = params;
  const { data: prefs } = useNotificationPreferences(workspaceId);
  const workspaceSoundMuted = useWorkspaceSoundMuted(workspaceId);
  const dmPrefs = useDirectMessagePreferences(workspaceId);
  const focusActive = useFocusStore((s) => s.isActive && !s.isPaused);

  const mutedChannelIds = prefs?.mutedChannelIds;
  const mutedPeerIds = dmPrefs.mutedIds;
  const quietStart = prefs?.quietHoursStart ?? null;
  const quietEnd = prefs?.quietHoursEnd ?? null;

  const mutedChannelNames = useMemo(() => {
    const ids = new Set(mutedChannelIds ?? []);
    const names = new Set<string>();
    if (ids.size === 0) return names;
    for (const channel of channels ?? []) {
      if (ids.has(channel.id) && channel.name) {
        names.add(channel.name.toLowerCase().trim());
      }
    }
    return names;
  }, [mutedChannelIds, channels]);

  const mutedPeerNames = useMemo(() => {
    const ids = new Set(mutedPeerIds);
    const names = new Set<string>();
    if (ids.size === 0) return names;
    for (const member of members ?? []) {
      const peerId = member.user?.id ?? member.id;
      if (!peerId || !ids.has(peerId)) continue;
      const label = member.user?.displayName || member.user?.name;
      if (label) names.add(label.toLowerCase().trim());
    }
    return names;
  }, [mutedPeerIds, members]);

  const suppressed =
    workspaceSoundMuted ||
    focusActive ||
    withinQuietHours(quietStart, quietEnd);

  return {
    suppressed,
    mentionsOnly: prefs?.mentionsOnly ?? false,
    mutedChannelNames,
    mutedPeerNames,
  };
}
