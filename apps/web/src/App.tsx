import React, {useEffect, useMemo, useRef, useState} from 'react';
import { createEventUTC, fetchEvents, msToMsk, patchEventUTC, statsWeek, toUTCISOFromMsk, type EventOcc } from './api';
import WeekGrid from './components/WeekGrid';
import Editor from './components/Editor';
import NudgeBadge from './components/NudgeBadge'; // from previous step if added

// local state shaped to your types; adapt names if they differ
const [draft, setDraft] = useState(null); // { id?, startUtc, endUtc, title, allDay?, ... }
const [events, setEvents] = useState<any[]>([]); // assume you already load these

// Example handlers delegating to existing API calls:
async function handleCreate(slot) {
  // slot: { startUtc, endUtc, allDay? } – adapt to your WeekGrid contract
  setDraft({ ...slot, title: '' });
}

async function handleSubmitDraft(data) {
  // call your POST /events here; then refresh
  // await apiCreateEvent(data)
  setDraft(null);
}

function handleCancelDraft() {
  setDraft(null);
}

async function handleMoveResize(patch) {
  // patch: { id, startUtc?, endUtc? } from WeekGrid
  // await apiPatchEvent(patch.id, patch)
}

return (
  <div className="flex flex-col h-screen">
    <header className="flex items-center justify-between p-2 border-b">
      <div className="font-semibold">NeuroBoost</div>
      <NudgeBadge />
    </header>

    <main className="flex-1 overflow-hidden">
      <WeekGrid
        events={events}
        onCreate={handleCreate}
        onMoveOrResize={handleMoveResize}
        onSelect={(e) => setDraft(e)} // if you select to edit
      />
    </main>

    {draft && (
      <Editor
        draft={draft}
        onSubmit={handleSubmitDraft}
        onCancel={handleCancelDraft}
      />
    )}
  </div>
);
