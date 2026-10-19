import { TabStack } from '../../../../components/navigation';

// The segmented control sits above the list, so a collapsing large title
// would never collapse; Chat keeps the compact header.
export default function ChatStack() {
  return <TabStack title="Chat" largeTitle={false} />;
}
