import { Router, Request, Response } from 'express';

export const statusRoute = Router();

statusRoute.get('/status/route', (_req: Request, res: Response) => {
  const primary = process.env.NB_ROUTE_PRIMARY || 'telegram-stub';
  const quiet = process.env.NB_QUIET || '';
  res.json({
    ok: true,
    primary,              // "telegram-stub" | "shell" | "web"
    dedupeWindowSec: 120,
    quietHours: quiet,
    writesEnabled: false  // MVP: writes are disabled
  });
});
