import { app, BrowserWindow, Tray, Menu, Notification } from 'electron';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    title: 'OneTab AI — Workspace Desktop',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devServerUrl = process.env['WEB_APP_URL'] ?? 'http://localhost:4200';
  mainWindow.loadURL(devServerUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray(process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open OneTab AI', click: () => mainWindow?.show() },
    { label: 'Trigger AI Assistant', click: () => showNativeNotification('AI Assistant', 'OneTab AI Copilot is listening...') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('OneTab AI Workspace');
  tray.setContextMenu(contextMenu);
}

function showNativeNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  showNativeNotification('OneTab AI Desktop Ready', 'Connected to local workspace and matrix homeserver.');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
