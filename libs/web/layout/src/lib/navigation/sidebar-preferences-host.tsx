import { useCurrentUser } from '@org/auth';
import { useSidebarCustomizerStore } from '@org/ui';
import { SidebarCustomizerDialog } from './sidebar-customizer-dialog.js';
import { useSidebarLayoutBridge, useSidebarSync } from './use-sidebar-sync.js';

/**
 * What `AppShell` provides for sidebar preferences, for screens that render
 * outside it (the settings surface): the server sync, the `layoutMode` bridge
 * the settings "Sidebar view" row reads, and the customizer dialog its
 * "App sidebar → Customize" button opens. Never mount alongside `AppShell`.
 */
export function SidebarPreferencesHost() {
  const user = useCurrentUser();
  useSidebarSync(!!user);
  useSidebarLayoutBridge();
  const open = useSidebarCustomizerStore((s) => s.open);
  const setOpen = useSidebarCustomizerStore((s) => s.setOpen);
  return <SidebarCustomizerDialog open={open} onOpenChange={setOpen} />;
}
