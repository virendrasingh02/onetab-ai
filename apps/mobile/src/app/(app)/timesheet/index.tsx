import Ionicons from '@expo/vector-icons/Ionicons';
import { peopleApi } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
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
  ListRow,
  rowDividerInset,
  Screen,
  SectionHeader,
} from '../../../components/ui';
import { haptics } from '../../../lib/haptics';
import { secureStore } from '../../../lib/secure-store';
import { useSession } from '../../../lib/session';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { spacing } from '../../../theme/tokens';

interface PunchRecord {
  type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
}

export default function TimesheetScreen() {
  const { user } = useSession();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const storageKey = `punches:${workspaceId}:${user?.id ?? 'me'}:${todayKey}`;

  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Load saved punch history for today from secureStore
  useEffect(() => {
    void secureStore.get(storageKey).then((saved) => {
      if (saved) {
        try {
          const list: PunchRecord[] = JSON.parse(saved);
          setPunches(list);
          const last = list[list.length - 1];
          setIsCheckedIn(last?.type === 'CHECK_IN');
        } catch {
          // ignore parsing error
        }
      }
    });
  }, [storageKey]);

  const profileQuery = useQuery({
    queryKey: ['mobile', 'employee-profile', workspaceId, user?.id],
    queryFn: () =>
      user?.id
        ? peopleApi.profile(workspaceId, user.id).catch(() => null)
        : Promise.resolve(null),
    enabled: Boolean(workspaceId && user?.id),
  });

  const handlePunch = async () => {
    haptics.medium();
    const nextType: 'CHECK_IN' | 'CHECK_OUT' = isCheckedIn ? 'CHECK_OUT' : 'CHECK_IN';
    const newRecord: PunchRecord = {
      type: nextType,
      timestamp: new Date().toISOString(),
    };
    const updated = [...punches, newRecord];
    setPunches(updated);
    setIsCheckedIn(nextType === 'CHECK_IN');
    await secureStore.set(storageKey, JSON.stringify(updated));

    Alert.alert(
      nextType === 'CHECK_IN' ? 'Checked In' : 'Checked Out',
      `Recorded at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
    );
  };

  // Calculate total duration worked today in ms
  const totalWorkedMs = useMemo(() => {
    let total = 0;
    let lastIn: number | null = null;
    for (const p of punches) {
      const ts = new Date(p.timestamp).getTime();
      if (p.type === 'CHECK_IN') {
        lastIn = ts;
      } else if (p.type === 'CHECK_OUT' && lastIn !== null) {
        total += ts - lastIn;
        lastIn = null;
      }
    }
    if (lastIn !== null) {
      total += Date.now() - lastIn;
    }
    return total;
  }, [punches]);

  const hoursWorked = (totalWorkedMs / (1000 * 60 * 60)).toFixed(1);
  const employee = profileQuery.data;

  return (
    <Screen scroll refreshing={profileQuery.isRefetching} onRefresh={() => void profileQuery.refetch()}>
      <Stack.Screen options={{ title: 'Timesheet & Attendance' }} />

      {/* Main Punch Clock Card */}
      <Card style={styles.clockCard}>
        <View style={styles.clockHeader}>
          <AppText style={[styles.dateHeading, { color: colors.subtle }]}>
            Today · {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </AppText>
          <Badge
            label={isCheckedIn ? 'Checked In' : 'Checked Out'}
            tone={isCheckedIn ? 'success' : 'neutral'}
          />
        </View>

        <View style={styles.hoursDisplay}>
          <AppText style={[styles.hoursValue, { color: colors.foreground }]}>
            {hoursWorked}
          </AppText>
          <AppText style={[styles.hoursLabel, { color: colors.subtle }]}>
            Hours worked today
          </AppText>
        </View>

        <Button
          label={isCheckedIn ? 'Check Out' : 'Check In'}
          icon={isCheckedIn ? 'log-out-outline' : 'log-in-outline'}
          variant={isCheckedIn ? 'destructive' : 'primary'}
          onPress={handlePunch}
          style={styles.punchBtn}
        />
      </Card>

      {/* Daily Punch Timeline */}
      <SectionHeader title="Today's Activity" />
      {punches.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="time-outline" size={28} color={colors.subtle} />
          <AppText style={[styles.emptyText, { color: colors.subtle }]}>
            No punches recorded today. Tap Check In above to start your day.
          </AppText>
        </Card>
      ) : (
        <Card>
          {punches.map((p, idx) => {
            const time = new Date(p.timestamp).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
            });
            return (
              <View key={idx}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  icon={p.type === 'CHECK_IN' ? 'enter-outline' : 'exit-outline'}
                  title={p.type === 'CHECK_IN' ? 'Check In' : 'Check Out'}
                  subtitle={time}
                  right={
                    <Badge
                      label={p.type === 'CHECK_IN' ? 'Started' : 'Ended'}
                      tone={p.type === 'CHECK_IN' ? 'success' : 'neutral'}
                    />
                  }
                />
              </View>
            );
          })}
        </Card>
      )}

      {/* Employee Profile Information */}
      <SectionHeader title="Employee Information" />
      <Card>
        <ListRow
          avatar={{ name: user?.displayName ?? 'You', uri: user?.avatarUrl }}
          title={user?.displayName ?? 'Team Member'}
          subtitle={user?.email ?? undefined}
        />
        {employee?.jobTitle ? (
          <>
            <Divider inset={rowDividerInset} />
            <ListRow
              icon="briefcase-outline"
              title="Job Title"
              subtitle={employee.jobTitle}
            />
          </>
        ) : null}
        {employee?.department ? (
          <>
            <Divider inset={rowDividerInset} />
            <ListRow
              icon="business-outline"
              title="Department"
              subtitle={employee.department}
            />
          </>
        ) : null}
        {employee?.location ? (
          <>
            <Divider inset={rowDividerInset} />
            <ListRow
              icon="location-outline"
              title="Location"
              subtitle={employee.location}
            />
          </>
        ) : null}
      </Card>

      {/* Workspace Timesheet Policy Note */}
      <View style={styles.policyCard}>
        <Ionicons name="information-circle-outline" size={16} color={colors.subtle} />
        <AppText style={[styles.policyText, { color: colors.subtle }]}>
          Punches are recorded locally and synchronized with the workspace ledger. For time corrections, contact your workspace administrator.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  clockCard: {
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  clockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.md,
  },
  dateHeading: {
    fontSize: 13,
    fontWeight: '600',
  },
  hoursDisplay: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  hoursValue: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 56,
  },
  hoursLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  punchBtn: {
    width: '100%',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyCard: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
  },
  policyText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
});
