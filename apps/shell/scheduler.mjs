// apps/shell/scheduler.mjs
// Schedules OS notifications at T-5 / T-1 for upcoming events.
// Node 20 / Electron main process (ESM)

import { Notification } from 'electron';

const MSK = 3 * 60 * 60 * 1000;
const DEDUPE_MS = 120 * 1000;           // 2 minutes
const HORIZON_MS = 6 * 60 * 60 * 1000;  // look-ahead 6h
const POLL_MS = Number(process.env.NB_POLL_MS || 30000);
const API = process.env.NB_API_URL || 'http://localhost:3001';

const dedupe = new Map(); // key -> lastShownMs
function seen(key, now) {
  const last = dedupe.get(key) || 0;
  if (now - last < DEDUPE_MS) return true;
  dedupe.set(key, now);
  return false;
}

function withinQuietHours(nowUtc) {
  // NB_QUIET="23:00-08:00" (MSK) to silence notifications
  const q = process.env.NB_QUIET || '';
  const m = q.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return false;
  const [_, aH, aM, bH, bM] = m.map(Number);
  const mins = (new Date(nowUtc.getTime() + MSK)).getUTCHours() * 60
             + (new Date(nowUtc.getTime() + MSK)).getUTCMinutes();
  const A = aH * 60 + aM, B = bH * 60 + bM;
  return A <= B ? (mins >= A && mins < B) : (mins >= A || mins < B);
}

function hhmmMSK(isoUtc) {
  const d = new Date(new Date(isoUtc).getTime() + MSK);
  return d.toISOString().slice(11, 16);
}

async function fetchEventsWindow(now) {
  const start = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // include recent
  const end   = new Date(now.getTime() + HORIZON_MS).toISOString();
  const r = await fetch(`${API}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  if (!r.ok) throw new Error(`events fetch ${r.status}`);
  return r.json(); // [{ id, title, startsAt, endsAt, ... }]
}

function showNotif(title, body) {
  if (!Notification.isSupported()) {
    console.warn('[scheduler] Notification API not supported on this OS/session');
    return;
  }
  const n = new Notification({ title, body, silent: false });
  n.show();
}

function maybeNotify(phase, e, nowUtc) {
  const key = `${e.id}:${phase}`;
  if (seen(key, nowUtc.getTime())) return;
  if (withinQuietHours(nowUtc)) return;

  const title = phase === 'T-5' ? 'Upcoming (5 min)' : 'Starting now';
  const body  = `${e.title || '(no title)'} • ${hhmmMSK(e.startsAt)}–${hhmmMSK(e.endsAt)} MSK`;
  showNotif(title, body);
}

export function startScheduler() {
  let timer = null;
  async function tick() {
    try {
      const now = new Date();
      const events = await fetchEventsWindow(now);
      for (const e of events) {
        const mins = Math.round((new Date(e.startsAt).getTime() - now.getTime()) / 60000);
        if (mins === 5) maybeNotify('T-5', e, now);
        if (mins === 1 || mins === 0) maybeNotify('T-1', e, now);
      }
    } catch (err) {
      console.warn('[scheduler] tick error:', err?.message || err);
    } finally {
      timer = setTimeout(tick, POLL_MS);
    }
  }
  tick();
  return () => timer && clearTimeout(timer);
}
