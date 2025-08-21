import { Router } from 'express';
import { DateTime } from 'luxon';

const router = Router();

function nextWeeklyPlanner() {
  const zone = 'Europe/Moscow';
  const now = DateTime.now().setZone(zone);
  const daysUntilSunday = (7 - now.weekday) % 7; // ISO weekday 1..7
  let dt = now.plus({ days: daysUntilSunday }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
  if (dt <= now) dt = dt.plus({ weeks: 1 });
  return { localISO: dt.toISO(), utcISO: dt.toUTC().toISO() };
}

router.get('/status/nudges', (_req, res) => {
  const routePrimary = process.env.NB_ROUTE_PRIMARY || 'telegram-stub'; // 'telegram-stub'|'shell'|'web'
  const dedupeWindowSec = 120;
  const planner = nextWeeklyPlanner();
  res.json({
    ok: true,
    routePrimary,
    dedupeWindowSec,
    weeklyPlannerLocal: planner.localISO, // MSK
    weeklyPlannerUtc: planner.utcISO
  });
});

router.post('/notify/test', (_req, res) => {
  const routePrimary = process.env.NB_ROUTE_PRIMARY || 'telegram-stub';
  res.json({
    ok: true,
    wouldUse: routePrimary,
    note: routePrimary === 'telegram-stub'
      ? 'Telegram route present but disabled (stub); no sends performed.'
      : 'No-op test only; sending is disabled in this build.'
  });
});

export default router;
