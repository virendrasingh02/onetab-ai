import Ionicons from '@expo/vector-icons/Ionicons';
import { queryKeys, remindersApi, workToolsApi } from '@org/api-client';
import type { MeetingRsvp } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  rowDividerInset,
  Screen,
  TextField,
} from '../../../components/ui';
import { relativeTime, statusTone } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

export default function MeetingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'reminders'>('upcoming');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New meeting form
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAgenda, setNewAgenda] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');

  const meetingScope = activeTab === 'past' ? 'past' : 'upcoming';
  const meetingsQuery = useQuery({
    queryKey: queryKeys.workTools.meetings(workspaceId, { scope: meetingScope }),
    queryFn: () => workToolsApi.meetings(workspaceId, { scope: meetingScope }),
    enabled: Boolean(workspaceId && activeTab !== 'reminders'),
  });
  // Prefix of every meeting key (both scopes and the detail screen).
  const invalidateMeetings = () =>
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.workTools.all(workspaceId), 'meetings'],
    });

  const remindersQuery = useQuery({
    queryKey: ['mobile', 'reminders-list', workspaceId],
    queryFn: () => remindersApi.list(workspaceId),
    enabled: Boolean(workspaceId && activeTab === 'reminders'),
  });
  const activeQuery = activeTab === 'reminders' ? remindersQuery : meetingsQuery;

  const createMeetingMutation = useMutation({
    mutationFn: () => {
      const start = new Date();
      start.setMinutes(start.getMinutes() + 15);
      const end = new Date(start.getTime() + (parseInt(durationMinutes, 10) || 30) * 60_000);
      return workToolsApi.createMeeting(workspaceId, {
        title: newTitle.trim(),
        location: newLocation.trim() || undefined,
        agenda: newAgenda.trim() || undefined,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
    },
    onSuccess: (newM) => {
      haptics.success();
      setCreateModalOpen(false);
      setNewTitle('');
      setNewLocation('');
      setNewAgenda('');
      void invalidateMeetings();
      router.push({
        pathname: '/meetings/[meetingId]',
        params: { meetingId: newM.id },
      });
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Could not schedule meeting', err.message);
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: ({ meetingId, rsvp }: { meetingId: string; rsvp: MeetingRsvp }) =>
      workToolsApi.respondToMeeting(workspaceId, meetingId, { rsvp }),
    onSuccess: () => {
      haptics.light();
      void invalidateMeetings();
    },
    onError: (err) => Alert.alert('Could not record RSVP', err.message),
  });

  const isRefreshing =
    activeTab === 'reminders'
      ? remindersQuery.isRefetching
      : meetingsQuery.isRefetching;

  const onRefresh = () => {
    if (activeTab === 'reminders') void remindersQuery.refetch();
    else void meetingsQuery.refetch();
  };

  const meetings = meetingsQuery.data ?? [];
  const reminders = remindersQuery.data ?? [];

  return (
    <Screen scroll refreshing={isRefreshing} onRefresh={onRefresh}>
      {/* Top Segmented Tabs & Create Action */}
      <View style={styles.topBar}>
        <View style={styles.segmentedControl}>
          <Pressable
            style={[
              styles.segment,
              activeTab === 'upcoming' && { backgroundColor: colors.selected },
            ]}
            onPress={() => {
              haptics.selection();
              setActiveTab('upcoming');
            }}
          >
            <AppText
              style={[
                styles.segmentText,
                { color: activeTab === 'upcoming' ? colors.primaryText : colors.subtle },
              ]}
            >
              Upcoming
            </AppText>
          </Pressable>

          <Pressable
            style={[
              styles.segment,
              activeTab === 'past' && { backgroundColor: colors.selected },
            ]}
            onPress={() => {
              haptics.selection();
              setActiveTab('past');
            }}
          >
            <AppText
              style={[
                styles.segmentText,
                { color: activeTab === 'past' ? colors.primaryText : colors.subtle },
              ]}
            >
              Past
            </AppText>
          </Pressable>

          <Pressable
            style={[
              styles.segment,
              activeTab === 'reminders' && { backgroundColor: colors.selected },
            ]}
            onPress={() => {
              haptics.selection();
              setActiveTab('reminders');
            }}
          >
            <AppText
              style={[
                styles.segmentText,
                { color: activeTab === 'reminders' ? colors.primaryText : colors.subtle },
              ]}
            >
              Reminders
            </AppText>
          </Pressable>
        </View>

        <Button
          label="Schedule"
          icon="add"
          onPress={() => {
            haptics.selection();
            setCreateModalOpen(true);
          }}
        />
      </View>

      {/* Main Content Area */}
      {activeQuery.error ? (
        <ErrorState
          error={activeQuery.error}
          onRetry={() => void activeQuery.refetch()}
        />
      ) : activeTab === 'reminders' ? (
        reminders.length === 0 ? (
          <EmptyState
            icon="alarm-outline"
            title="No reminders scheduled"
            description="You don't have any pending reminders."
          />
        ) : (
          <Card>
            {reminders.map((r, idx) => (
              <View key={r.id}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  icon="alarm-outline"
                  title={r.snippet || 'Message Reminder'}
                  subtitle={`Remind at ${new Date(r.remindAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${relativeTime(r.remindAt)}`}
                  right={<Badge label="Scheduled" tone="info" />}
                />
              </View>
            ))}
          </Card>
        )
      ) : meetings.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={activeTab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
          description="Schedule a meeting with your team or coworkers."
        />
      ) : (
        <View style={styles.meetingsContainer}>
          {meetings.map((m) => {
            const start = new Date(m.startAt);
            const end = new Date(m.endAt);
            const timeString = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
            const dateString = start.toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            return (
              <Card key={m.id} style={styles.meetingCard}>
                <View style={styles.meetingHeader}>
                  <View style={styles.dateBlock}>
                    <AppText style={[styles.dateText, { color: colors.primary }]}>
                      {dateString}
                    </AppText>
                    <AppText style={[styles.timeText, { color: colors.subtle }]}>
                      {timeString}
                    </AppText>
                  </View>
                  <Badge
                    label={m.status}
                    tone={statusTone(m.status)}
                  />
                </View>

                <Pressable
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/meetings/[meetingId]',
                      params: { meetingId: m.id },
                    });
                  }}
                >
                  <AppText style={[styles.meetingTitle, { color: colors.foreground }]}>
                    {m.title}
                  </AppText>

                  {m.location ? (
                    <View style={styles.locationRow}>
                      <Ionicons name="videocam-outline" size={15} color={colors.subtle} />
                      <AppText style={[styles.locationText, { color: colors.subtle }]}>
                        {m.location}
                      </AppText>
                    </View>
                  ) : null}

                  {m.agenda ? (
                    <AppText
                      numberOfLines={2}
                      style={[styles.agendaSnippet, { color: colors.subtle }]}
                    >
                      {m.agenda}
                    </AppText>
                  ) : null}
                </Pressable>

                {activeTab === 'upcoming' ? (
                  <View style={styles.rsvpBar}>
                    <AppText style={[styles.rsvpLabel, { color: colors.subtle }]}>
                      RSVP:
                    </AppText>
                    <Pressable
                      style={[styles.rsvpBtn, { backgroundColor: colors.selected }]}
                      onPress={() =>
                        rsvpMutation.mutate({ meetingId: m.id, rsvp: 'ACCEPTED' })
                      }
                    >
                      <Ionicons name="checkmark" size={14} color={colors.primary} />
                      <AppText style={[styles.rsvpBtnText, { color: colors.primaryText }]}>
                        Accept
                      </AppText>
                    </Pressable>

                    <Pressable
                      style={[styles.rsvpBtn, { backgroundColor: colors.selected }]}
                      onPress={() =>
                        rsvpMutation.mutate({ meetingId: m.id, rsvp: 'DECLINED' })
                      }
                    >
                      <Ionicons name="close" size={14} color={colors.subtle} />
                      <AppText style={[styles.rsvpBtnText, { color: colors.primaryText }]}>
                        Decline
                      </AppText>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {/* Schedule Meeting Modal */}
      <Modal
        visible={createModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <Screen edges={['top', 'bottom']} scroll>
          <View style={styles.modalHeader}>
            <AppText style={[styles.modalTitle, { color: colors.foreground }]}>
              Schedule Meeting
            </AppText>
            <IconButton
              icon="close"
              label="Close"
              onPress={() => setCreateModalOpen(false)}
            />
          </View>

          <View style={styles.formContainer}>
            <TextField
              label="Meeting Title"
              placeholder="e.g. Sprint Sync & Architecture Review"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <TextField
              label="Location or Video Link"
              placeholder="e.g. https://meet.google.com/xyz or Room 402"
              value={newLocation}
              onChangeText={setNewLocation}
            />

            <TextField
              label="Duration (minutes)"
              placeholder="30"
              keyboardType="number-pad"
              value={durationMinutes}
              onChangeText={setDurationMinutes}
            />

            <TextField
              label="Agenda & Notes"
              placeholder="Outline discussion topics and objectives…"
              value={newAgenda}
              onChangeText={setNewAgenda}
              multiline
              numberOfLines={4}
            />

            <Button
              label={createMeetingMutation.isPending ? 'Scheduling…' : 'Schedule Meeting'}
              disabled={!newTitle.trim() || createMeetingMutation.isPending}
              onPress={() => createMeetingMutation.mutate()}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: '#00000010',
    padding: 2,
  },
  segment: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meetingsContainer: {
    gap: spacing.md,
  },
  meetingCard: {
    padding: spacing.md,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dateBlock: {
    gap: 2,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
  },
  agendaSnippet: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  rsvpBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000015',
  },
  rsvpLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  formContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
});
