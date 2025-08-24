import { useEffect, useState } from 'react';
import { WeekGrid } from './pages/WeekGrid';
import { Editor } from './components/Editor';
import NudgeBadge from './components/NudgeBadge';
import DbBadge from './components/DbBadge';
import type { NbEvent } from './types';
import { getEvents, patchEventUTC, deleteEvent } from './api';
import StatsBadge from './components/StatsBadge';

type Range = { start: Date; end: Date } | null;

export default function App() {
  const [events, setEvents] = useState<NbEvent[]>([]);
  const [range, setRange] = useState<Range>(null);
  const [draft, setDraft] = useState<NbEvent | null>(null);

  function weekRangeUtc(): { start: string; end: string } {
    const nowUtcMs = Date.now();
    const nowMsk = new Date(nowUtcMs + 3 * 60 * 60 * 1000);
    const mondayIndex = (nowMsk.getUTCDay() + 6) % 7;
    const todayMskMidnight = new Date(nowMsk);
    todayMskMidnight.setUTCHours(0, 0, 0, 0);
    const mondayMskMidnightMs = todayMskMidnight.getTime() - mondayIndex * 86400000;
    const mondayUtc0 = mondayMskMidnightMs - 3 * 60 * 60 * 1000;
    const nextMondayUtc0 = mondayUtc0 + 7 * 86400000;
    return { start: new Date(mondayUtc0).toISOString(), end: new Date(nextMondayUtc0).toISOString() };
  }

  async function refresh() {
    const { start, end } = weekRangeUtc();
    const data = await getEvents(start, end);
    setEvents(data);
  }
  useEffect(() => { refresh(); }, []);

  function onCreate(slot: { startUtc: string; endUtc: string; allDay?: boolean }) {
    setRange({ start: new Date(slot.startUtc), end: new Date(slot.endUtc) });
    setDraft(null);
  }
  async function onMoveOrResize(patch: { id: string; startUtc?: string; endUtc?: string }) {
    await patchEventUTC(patch.id, { startsAt: patch.startUtc!, endsAt: patch.endUtc! });
    refresh();
  }
  function onSelect(e: NbEvent) { setDraft(e); setRange(null); }
  async function onDelete(id: string) { await deleteEvent(id); refresh(); }

  return (
    <div className="font-mono flex flex-col h-screen"> {/* monospace everywhere */}
      <header className="flex items-center justify-between p-2 border-b">
        <div className="font-semibold">NeuroBoost</div>
        <div className="flex items-center gap-2">
          <a className="underline text-xs opacity-80 hover:opacity-100" href="#/export">Export</a>
          <StatsBadge />
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
