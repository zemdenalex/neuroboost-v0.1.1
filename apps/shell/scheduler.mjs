// Node 20+ / Electron main context
const MSK = 3 * 60 * 60 * 1000;
const DEDUPE_MS = 120 * 1000; // 2 minutes
const HORIZON_MS = 6 * 60 * 60 * 1000; // look-ahead 6h
const POLL_MS = 30 * 1000; // poll every 30s
const API = process.env.NB_API_URL || 'http://localhost:3001';

const dedupe = new Map(); // key -> lastShownMs
function seen(key, now) {
  const last = dedupe.get(key) || 0;
  if (now - last < DEDUPE_MS) return true;
  dedupe.set(key, now);
  return false;
}

function withinQuietHours(nowUtc) {
  // env NB_QUIET="23:00-08:00" (local MSK), default none
  const q = process.env.NB_QUIET || '';
  const m = q.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return false;
  const toMin = (h, mi) => h * 60 + mi;
  const [_, h1, m1, h2, m2] = m.map(Number);
  const nowMsk = new Date(nowUtc.getTime() + MSK);
  const mins = nowMsk.getUTCHours() * 60 + nowMsk.getUTCMinutes();
  const a = toMin(h1, m1), b = toMin(h2, m2);
  return a <= b ? (mins >= a && mins < b) : (mins >= a || mins < b);
}

function hhmmMSK(isoUtc) {
  const d = new Date(new Date(isoUtc).getTime() + MSK);
  return d.toISOString().slice(11, 16);
}

async function fetchEventsWindow(now) {
  const start = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // include recent
  const end = new Date(now.getTime() + HORIZON_MS).toISOString();
  const r = await fetch(`${API}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  if (!r.ok) throw new Error(`events fetch ${r.status}`);
  return r.json(); // [{ id, title, startsAt, endsAt, ... }]
}

function maybeNotify(phase, e, nowUtc) {
  const key = `${e.id}:${phase}`;
  if (seen(key, nowUtc.getTime())) return;
  // Skip during quiet hours, but still dedupe so we don't spam after quiet ends
  if (withinQuietHours(nowUtc)) return;

  new Notification({
    title: phase === 'T-5' ? 'Upcoming (5 min)' : 'Starting now',
    body: `${e.title || '(no title)'} • ${hhmmMSK(e.startsAt)}–${hhmmMSK(e.endsAt)} MSK`,
    silent: false,
  }).show();
}

export function startScheduler() {
  let timer = null;

  async function tick() {
    try {
      const now = new Date();
      const events = await fetchEventsWindow(now);
      for (const e of events) {
        const tMin = Math.round((new Date(e.startsAt).getTime() - now.getTime()) / 60000);
        if (tMin === 5) maybeNotify('T-5', e, now);
        if (tMin === 1 || tMin === 0) maybeNotify('T-1', e, now);
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
