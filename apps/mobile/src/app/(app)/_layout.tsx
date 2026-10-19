import { Redirect, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
} from '../../components/ui';
import {
  useModalScreenOptions,
  useStackScreenOptions,
} from '../../components/navigation';
import { appConfig } from '../../lib/config';
import { usePushNotifications } from '../../lib/push';
import { useSession } from '../../lib/session';
import { useWorkspace, WorkspaceProvider } from '../../lib/workspace';

export default function AppLayout() {
  const { status } = useSession();
  // A concrete URL, not a navigator guard: on web a guard redirect to the
  // `(auth)` group lands on the bare `/(auth)` path, which matches no route.
  if (status !== 'signedIn') return <Redirect href="/sign-in" />;
  return (
    <WorkspaceProvider>
      <WorkspaceGate />
    </WorkspaceProvider>
  );
}

function WorkspaceGate() {
  const { workspace, isPending, error, refetch } = useWorkspace();
  const { signOut } = useSession();
  const stackOptions = useStackScreenOptions();
  const modal = useModalScreenOptions();
  usePushNotifications();

  if (isPending) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingState label="Loading your workspaces…" />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }
  if (!workspace) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          icon="business-outline"
          title="No workspace yet"
          description="Create or join a workspace on the web, then pull to refresh here."
          action={
            <>
              <Button
                label="Open Onetab AI on the web"
                onPress={() =>
                  void WebBrowser.openBrowserAsync(appConfig.webUrl)
                }
              />
              <Button
                label="Refresh"
                variant="secondary"
                onPress={() => void refetch()}
              />
              <Button
                label="Sign out"
                variant="ghost"
                onPress={() => void signOut()}
              />
            </>
          }
        />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="channel/[slug]" options={{ title: 'Channel' }} />
      <Stack.Screen name="dm/[roomId]" options={{ title: 'Direct message' }} />
      <Stack.Screen
        name="dm/new"
        options={modal('New message')}
      />
      <Stack.Screen name="thread/[rootId]" options={{ title: 'Thread' }} />
      <Stack.Screen
        name="agent/new"
        options={modal('New agent')}
      />
      <Stack.Screen name="agent/[agentId]/index" options={{ title: 'Agent' }} />
      <Stack.Screen name="agent/[agentId]/chat" options={{ title: 'Chat' }} />
      <Stack.Screen
        name="agent/[agentId]/edit"
        options={modal('Configure agent')}
      />
      <Stack.Screen
        name="automation/new"
        options={modal('New automation')}
      />
      <Stack.Screen
        name="automation/[workflowId]"
        options={{ title: 'Automation' }}
      />
      <Stack.Screen name="executions" options={{ title: 'Executions' }} />
      <Stack.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="integrations" options={{ title: 'Integrations' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="team" options={{ title: 'Team & coworkers' }} />
      <Stack.Screen name="billing" options={{ title: 'Plan & usage' }} />
      <Stack.Screen name="files" options={{ title: 'Files' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen
        name="workspaces"
        options={modal('Switch workspace')}
      />
    </Stack>
  );
}
