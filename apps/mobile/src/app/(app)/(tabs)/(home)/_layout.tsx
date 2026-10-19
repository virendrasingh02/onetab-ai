import { TabStack } from '../../../../components/navigation';
import { useWorkspace } from '../../../../lib/workspace';

export default function HomeStack() {
  const { workspace } = useWorkspace();
  return <TabStack title={workspace?.name ?? 'Home'} />;
}
