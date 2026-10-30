import { automationsApi, queryKeys } from '@org/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Button,
  Card,
  Screen,
  TextField,
} from '../../../components/ui';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

const TRIGGERS = [
  { value: 'MANUAL', label: 'Manual', hint: 'Run on demand' },
  {
    value: 'CRON',
    label: 'Schedule',
    hint: 'Runs on the server on a schedule',
  },
  {
    value: 'WEBHOOK',
    label: 'Webhook',
    hint: 'Started by an incoming request',
  },
] as const;

export default function NewAutomationScreen() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] =
    useState<(typeof TRIGGERS)[number]['value']>('MANUAL');

  const create = useMutation({
    mutationFn: () =>
      automationsApi.create(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
      }),
    onSuccess: (wf) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(workspaceId),
      });
      router.replace({
        pathname: '/automation/studio',
        params: { workflowId: wf.id },
      });
    },
    onError: (error) =>
      Alert.alert('Could not create the automation', error.message),
  });

  return (
    <Screen>
      <AppText variant="muted">
        Scheduled and webhook automations run on the server, so they keep
        working when your phone is locked or offline. Configure and visually build steps in the touch-first Agent Studio right on your phone.
      </AppText>
      <Card>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={160}
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
        />
        <AppText variant="label">Trigger</AppText>
        <View style={styles.options} accessibilityRole="radiogroup">
          {TRIGGERS.map((t) => {
            const selected = t.value === triggerType;
            return (
              <Pressable
                key={t.value}
                onPress={() => setTriggerType(t.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? colors.ring : colors.border,
                    backgroundColor: selected ? colors.selected : colors.card,
                  },
                ]}
              >
                <AppText variant="label">{t.label}</AppText>
                <AppText variant="caption">{t.hint}</AppText>
              </Pressable>
            );
          })}
        </View>
        <Button
          label="Create automation"
          onPress={() => create.mutate()}
          loading={create.isPending}
          disabled={!name.trim()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing.sm },
  option: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
});
