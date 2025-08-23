import { useEffect, useState } from 'react';
import { API_BASE } from '../api';

function mondayUtcOfCurrentMskWeek(): string {
  const nowUtc = Date.now();
  const msk = new Date(nowUtc + 3*3600*1000);
  const idx = (msk.getUTCDay() + 6) % 7;
  const mskMid = new Date(msk); mskMid.setUTCHours(0,0,0,0);
  const monMskMid = mskMid.getTime() - idx*86400000;
  const monUtc0 = monMskMid - 3*3600*1000;
  return new Date(monUtc0).toISOString().slice(0,10); // YYYY-MM-DD
}

export default function StatsBadge() {
  const [txt, setTxt] = useState<string>('…');
  useEffect(() => {
    (async () => {
      try {
        const start = mondayUtcOfCurrentMskWeek();
        const r = await fetch(`${API_BASE}/stats/week?start=${start}`);
        if (!r.ok) throw 0;
        const s = await r.json();
        const h = (m:number)=> (m/60).toFixed(1);
        setTxt(`${h(s.completedMin)}/${h(s.plannedMin)}h • ${s.adherencePct}%`);
      } catch { setTxt('n/a'); }
    })();
  }, []);
  return <span className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700">{txt}</span>;
}
