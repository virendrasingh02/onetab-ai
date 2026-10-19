import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { MatrixRestClient } from './matrix';
import { RoomTimeline } from './room-timeline';

/**
 * The live timeline for one room, synced by a long-poll `/sync` loop that runs
 * only while this screen is focused and the app is in the foreground. Leaving
 * the screen or backgrounding the app aborts the in-flight request; coming
 * back resumes from the last token.
 */
export function useRoomTimeline(
  client: MatrixRestClient,
  roomId: string,
  options: { timelineLimit?: number; onFatalError?: (error: unknown) => void },
) {
  const { timelineLimit, onFatalError } = options;
  const timeline = useMemo(
    () => new RoomTimeline(client, roomId, { timelineLimit, onFatalError }),
    [client, roomId, timelineLimit, onFatalError],
  );
  const state = useSyncExternalStore(timeline.subscribe, timeline.getState);

  useFocusEffect(
    useCallback(() => {
      if (AppState.currentState === 'active') timeline.start();
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active') timeline.start();
        else timeline.stop();
      });
      return () => {
        subscription.remove();
        timeline.stop();
      };
    }, [timeline]),
  );

  useEffect(() => () => timeline.stop(), [timeline]);

  return { timeline, state };
}
