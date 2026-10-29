import Ionicons from '@expo/vector-icons/Ionicons';
import { queryKeys, workToolsApi } from '@org/api-client';
import type { MeetingRsvp } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import { useKeyboardAvoidingProps } from '../../../components/navigation';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  IconButton,
  keyboardDismissMode,
  ListRow,
  LoadingState,
  rowDividerInset,
  SectionHeader,
} from '../../../components/ui';
import { statusTone } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { spacing } from '../../../theme/tokens';

export default function MeetingDetailScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();
  const keyboardAvoiding = useKeyboardAvoidingProps();

  const meetingQuery = useQuery({
    queryKey: queryKeys.workTools.meeting(workspaceId, meetingId),
    queryFn: () => workToolsApi.meeting(workspaceId, meetingId),
    enabled: Boolean(workspaceId && meetingId),
  });
  // Prefix of every meeting key (list scopes and this detail).
  const invalidateMeetings = () =>
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.workTools.all(workspaceId), 'meetings'],
    });

  const rsvpMutation = useMutation({
    mutationFn: (rsvp: MeetingRsvp) =>
      workToolsApi.respondToMeeting(workspaceId, meetingId, { rsvp }),
    onSuccess: () => {
      haptics.success();
      void invalidateMeetings();
    },
    onError: (err) => Alert.alert('Could not update RSVP', err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => workToolsApi.cancelMeeting(workspaceId, meetingId),
    onSuccess: () => {
      haptics.warning();
      void invalidateMeetings();
      router.back();
    },
    onError: (err) => Alert.alert('Could not cancel meeting', err.message),
  });

  if (meetingQuery.isPending) {
    return <LoadingState label="Loading meeting details…" />;
  }

  if (meetingQuery.error || !meetingQuery.data) {
    return (
      <ErrorState
        error={meetingQuery.error ?? new Error('Meeting not found')}
        onRetry={() => void meetingQuery.refetch()}
      />
    );
  }

  const meeting = meetingQuery.data;
  const start = new Date(meeting.startAt);
  const end = new Date(meeting.endAt);
  const timeString = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const dateString = start.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleOpenLocation = () => {
    if (meeting.location) {
      if (meeting.location.startsWith('http://') || meeting.location.startsWith('https://')) {
        void WebBrowser.openBrowserAsync(meeting.location);
      } else {
        Alert.alert('Meeting Location', meeting.location);
      }
    }
  };

  const confirmCancel = () => {
    haptics.warning();
    Alert.alert(
      'Cancel Meeting',
      'Are you sure you want to cancel this meeting for all participants?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Meeting',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView {...keyboardAvoiding} style={styles.container}>
      <Stack.Screen
        options={{
          title: meeting.title || 'Meeting Detail',
          headerRight: () =>
            meeting.status === 'SCHEDULED' ? (
              <IconButton
                icon="close-circle-outline"
                label="Cancel meeting"
                onPress={confirmCancel}
              />
            ) : null,
        }}
      />

      <ScrollView
        keyboardDismissMode={keyboardDismissMode}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <Badge
              label={meeting.status}
              tone={statusTone(meeting.status)}
            />
          </View>

          <AppText style={[styles.title, { color: colors.foreground }]}>
            {meeting.title}
          </AppText>

          <View style={styles.timeInfoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <View>
              <AppText style={[styles.dateText, { color: colors.foreground }]}>
                {dateString}
              </AppText>
              <AppText style={[styles.timeText, { color: colors.subtle }]}>
                {timeString}
              </AppText>
            </View>
          </View>

          {meeting.location ? (
            <Pressable style={styles.locationBlock} onPress={handleOpenLocation}>
              <Ionicons name="videocam-outline" size={18} color={colors.primary} />
              <AppText style={[styles.locationLink, { color: colors.primaryText }]}>
                {meeting.location}
              </AppText>
            </Pressable>
          ) : null}

          {/* RSVP Actions Bar */}
          {meeting.status === 'SCHEDULED' ? (
            <View style={styles.rsvpContainer}>
              <AppText style={[styles.rsvpHeading, { color: colors.subtle }]}>
                Your Response:
              </AppText>
              <View style={styles.rsvpButtons}>
                <Button
                  label="Accept"
                  icon="checkmark"
                  variant="primary"
                  onPress={() => rsvpMutation.mutate('ACCEPTED')}
                  disabled={rsvpMutation.isPending}
                  style={styles.rsvpBtn}
                />
                <Button
                  label="Tentative"
                  variant="secondary"
                  onPress={() => rsvpMutation.mutate('TENTATIVE')}
                  disabled={rsvpMutation.isPending}
                  style={styles.rsvpBtn}
                />
                <Button
                  label="Decline"
                  icon="close"
                  variant="ghost"
                  onPress={() => rsvpMutation.mutate('DECLINED')}
                  disabled={rsvpMutation.isPending}
                  style={styles.rsvpBtn}
                />
              </View>
            </View>
          ) : null}
        </Card>

        {/* Agenda & Description */}
        {meeting.agenda || meeting.description ? (
          <>
            <SectionHeader title="Agenda & Description" />
            <Card style={styles.agendaCard}>
              {meeting.agenda ? (
                <AppText style={[styles.agendaBody, { color: colors.foreground }]}>
                  {meeting.agenda}
                </AppText>
              ) : null}
              {meeting.description ? (
                <AppText style={[styles.descBody, { color: colors.subtle }]}>
                  {meeting.description}
                </AppText>
              ) : null}
            </Card>
          </>
        ) : null}

        {/* Participants List */}
        <SectionHeader
          title={`Participants (${meeting.participants?.length ?? 0})`}
        />
        {(meeting.participants ?? []).length === 0 ? (
          <Card style={styles.emptyCard}>
            <AppText style={[styles.emptyText, { color: colors.subtle }]}>
              No participants added.
            </AppText>
          </Card>
        ) : (
          <Card>
            {(meeting.participants ?? []).map((p, idx) => (
              <View key={p.userId}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  avatar={{ name: p.user?.displayName ?? 'User', uri: p.user?.avatarUrl }}
                  title={p.user?.displayName ?? 'Participant'}
                  subtitle={p.role ? `Role: ${p.role}` : undefined}
                  right={
                    <Badge
                      label={p.rsvp}
                      tone={
                        p.rsvp === 'ACCEPTED'
                          ? 'success'
                          : p.rsvp === 'DECLINED'
                            ? 'danger'
                            : 'neutral'
                      }
                    />
                  }
                />
              </View>
            ))}
          </Card>
        )}

        {/* Action Items if present */}
        {meeting.actionItems && meeting.actionItems.length > 0 ? (
          <>
            <SectionHeader title={`Action Items (${meeting.actionItems.length})`} />
            <Card>
              {meeting.actionItems.map((item, idx) => (
                <View key={item.id}>
                  {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                  <ListRow
                    icon="checkbox-outline"
                    title={item.title}
                    subtitle={item.status}
                    right={<Badge label={item.status} tone="neutral" />}
                    onPress={() =>
                      router.push({
                        pathname: '/tasks/[taskId]',
                        params: { taskId: item.id },
                      })
                    }
                  />
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl * 2,
  },
  headerCard: {
    padding: spacing.md,
  },
  badgeRow: {
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  timeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
  },
  locationBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  locationLink: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  rsvpContainer: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000015',
  },
  rsvpHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rsvpBtn: {
    flex: 1,
  },
  agendaCard: {
    padding: spacing.md,
  },
  agendaBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  descBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
