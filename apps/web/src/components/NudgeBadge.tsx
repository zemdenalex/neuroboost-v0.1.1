import { useEffect, useState } from 'react';
import { API_BASE } from '../api';

type Status = {
  ok: boolean;
  routePrimary: string;
  dedupeWindowSec: number;
  weeklyPlannerLocal: string;
  weeklyPlannerUtc: string;
};

export default function NudgeBadge() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/status/nudges`)
      .then(r => r.json())
      .then(setS)
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <div className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-200">Nudges: error</div>;
  if (!s)  return <div className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-200">Nudges: …</div>;

  const route = s.routePrimary === 'telegram-stub' ? 'Telegram (stub)' : s.routePrimary;
  const planner = new Date(s.weeklyPlannerLocal).toLocaleString('ru-RU', {
    weekday: 'short', hour: '2-digit', minute: '2-digit', month: 'short', day: '2-digit'
  });

  return (
    <div className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
      <span className="font-mono">Nudges:</span>{' '}
      <span>route <span className="font-semibold">{route}</span></span>{' '}
      <span>• dedupe {s.dedupeWindowSec}s</span>{' '}
      <span>• planner {planner}</span>
    </div>
  );
}
