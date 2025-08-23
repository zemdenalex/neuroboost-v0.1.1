import { useEffect, useState } from 'react';
import { WeekGrid } from './components/WeekGrid';
import { Editor } from './components/Editor';   // named export
import NudgeBadge from './components/NudgeBadge';
import type { NbEvent } from './types';
import DbBadge from './components/DbBadge';

type Range = { start: Date; end: Date } | null;

export default function App() {
  const [events, setEvents] = useState<NbEvent[]>([]);
  const [range, setRange] = useState<Range>(null);

  function weekRangeUtc(): { from: string; to: string } {
  // Monday 00:00 MSK -> convert to UTC; then +7 days
  const nowUtcMs = Date.now();
  const nowMsk = new Date(nowUtcMs + 3 * 60 * 60 * 1000);
  const mondayIndex = (nowMsk.getUTCDay() + 6) % 7;
  const todayMskMidnight = new Date(nowMsk);
  todayMskMidnight.setUTCHours(0, 0, 0, 0);
  const mondayMskMidnightMs = todayMskMidnight.getTime() - mondayIndex * 24 * 60 * 60 * 1000;
  const mondayUtc0 = mondayMskMidnightMs - 3 * 60 * 60 * 1000;
  const nextMondayUtc0 = mondayUtc0 + 7 * 24 * 60 * 60 * 1000;
  return { from: new Date(mondayUtc0).toISOString(), to: new Date(nextMondayUtc0).toISOString() };
}

async function refresh() {
  const { from, to } = weekRangeUtc();
  const r = await fetch(`/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!r.ok) throw new Error('Failed to load events');
  setEvents(await r.json());
}


  function onCreate(slot: { startUtc: string; endUtc: string; allDay?: boolean }) {
    setRange({ start: new Date(slot.startUtc), end: new Date(slot.endUtc) });
  }
  async function onMoveOrResize(patch: { id: string; startUtc?: string; endUtc?: string }) {
    const r = await fetch(`/events/${patch.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error('Failed to move/resize');
    refresh();
  }
  function onSelect(e: NbEvent) {
    setRange({ start: new Date(e.startUtc), end: new Date(e.endUtc) });
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-2 border-b">
        <div className="font-semibold">NeuroBoost</div>
        <div className="flex items-center gap-2">
          <DbBadge />
          <NudgeBadge />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <WeekGrid
          events={events}
          onCreate={onCreate}
          onMoveOrResize={onMoveOrResize}
          onSelect={onSelect}
        />
      </main>

      {range && (
        <Editor
          range={range}
          onClose={() => setRange(null)}
          onCreated={() => { setRange(null); refresh(); }}
        />
      )}
    </div>
  );
}
