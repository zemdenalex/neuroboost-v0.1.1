// apps/shell/main.mjs  — ESM, no duplicate identifiers
import { app, BrowserWindow, Tray, Menu, globalShortcut } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let tray = null;
let win = null;

// Single-instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const startUrl = process.env.NB_SHELL_URL || 'http://localhost:5173';
  win.loadURL(startUrl);
}

app.whenReady().then(() => {
  createWindow();

  // Tray (safe even if icon missing)
  try {
    let iconPath = path.join(process.cwd(), 'apps', 'shell', 'icon.png');
    if (!fs.existsSync(iconPath)) iconPath = undefined;
    tray = new Tray(iconPath);
    const menu = Menu.buildFromTemplate([
      { label: 'Open NeuroBoost', click: () => { if (win) { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setToolTip('NeuroBoost');
    tray.setContextMenu(menu);
    tray.on('click', () => { if (win) { win.show(); win.focus(); } });
  } catch (e) {
    console.warn('[shell] tray setup failed:', e?.message || e);
  }

  // Optional hotkey (Ctrl+Alt+N). Disable with NB_NO_HOTKEY=1
  if (!process.env.NB_NO_HOTKEY) {
    try { globalShortcut.register('Control+Alt+N', () => { if (win) { win.show(); win.focus(); } }); }
    catch (e) { console.warn('[shell] global shortcut failed:', e?.message || e); }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
