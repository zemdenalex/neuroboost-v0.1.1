import React, { useState } from 'react';
import { createEventUTC } from '../api';

export function Editor(props: { range: { start: Date; end: Date } | null; onClose: () => void; onCreated: () => void }) {
  const { range, onClose, onCreated } = props;
  const [title, setTitle] = useState('');
  const [weekly, setWeekly] = useState(false);
  const [count, setCount] = useState(4);

  if (!range) return null;

  const submit = async () => {
    if (!title.trim()) return;
    const body = {
      title: title.trim(),
      startsAt: range.start.toISOString(),
      endsAt: range.end.toISOString(),
      allDay: false,
      rrule: weekly ? `FREQ=WEEKLY;COUNT=${count}` : null,
      tz: 'Europe/Moscow'
    };
    await createEventUTC(body);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-[380px] p-4 space-y-3">
        <div className="text-lg font-semibold">New block</div>
        <input
          autoFocus
          className="w-full border rounded px-2 py-1"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <div className="text-xs text-gray-600">
          {range.start.toLocaleString()} → {range.end.toLocaleString()}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={weekly} onChange={e=>setWeekly(e.target.checked)} />
          Weekly repeat
        </label>
        {weekly && (
          <label className="flex items-center gap-2 text-sm">
            Count:
            <input type="number" min={1} max={52} value={count} onChange={e=>setCount(parseInt(e.target.value||'1',10))} className="w-16 border rounded px-1 py-0.5"/>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
