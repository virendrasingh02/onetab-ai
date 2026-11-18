import { TabStack } from '../../../../components/navigation';

export default function HomeStack() {
  // The workspace name (with its switcher) sits in the screen's own header,
  // so the nav title matches the tab label instead of repeating it.
  return <TabStack title="Home" />;
}
