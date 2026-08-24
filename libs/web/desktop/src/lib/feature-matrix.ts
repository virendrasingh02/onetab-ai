export interface FeatureMatrixItem {
  name: string;
  description: string;
  web: boolean;
  desktop: boolean;
  windows: boolean;
  macos: boolean;
  linux: boolean;
  permissionRequired: boolean;
  runtimeRequired: 'browser' | 'electron' | 'any';
  fallback: string | null;
}

export const FEATURE_MATRIX: Record<string, FeatureMatrixItem> = {
  browserAuth: {
    name: 'Browser-Based Authentication (PKCE)',
    description: 'Sign in securely via default system browser with authorization code exchange',
    web: true,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: false,
    runtimeRequired: 'any',
    fallback: 'In-app credential login',
  },
  deepLinks: {
    name: 'Custom Protocol Deep Links (onetab:// and mie://)',
    description: 'Launch application and focus screens directly from URLs and external links',
    web: false,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: false,
    runtimeRequired: 'electron',
    fallback: 'Web application URL navigation',
  },
  nativeNotifications: {
    name: 'OS Desktop Notifications',
    description: 'System toast notifications that focus app and route to chats/agents/workflows on click',
    web: true,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: true,
    runtimeRequired: 'any',
    fallback: 'In-app notification toast and badges',
  },
  appUpdates: {
    name: 'Automatic App Updates',
    description: 'Check for updates, background download, and restart-to-install',
    web: false,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: false,
    runtimeRequired: 'electron',
    fallback: null,
  },
  autoLaunch: {
    name: 'Launch at Login',
    description: 'Start application in background upon user OS login',
    web: false,
    desktop: true,
    windows: true,
    macos: true,
    linux: false,
    permissionRequired: false,
    runtimeRequired: 'electron',
    fallback: null,
  },
  safeStorage: {
    name: 'Encrypted Credential Storage',
    description: 'OS-level encrypted token persistence using DPAPI / Keychain / Libsecret',
    web: false,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: false,
    runtimeRequired: 'electron',
    fallback: 'In-memory token with httpOnly cookie',
  },
  nativeFileSystem: {
    name: 'Native File System Dialogs',
    description: 'OS Save As and File Picker dialogs without browser download constraints',
    web: true,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: false,
    runtimeRequired: 'any',
    fallback: 'Standard browser file input and anchor downloads',
  },
  windowControls: {
    name: 'Frameless Window & Theme Sync',
    description: 'Custom frameless title bar with native window minimize, maximize, and theme sync',
    web: false,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: false,
    runtimeRequired: 'electron',
    fallback: null,
  },
  singleInstance: {
    name: 'Single Instance Enforcement',
    description: 'Re-focus running instance on duplicate launch or protocol triggers',
    web: false,
    desktop: true,
    windows: true,
    macos: true,
    linux: true,
    permissionRequired: false,
    runtimeRequired: 'electron',
    fallback: null,
  },
};
