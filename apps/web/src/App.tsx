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

  async function refresh() {
    const r = await fetch('/events');
    if (!r.ok) throw new Error('Failed to load events');
    setEvents(await r.json());
  }
  useEffect(() => { refresh(); }, []);

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
