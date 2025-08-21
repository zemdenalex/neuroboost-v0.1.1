import { useEffect, useState } from 'react';
import WeekGrid from './components/WeekGrid';
import Editor from './components/Editor';
import NudgeBadge from './components/NudgeBadge';

export default function App() {
  const [events, setEvents] = useState<any[]>([]);
  const [draft, setDraft] = useState<any | null>(null);

  async function refresh() {
    const r = await fetch('/events'); // matches your existing API
    setEvents(await r.json());
  }
  useEffect(() => { refresh(); }, []);

  // WeekGrid contracts — adjust names to your actual props if they differ:
  function onCreate(slot: any) { setDraft({ ...slot, title: '' }); }
  async function onMoveOrResize(patch: { id: string, startUtc?: string, endUtc?: string }) {
    await fetch(`/events/${patch.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    refresh();
  }
  function onSelect(e: any) { setDraft(e); }

  async function onSubmitDraft(data: any) {
    await fetch('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setDraft(null); refresh();
  }
  function onCancelDraft() { setDraft(null); }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-2 border-b">
        <div className="font-semibold">NeuroBoost</div>
        <NudgeBadge />
      </header>

      <main className="flex-1 overflow-hidden">
        <WeekGrid
          events={events}
          onCreate={onCreate}
          onMoveOrResize={onMoveOrResize}
          onSelect={onSelect}
        />
      </main>

      {draft && (
        <Editor draft={draft} onSubmit={onSubmitDraft} onCancel={onCancelDraft} />
      )}
    </div>
  );
}
