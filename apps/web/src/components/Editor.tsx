import React, { useEffect, useState } from 'react';
import type { NbEvent } from '../types';
import { createEventUTC } from '../api';

type Range = { start: Date; end: Date } | null;

export function Editor(props: {
  range: Range;                 // for creation
  draft?: NbEvent | null;       // for edit (optional)
  onClose: () => void;
  onCreated: () => void;
  onPatched?: () => void;
}) {
  const { range, draft, onClose, onCreated, onPatched } = props;
  const isEdit = !!draft;

  const [title, setTitle] = useState(draft?.title ?? '');
  const [weekly, setWeekly] = useState(!!(draft?.rrule && draft.rrule.includes('WEEKLY')));
  const [count, setCount] = useState(4);

  useEffect(() => { if (draft) setTitle(draft.title ?? ''); }, [draft]);
  if (!range && !draft) return null;

  const startISO = (range?.start ?? new Date(draft!.startUtc)).toISOString();
  const endISO   = (range?.end   ?? new Date(draft!.endUtc)).toISOString();

  async function submit() {
    const t = title.trim();
    if (!t) return;

    if (isEdit && draft?.id) {
      await fetch(`/events/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          rrule: weekly ? `FREQ=WEEKLY;COUNT=${count}` : null
        })
      });
      onPatched?.();
      onClose();
      return;
    }

    await createEventUTC({
      title: t,
      startsAt: startISO,
      endsAt: endISO,
      allDay: false,
      rrule: weekly ? `FREQ=WEEKLY;COUNT=${count}` : null,
      tz: 'Europe/Moscow'
    });
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-[380px] p-4 space-y-3 font-mono text-[13px] text-black">
        <div className="text-lg font-semibold">{isEdit ? 'Edit block' : 'New block'}</div>
        <input
          autoFocus
          className="w-full border rounded px-2 py-1 text-black placeholder-gray-500"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
        <div className="text-xs text-gray-600">
          {new Date(startISO).toLocaleString()} → {new Date(endISO).toLocaleString()}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={weekly} onChange={e=>setWeekly(e.target.checked)} />
          Weekly repeat
        </label>
        {weekly && (
          <label className="flex items-center gap-2 text-sm">
            Count:
            <input
              type="number"
              min={1}
              max={52}
              value={count}
              onChange={e=>setCount(parseInt(e.target.value || '1', 10))}
              className="w-16 border rounded px-1 py-0.5 text-black"
            />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={submit}>{isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
