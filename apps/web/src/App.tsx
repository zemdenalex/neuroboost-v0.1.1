import { useEffect, useState } from 'react';
import { WeekGrid } from './components/WeekGrid';
import { Editor } from './components/Editor';
import NudgeBadge from './components/NudgeBadge';
import type { NbEvent } from './types';
import DbBadge from './components/DbBadge';

type Range = { start: Date; end: Date } | null;

export default function App() {
  const [events, setEvents] = useState<NbEvent[]>([]);
  const [range, setRange] = useState<Range>(null);

  function weekRangeUtc(): { start: string; end: string } {
    // Monday 00:00 MSK -> convert to UTC; then +7 days
    const MSK = 3 * 60 * 60 * 1000;
    const nowUtcMs = Date.now();
    const nowMsk = new Date(nowUtcMs + MSK);
    const mondayIndex = (nowMsk.getUTCDay() + 6) % 7;
    const todayMskMidnight = new Date(nowMsk);
    todayMskMidnight.setUTCHours(0, 0, 0, 0);
    const mondayMskMidnightMs = todayMskMidnight.getTime() - mondayIndex * 24 * 60 * 60 * 1000;
    const mondayUtc0 = mondayMskMidnightMs - MSK;
    const nextMondayUtc0 = mondayUtc0 + 7 * 24 * 60 * 60 * 1000;
    return { start: new Date(mondayUtc0).toISOString(), end: new Date(nextMondayUtc0).toISOString() };
  }

  async function refresh() {
    const { start, end } = weekRangeUtc();
    const r = await fetch(`/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    if (!r.ok) throw new Error('Failed to load events');
    const raw = await r.json();
    // map API -> UI shape
    const mapped: NbEvent[] = raw.map((x: any) => ({
      id: x.id,
      masterId: x.masterId ?? null,
      title: x.title,
      allDay: !!x.allDay,
      rrule: x.rrule ?? null,
      startUtc: x.startsAt,   // server names -> UI names
      endUtc: x.endsAt,
    }));
    setEvents(mapped);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  function onCreate(slot: { startUtc: string; endUtc: string; allDay?: boolean }) {
    setRange({ start: new Date(slot.startUtc), end: new Date(slot.endUtc) });
  }

  async function onMoveOrResize(patch: { id: string; startUtc?: string; endUtc?: string }) {
    // map UI -> server names
    const body: any = {};
    if (patch.startUtc) body.startsAt = patch.startUtc;
    if (patch.endUtc)   body.endsAt = patch.endUtc;

    const r = await fetch(`/events/${patch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Failed to move/resize');
    await refresh();
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
        <WeekGrid events={events} onCreate={onCreate} onMoveOrResize={onMoveOrResize} onSelect={onSelect} />
      </main>

      {range && (
        <Editor
          range={range}
          onClose={() => setRange(null)}
          onCreated={() => { setRange(null); refresh().catch(console.error); }}
        />
      )}
    </div>
  );
}
