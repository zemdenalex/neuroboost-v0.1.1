import { app, BrowserWindow, Notification, globalShortcut, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';
const ACTIVE_ROUTE = process.env.ACTIVE_ROUTE || 'electron'; // 'telegram' later
const DEDUPE_WINDOW_MS = 120_000; // 2 minutes
const MSK_OFFSET_MS = 3 * 3600_000; // fixed UTC+03:00

if (process.platform === 'win32') {
  app.setAppUserModelId('com.neuroboost.app');
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { contextIsolation: true }
  });
  win.loadURL(WEB_URL);
}

const storePath = () => path.join(app.getPath('userData'), 'nb-store.json');
let store = { dedupe: {}, planner: {} };
async function loadStore() {
  try { store = JSON.parse(await fs.readFile(storePath(), 'utf8')); } catch { /* first run */ }
}
async function saveStore() {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(store, null, 2), 'utf8');
}

function nowMsk() { return new Date(Date.now() + MSK_OFFSET_MS); }
function toKey(obj) { return Object.entries(obj).map(([k, v]) => `${k}:${v}`).sort().join('|'); }
function shouldSend(key) {
  const last = store.dedupe[key] || 0;
  const now = Date.now();
  if (now - last < DEDUPE_WINDOW_MS) return false;
  store.dedupe[key] = now;
  return true;
}
async function notify(title, body) {
  if (ACTIVE_ROUTE !== 'electron') return; // single active route policy
  new Notification({ title, body, silent: false }).show();
}

async function pollUpcoming() {
  // Pull next 2h window and send T-5 / T-1 nudges
  const now = new Date();
  const soonEnd = new Date(now.getTime() + 2 * 3600_000);
  try {
    const url = `${API_BASE}/events?start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(soonEnd.toISOString())}`;
    const r = await fetch(url);
    if (!r.ok) return;
    const events = await r.json();
    for (const ev of events) {
      const start = new Date(ev.startsAt);
      const diffMin = Math.floor((start.getTime() - now.getTime()) / 60000);
      if (diffMin === 5 || diffMin === 1) {
        const key = toKey({ type: 'pre', id: ev.masterId || ev.id, when: diffMin, route: ACTIVE_ROUTE });
        if (shouldSend(key)) await notify(`Upcoming: ${ev.title}`, `Starts in ${diffMin} min`);
      }
    }
  } catch { /* offline? ignore */ }
  await saveStore();
}

function mondayOfWeekISO(msk = nowMsk()) {
  const dow = msk.getUTCDay() || 7; // 1..7 (Sun->7)
  const monday = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - (dow - 1)));
  return monday.toISOString().slice(0, 10);
}
async function plannerTick() {
  // Sunday 18:00 Europe/Moscow; repeat hourly until ack
  const m = nowMsk();
  const dow = m.getUTCDay(); // 0=Sun in UTC clock aligned to Moscow offset
  const hour = m.getUTCHours();
  const isSunday = (dow === 0);
  if (isSunday && hour === 18) {
    const wk = mondayOfWeekISO(m);
    if (store.planner[wk] !== 'ack') {
      const key = toKey({ type: 'planner', week: wk, hour: 18, route: ACTIVE_ROUTE });
      if (shouldSend(key)) await notify('Weekly planner', 'It’s 18:00 — plan the upcoming week.');
    }
  }
  await saveStore();
}

function registerMenu() {
  const template = [
    { label: 'NeuroBoost Shell', submenu: [
      { label: 'Open Window', click: () => { if (win?.isDestroyed()) createWindow(); else win?.show(); } },
      { label: 'Mark Weekly Planner as Done (this week)', accelerator: 'CommandOrControl+Shift+P', click: () => {
          const wk = mondayOfWeekISO(); store.planner[wk] = 'ack'; saveStore();
        }},
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    const wk = mondayOfWeekISO(); store.planner[wk] = 'ack'; saveStore();
  });
}

app.whenReady().then(async () => {
  await loadStore();
  createWindow();
  registerMenu();

  // Schedulers
  setInterval(pollUpcoming, 30_000); // 30s cadence; dedupe prevents floods
  setInterval(plannerTick, 60_000);  // check hourly trigger
  await pollUpcoming();
  await plannerTick();
});

app.on('window-all-closed', () => { /* keep background */ });
app.on('before-quit', () => { globalShortcut.unregisterAll(); });
