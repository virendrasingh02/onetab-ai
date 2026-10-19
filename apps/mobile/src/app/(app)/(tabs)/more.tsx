import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import {
  Card,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  type IconName,
} from '../../../components/ui';
import { useSession } from '../../../lib/session';
import { useWorkspace } from '../../../lib/workspace';

interface Item {
  icon: IconName;
  title: string;
  subtitle?: string;
  href: Href;
}

function Group({ items }: { items: Item[] }) {
  const router = useRouter();
  return (
    <Card style={{ paddingVertical: 4 }}>
      {items.map((item, index) => (
        <View key={item.title}>
          {index > 0 ? <Divider /> : null}
          <ListRow
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            onPress={() => router.push(item.href)}
          />
        </View>
      ))}
    </Card>
  );
}

export default function MoreTab() {
  const { user } = useSession();
  const { workspace, workspaces } = useWorkspace();
  const router = useRouter();

  return (
    <Screen>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow
          avatar={{ name: user?.name ?? '?', uri: user?.avatarUrl }}
          title={user?.displayName || user?.name || 'Profile'}
          subtitle={user?.email}
          onPress={() => router.push('/profile')}
        />
        {workspaces.length > 1 ? (
          <>
            <Divider />
            <ListRow
              icon="swap-horizontal-outline"
              title={workspace?.name ?? 'Workspace'}
              subtitle={`Switch workspace · ${workspaces.length} available`}
              onPress={() => router.push('/workspaces')}
            />
          </>
        ) : null}
      </Card>

      <SectionHeader title="AI" />
      <Group
        items={[
          {
            icon: 'pulse-outline',
            title: 'Executions',
            subtitle: 'Monitor, pause and retry runs',
            href: '/executions',
          },
          {
            icon: 'hand-left-outline',
            title: 'Approvals',
            subtitle: 'Decide on pending agent actions',
            href: '/approvals',
          },
        ]}
      />

      <SectionHeader title="Workspace" />
      <Group
        items={[
          {
            icon: 'bar-chart-outline',
            title: 'Analytics',
            subtitle: 'Activity and AI usage',
            href: '/analytics',
          },
          {
            icon: 'extension-puzzle-outline',
            title: 'Integrations',
            subtitle: 'Connected apps and services',
            href: '/integrations',
          },
          {
            icon: 'folder-open-outline',
            title: 'Files',
            subtitle: 'Upload, download and share',
            href: '/files',
          },
          { icon: 'people-outline', title: 'Team & coworkers', href: '/team' },
          { icon: 'card-outline', title: 'Plan & usage', href: '/billing' },
        ]}
      />

      <SectionHeader title="App" />
      <Group
        items={[
          {
            icon: 'notifications-outline',
            title: 'Notifications',
            href: '/notifications',
          },
          {
            icon: 'settings-outline',
            title: 'Settings',
            subtitle: 'Security, notifications, sign out',
            href: '/settings',
          },
        ]}
      />
    </Screen>
  );
}
