// Electron type declarations for OneTab AI Desktop
// These are ambient declarations so the main process code typechecks
// without requiring the full electron npm package at dev time.

declare module 'electron' {
  export class BrowserWindow {
    constructor(options: Record<string, unknown>);
    loadURL(url: string): void;
    show(): void;
    on(event: string, callback: () => void): void;
  }

  export class Tray {
    constructor(iconPath: string);
    setToolTip(tooltip: string): void;
    setContextMenu(menu: Menu): void;
  }

  export class Menu {
    static buildFromTemplate(template: Array<{ label?: string; click?: () => void; type?: string }>): Menu;
  }

  export class Notification {
    static isSupported(): boolean;
    constructor(options: { title: string; body: string });
    show(): void;
  }

  export const app: {
    whenReady(): Promise<void>;
    quit(): void;
    on(event: string, callback: () => void): void;
  };

  export const process: {
    platform: string;
  };
}
