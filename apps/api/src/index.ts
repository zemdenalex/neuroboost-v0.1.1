import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { statusRoute } from './routes/status';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// CORS must be before routes; allow vite 5173–5179 and no-origin (curl)
const allow = [/^http:\/\/localhost:51\d{2}$/];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    cb(null, allow.some(rx => rx.test(origin)));
  }
}));

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.use(statusRoute);

// ---- Export (dry-run only; confined to NeuroBoost/) ----
function confineToNeuroBoost(vaultPathAbs?: string) {
  const root = path.resolve(vaultPathAbs ?? process.cwd());
  const nbRoot = path.join(root, 'NeuroBoost');
  return { root, nbRoot };
}

app.get('/export/dry-run', async (req: Request, res: Response) => {
  try {
    const VAULT = req.query.vault ? String(req.query.vault) : undefined;
    const { nbRoot } = confineToNeuroBoost(VAULT);

    const [tasks, events] = await Promise.all([
      prisma.task.findMany({ include: { subtasks: true } }).catch(() => []),
      prisma.event.findMany({ include: { reminders: true } }).catch(() => []),
    ]);

    const files: { path: string; action: 'create' | 'update'; bytes: number }[] = [];

    // Tasks -> NeuroBoost/tasks/<id>.md
    for (const t of tasks as any[]) {
      const rel = path.join('NeuroBoost', 'tasks', `${t.id}.md`);
      const preview = [
        '---',
        `id: ${t.id}`,
        'type: task',
        `priority: ${t.priority}`,
        `status: ${t.status}`,
        `tags: ["#neuroboost"]`,
        '---',
        '',
        `# ${t.title}`,
        t.description ?? ''
      ].join('\n');
      let action: 'create' | 'update' = 'create';
      try { await fs.access(path.join(nbRoot, 'tasks', `${t.id}.md`)); action = 'update'; } catch {}
      files.push({ path: rel.replace(/\\/g, '/'), action, bytes: Buffer.byteLength(preview, 'utf8') });
    }

    // Events -> NeuroBoost/calendar/<YYYY>/<YYYY-MM-DD>__<id>.md
    const dayISO = (d: any) => new Date(d).toISOString().slice(0, 10);
    for (const ev of events as any[]) {
      const day = dayISO(ev.startsAt);
      const year = day.slice(0, 4);
      const rel = path.join('NeuroBoost', 'calendar', year, `${day}__${ev.id}.md`);
      const preview = [
        '---',
        `id: ${ev.id}`,
        'type: event',
        `all_day: ${!!ev.allDay}`,
        `rrule: ${ev.rrule ?? ''}`,
        `starts_at_utc: ${new Date(ev.startsAt).toISOString()}`,
        `ends_at_utc: ${new Date(ev.endsAt).toISOString()}`,
        `tags: ["#neuroboost","#calendar"]`,
        '---',
        '',
        `# ${ev.title}`
      ].join('\n');
      let action: 'create' | 'update' = 'create';
      try { await fs.access(path.join(nbRoot, 'calendar', year, `${day}__${ev.id}.md`)); action = 'update'; } catch {}
      files.push({ path: rel.replace(/\\/g, '/'), action, bytes: Buffer.byteLength(preview, 'utf8') });
    }

    res.json({ mode: 'dry-run', planned: files.length, files: files.slice(0, 50) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---- Start ----
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));
