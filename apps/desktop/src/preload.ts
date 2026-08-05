export interface OneTabDesktopAPI {
  sendNotification: (title: string, body: string) => void;
  getOfflineCacheStatus: () => Promise<{ cached: boolean; lastSync: string }>;
}

declare global {
  interface Window {
    onetabDesktop?: OneTabDesktopAPI;
  }
}
