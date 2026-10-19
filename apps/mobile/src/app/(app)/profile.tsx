import { userApi } from '@org/api-client';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Screen,
  TextField,
} from '../../components/ui';
import { useSession } from '../../lib/session';
import { spacing } from '../../theme/tokens';

export default function ProfileScreen() {
  const { user, setUser } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  const save = useMutation({
    mutationFn: () =>
      userApi.updateProfile({
        name: name.trim(),
        displayName: displayName.trim() || null,
        jobTitle: jobTitle.trim() || null,
        bio: bio.trim() || null,
      }),
    onSuccess: (updated) => {
      if (user) setUser({ ...user, ...updated });
      Alert.alert('Profile saved');
    },
    onError: (error) => Alert.alert('Could not save', error.message),
  });

  if (!user) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar name={user.name} uri={user.avatarUrl} size={72} />
        <AppText variant="heading">{user.displayName || user.name}</AppText>
        <AppText variant="muted">{user.email}</AppText>
      </View>
      <Card>
        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={48}
        />
        <TextField
          label="Job title"
          value={jobTitle}
          onChangeText={setJobTitle}
          maxLength={80}
        />
        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={280}
        />
        <Button
          label="Save"
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={name.trim().length < 2}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
});
