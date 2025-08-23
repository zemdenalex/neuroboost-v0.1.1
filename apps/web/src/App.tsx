import { useEffect, useState } from 'react';
import { WeekGrid } from './components/WeekGrid';
import { Editor } from './components/Editor';
import NudgeBadge from './components/NudgeBadge';
import DbBadge from './components/DbBadge';
import type { NbEvent } from './types';

type Range = { start: Date; end: Date } | null;

export default function App() {
  const [events, setEvents] = useState<NbEvent[]>([]);
  const [range, setRange] = useState<Range>(null);        // for creation
  const [draft, setDraft] = useState<NbEvent | null>(null); // for edit

  function weekRangeUtc(): { start: string; end: string } {
    const nowUtcMs = Date.now();
    const nowMsk = new Date(nowUtcMs + 3 * 60 * 60 * 1000);
    const mondayIndex = (nowMsk.getUTCDay() + 6) % 7;
    const todayMskMidnight = new Date(nowMsk);
    todayMskMidnight.setUTCHours(0, 0, 0, 0);
    const mondayMskMidnightMs = todayMskMidnight.getTime() - mondayIndex * 24 * 60 * 60 * 1000;
    const mondayUtc0 = mondayMskMidnightMs - 3 * 60 * 60 * 1000;
    const nextMondayUtc0 = mondayUtc0 + 7 * 24 * 60 * 60 * 1000;
    return { start: new Date(mondayUtc0).toISOString(), end: new Date(nextMondayUtc0).toISOString() };
  }

  async function refresh() {
  const { start, end } = weekRangeUtc();
  const r = await fetch(`/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  if (!r.ok) throw new Error('Failed to load events');
  const raw = await r.json();
  // map API (startsAt/endsAt) → UI (startUtc/endUtc)
  const mapped = raw.map((o: any) => ({
    id: o.id,
    title: o.title,
    startUtc: o.startsAt,
    endUtc: o.endsAt,
    allDay: !!o.allDay,
    masterId: o.masterId ?? null,
    rrule: o.rrule ?? null,
  }));
  setEvents(mapped);
  } 

  function onCreate(slot: { startUtc: string; endUtc: string; allDay?: boolean }) {
    setRange({ start: new Date(slot.startUtc), end: new Date(slot.endUtc) });
    setDraft(null);
  }
  async function onMoveOrResize(patch: { id: string; startUtc?: string; endUtc?: string }) {
    const r = await fetch(`/events/${patch.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startsAt: patch.startUtc, endsAt: patch.endUtc }),
    });
    if (!r.ok) throw new Error('Failed to move/resize');
    refresh();
  }
  function onSelect(e: NbEvent) {
    setDraft(e);          // edit
    setRange(null);
  }
  async function onDelete(id: string) {
    const r = await fetch(`/events/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Failed to delete');
    refresh();
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
          onDelete={onDelete}
        />
      </main>

      {(range || draft) && (
        <Editor
          range={range}
          draft={draft}
          onClose={() => { setRange(null); setDraft(null); }}
          onCreated={() => { setRange(null); refresh(); }}
          onPatched={() => { setDraft(null); refresh(); }}
        />
      )}
    </div>
  );
}
