import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { IPC_EVENT, type DesktopCommand } from '../shared/ipc.js';
import { getMainWindow, markQuitting, showMainWindow } from './window.js';

function send(command: DesktopCommand): void {
  showMainWindow();
  getMainWindow()?.webContents.send(IPC_EVENT.command, command);
}

/**
 * The application menu.
 *
 * On macOS this is the menu bar and cannot be skipped — without it the standard
 * Cmd+C/V/Q accelerators stop working entirely, because Electron wires editing
 * shortcuts through menu roles. On Windows and Linux the window hides it
 * (`autoHideMenuBar`) but keeps the accelerators registered.
 */
export function buildAppMenu(isDev: boolean): Menu {
  const isMac = process.platform === 'darwin';

  const macAppMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('open-settings') },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            {
              label: 'Quit OneTab AI',
              accelerator: 'Cmd+Q',
              click: () => {
                markQuitting();
                app.quit();
              },
            },
          ],
        },
      ]
    : [];

  const template: MenuItemConstructorOptions[] = [
    ...macAppMenu,
    {
      label: 'File',
      submenu: [
        {
          label: 'New channel',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => send('new-channel'),
        },
        {
          label: 'Invite members…',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => send('open-invite'),
        },
        { type: 'separator' },
        ...(isMac
          ? [{ role: 'close' as const }]
          : [
              {
                label: 'Settings',
                accelerator: 'Ctrl+,',
                click: () => send('open-settings'),
              },
              { type: 'separator' as const },
              {
                label: 'Quit',
                accelerator: 'Ctrl+Q',
                click: () => {
                  markQuitting();
                  app.quit();
                },
              },
            ]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' as const }] : []),
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Search…',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('open-search'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Toggle sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => send('toggle-sidebar'),
        },
        {
          label: 'AI assistant',
          accelerator: 'CmdOrCtrl+J',
          click: () => send('open-ai-assistant'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: isMac
        ? [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
          ]
        : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('open-shortcuts'),
        },
        {
          label: 'Documentation',
          click: () => void shell.openExternal('https://github.com/onetab-ai'),
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'about' as const }]),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

export function installAppMenu(isDev: boolean): void {
  Menu.setApplicationMenu(buildAppMenu(isDev));
}
