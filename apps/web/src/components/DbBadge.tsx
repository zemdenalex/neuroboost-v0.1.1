import { useEffect, useState } from 'react';
import { API_BASE } from '../api';

export default function DbBadge() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/healthz/db`)
      .then(r => r.json())
      .then(d => setOk(!!d.ok))
      .catch(() => setOk(false));
  }, []);
  if (ok === null) return <div className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-200">DB: …</div>;
  if (ok === false) return <div className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-200 border border-red-700">DB: down</div>;
  return <div className="text-xs px-2 py-1 rounded bg-emerald-900/30 text-emerald-200 border border-emerald-700">DB: ok</div>;
}
