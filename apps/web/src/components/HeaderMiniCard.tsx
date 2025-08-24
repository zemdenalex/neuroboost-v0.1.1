import { useEffect, useState } from "react";
import { API_BASE } from "../api";

type WeekStats = { plannedMin: number; completedMin: number; adherencePct: number };
export default function HeaderMiniCard() {
  const [s, setS] = useState<WeekStats | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/stats/week?start=` + new Date().toISOString().slice(0,10))
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => setS(j))
      .catch(() => setS(null));
  }, []);
  const planned = s?.plannedMin ?? 0, actual = s?.completedMin ?? 0;
  const adh = s?.adherencePct ?? (planned ? Math.round((actual/planned)*100) : 0);
  return (
    <div className="text-xs px-2 py-1 bg-zinc-900 border border-zinc-800 rounded">
      <span>Planned: {Math.round(planned/60)}h</span>{" · "}
      <span>Actual: {Math.round(actual/60)}h</span>{" · "}
      <span>Adherence: {adh}%</span>
    </div>
  );
}
