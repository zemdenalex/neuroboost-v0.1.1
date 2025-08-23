import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import rrulePkg from 'rrule';
const { RRule } = rrulePkg;
import path from 'node:path';
import fs from 'node:fs/promises'; // not used to write; only to check existence if asked later
import { DateTime } from 'luxon';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// Health with DB round-trip + UTC confirmation
app.get('/health', async (_req, res) => {
  try {
    const now = await prisma.$queryRawUnsafe(`SELECT now() AT TIME ZONE 'UTC' AS utc_now;`);
    res.json({ ok: true, db: 'ok', utc_now: now?.[0]?.utc_now ?? null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Minimal dry-run exporter endpoint
// Query ?vault=/absolute/path/to/your/ObsidianVault  (optional)
// ALWAYS confines to NeuroBoost/; NEVER writes.

function confineToNeuroBoost(vaultPathAbs) {
  const root = path.resolve(vaultPathAbs ?? process.cwd());
  const nbRoot = path.join(root, 'NeuroBoost');
  return { root, nbRoot };
}

app.get('/export/dry-run', async (req, res) => {
  const VAULT = req.query.vault ? String(req.query.vault) : undefined;
  const { nbRoot } = confineToNeuroBoost(VAULT);

  // Collect minimal slices
  const [tasks, events] = await Promise.all([
    prisma.task.findMany({ include: { subtasks: true } }),
    prisma.event.findMany({ include: { reminders: true } })
  ]);

  // Compose planned files (no writes)
  const ops = [];

  // Tasks -> NeuroBoost/tasks/<id>.md
  for (const t of tasks) {
    const rel = path.join('NeuroBoost', 'tasks', `${t.id}.md`);
    const preview = [
      `---`,
      `id: ${t.id}`,
      `type: task`,
      `priority: ${t.priority}`,
      `status: ${t.status}`,
      `tags: ["#neuroboost"]`,
      `---`,
      ``,
      `# ${t.title}`,
      t.description ?? ''
    ].join('\n');
    ops.push({ relPath: rel, bytes: Buffer.byteLength(preview, 'utf8') });
  }

  // Events -> NeuroBoost/calendar/<YYYY>/<YYYY-MM-DD>__<id>.md
  const fmt = (d) => new Date(d).toISOString().slice(0, 10);
  for (const ev of events) {
    const day = fmt(ev.startsAt);
    const year = day.slice(0, 4);
    const rel = path.join('NeuroBoost', 'calendar', year, `${day}__${ev.id}.md`);
    const preview = [
      `---`,
      `id: ${ev.id}`,
      `type: event`,
      `all_day: ${ev.allDay}`,
      `rrule: ${ev.rrule ?? ''}`,
      `starts_at_utc: ${new Date(ev.startsAt).toISOString()}`,
      `ends_at_utc: ${new Date(ev.endsAt).toISOString()}`,
      `tags: ["#neuroboost","#calendar"]`,
      `---`,
      ``,
      `# ${ev.title}`
    ].join('\n');
    ops.push({ relPath: rel, bytes: Buffer.byteLength(preview, 'utf8') });
  }

  // Confinement check (no path escapes)
  const safe = ops.filter(o => !path.normalize(o.relPath).includes('..') && o.relPath.startsWith('NeuroBoost' + path.sep));
  res.json({ mode: 'dry-run', planned: safe.length, files: safe.slice(0, 25) /* preview first 25 */ });
});

// Start
const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;
app.listen(PORT, () => {
  console.log(`@nb/api listening on http://localhost:${PORT}`);
});


// after app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' }));

// ---- helpers ----
function toDate(v) { const d = new Date(v); if (isNaN(d)) throw new Error('Bad date'); return d; }
const DMIN = (ms) => Math.floor(ms / 60000);

async function expandEvent(prisma, ev, rangeStart, rangeEnd) {
  const duration = new Date(ev.endsAt) - new Date(ev.startsAt);
  const out = [];

  // exceptions (skips) by ISO start
  const ex = await prisma.eventException.findMany({ where: { eventId: ev.id, skipped: true } });
  const skip = new Set(ex.map(e => new Date(e.occurrence).toISOString()));

  if (!ev.rrule) {
    const s = new Date(ev.startsAt), e = new Date(ev.endsAt);
    if (e >= rangeStart && s <= rangeEnd) out.push({ ...ev, occurrenceStart: s, occurrenceEnd: e, masterId: ev.id });
    return out;
  }
  const ruleStr = ev.rrule.startsWith('RRULE:') ? ev.rrule : 'RRULE:' + ev.rrule;
  const r = RRule.fromString(ruleStr);
  // ensure DTSTART from first instance start:
  r.options.dtstart = new Date(ev.startsAt);

  const between = r.between(rangeStart, rangeEnd, true);
  for (const dt of between) {
    const startISO = dt.toISOString();
    if (skip.has(startISO)) continue;
    out.push({
      ...ev,
      occurrenceStart: dt,
      occurrenceEnd: new Date(dt.getTime() + duration),
      masterId: ev.id
    });
  }
  return out;
}

// ---- routes ----

// Fetch events expanded (occurrences) in [start,end]
app.get('/events', async (req, res) => {
  try {
    const start = toDate(req.query.start);
    const end = toDate(req.query.end);
    const base = await prisma.event.findMany({ include: { exceptions: true } });
    const occsAll = [];
    for (const ev of base) {
      const occs = await expandEvent(prisma, ev, start, end);
      occsAll.push(...occs);
    }
    // respond in UTC ISO
    res.json(occsAll.map(o => ({
      id: o.id,
      masterId: o.masterId,
      title: o.title,
      allDay: o.allDay,
      rrule: o.rrule,
      startsAt: o.occurrenceStart.toISOString(),
      endsAt: o.occurrenceEnd.toISOString()
    })));
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Create event (expect UTC ISO timestamps from client)
app.post('/events', async (req, res) => {
  try {
    const { title, startsAt, endsAt, allDay = false, rrule = null, sourceTaskId = null } = req.body || {};
    if (!title || !startsAt || !endsAt) return res.status(400).json({ error: 'title, startsAt, endsAt required' });
    const ev = await prisma.event.create({
      data: { title, startsAt: new Date(startsAt), endsAt: new Date(endsAt), allDay, rrule, tz: 'Europe/Moscow', sourceTaskId }
    });
    res.json({ id: ev.id });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Move/resize (UTC ISO fields)
app.patch('/events/:id', async (req, res) => {
  try {
    const { startsAt, endsAt, rrule } = req.body || {};
    if (!startsAt && !endsAt && !rrule) return res.status(400).json({ error: 'nothing to update' });
    const ev = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
        ...(endsAt ? { endsAt: new Date(endsAt) } : {}),
        ...(rrule !== undefined ? { rrule } : {})
      }
    });
    res.json({ ok: true, id: ev.id });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Reflection
app.post('/events/:id/reflection', async (req, res) => {
  try {
    const { focusPct, goalPct, mood, note } = req.body || {};
    if ([focusPct, goalPct, mood].some(v => typeof v !== 'number')) return res.status(400).json({ error: 'numbers required' });
    const r = await prisma.reflection.create({
      data: { eventId: req.params.id, focusPct, goalPct, mood, note: note ?? null }
    });
    res.json({ ok: true, id: r.id });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// Weekly stats (start=YYYY-MM-DD)
app.get('/stats/week', async (req, res) => {
  try {
    const d = new Date(req.query.start + 'T00:00:00Z'); // ISO day start UTC
    if (isNaN(d)) return res.status(400).json({ error: 'bad start' });
    const end = new Date(d.getTime() + 7 * 86400000);
    const events = await prisma.event.findMany({
      where: { endsAt: { gte: d }, startsAt: { lte: end } },
      include: { reflections: true }
    });
    const planned = events.reduce((s, e) => s + DMIN(new Date(e.endsAt) - new Date(e.startsAt)), 0);
    const completed = events.reduce((s, e) => s + (e.reflections.length ? DMIN(new Date(e.endsAt) - new Date(e.startsAt)) : 0), 0);
    const perDay = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(d.getTime() + i * 86400000);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayEvents = events.filter(e => new Date(e.endsAt) >= dayStart && new Date(e.startsAt) < dayEnd);
      const p = dayEvents.reduce((s, e) => s + DMIN(new Date(e.endsAt) - new Date(e.startsAt)), 0);
      const c = dayEvents.reduce((s, e) => s + (e.reflections.length ? DMIN(new Date(e.endsAt) - new Date(e.startsAt)) : 0), 0);
      perDay.push({ date: dayStart.toISOString().slice(0, 10), plannedMin: p, completedMin: c });
    }
    res.json({ plannedMin: planned, completedMin: completed, adherencePct: planned ? Math.round((completed / planned) * 100) : 0, perDay });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});


// Next Sunday 18:00 Europe/Moscow
function nextWeeklyPlannerISO() {
  const zone = 'Europe/Moscow';
  const now = DateTime.now().setZone(zone);
  const daysUntilSunday = (7 - now.weekday) % 7; // ISO 1..7
  let dt = now.plus({ days: daysUntilSunday }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
  if (dt <= now) dt = dt.plus({ weeks: 1 });
  return { localISO: dt.toISO(), utcISO: dt.toUTC().toISO() };
}

app.get('/status/nudges', (_req, res) => {
  const routePrimary = process.env.NB_ROUTE_PRIMARY || 'telegram-stub'; // 'telegram-stub'|'shell'|'web'
  const dedupeWindowSec = 120;
  const planner = nextWeeklyPlannerISO();
  res.json({
    ok: true,
    routePrimary,
    dedupeWindowSec,
    weeklyPlannerLocal: planner.localISO,
    weeklyPlannerUtc: planner.utcISO,
  });
});

app.post('/notify/test', (_req, res) => {
  const routePrimary = process.env.NB_ROUTE_PRIMARY || 'telegram-stub';
  res.json({
    ok: true,
    wouldUse: routePrimary,
    note: routePrimary === 'telegram-stub'
      ? 'Telegram route present but disabled (stub); no sends performed.'
      : 'No-op test only; sending is disabled in this build.',
  });
});

// --- helper: fallback calculator if Luxon fails ---
function nextWeeklyPlannerFallbackUtcIso() {
  const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+03:00 year-round
  const nowUtc = new Date();
  const nowMsk = new Date(nowUtc.getTime() + MSK_OFFSET_MS);

  const weekday = nowMsk.getUTCDay(); // 0..6, Sunday=0
  const daysUntilSunday = (7 - weekday) % 7;
  let targetMsk = new Date(nowMsk.getTime() + daysUntilSunday * 86400000);
  targetMsk.setUTCHours(18, 0, 0, 0);
  if (targetMsk <= nowMsk) targetMsk = new Date(targetMsk.getTime() + 7 * 86400000);

  const targetUtc = new Date(targetMsk.getTime() - MSK_OFFSET_MS);
  return {
    weeklyPlannerLocal: new Date(targetUtc.getTime() + MSK_OFFSET_MS).toISOString().replace('Z', '+03:00'),
    weeklyPlannerUtc: targetUtc.toISOString()
  };
}

app.get('/status/nudges', (_req, res) => {
  try {
    const routePrimary = process.env.NB_ROUTE_PRIMARY || 'telegram-stub';
    const dedupeWindowSec = 120;

    let weeklyPlannerLocal, weeklyPlannerUtc;
    try {
      const zone = 'Europe/Moscow';
      const now = DateTime.now().setZone(zone);
      const daysUntilSunday = (7 - now.weekday) % 7; // ISO weekday 1..7
      let dt = now.plus({ days: daysUntilSunday }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
      if (dt <= now) dt = dt.plus({ weeks: 1 });
      weeklyPlannerLocal = dt.toISO();      // includes +03:00
      weeklyPlannerUtc   = dt.toUTC().toISO();
    } catch {
      const fb = nextWeeklyPlannerFallbackUtcIso();
      weeklyPlannerLocal = fb.weeklyPlannerLocal;
      weeklyPlannerUtc   = fb.weeklyPlannerUtc;
    }

    res.json({ ok: true, routePrimary, dedupeWindowSec, weeklyPlannerLocal, weeklyPlannerUtc });
  } catch (err) {
    console.error('[status/nudges] unexpected error:', err);
    const fb = nextWeeklyPlannerFallbackUtcIso();
    res.status(200).json({
      ok: false,
      routePrimary: process.env.NB_ROUTE_PRIMARY || 'telegram-stub',
      dedupeWindowSec: 120,
      weeklyPlannerLocal: fb.weeklyPlannerLocal,
      weeklyPlannerUtc: fb.weeklyPlannerUtc,
      error: 'status-compute-failed'
    });
  }
});
