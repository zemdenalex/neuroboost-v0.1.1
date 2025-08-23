import React, { useState } from 'react';
import { createEventUTC } from '../api';

export function Editor(props: {
  range: { start: Date; end: Date } | null;
  onClose: () => void;
  onCreated: () => void;
}) {
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
      tz: 'Europe/Moscow',
    };
    await createEventUTC(body);
    onCreated();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[420px] rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl p-4 space-y-3 font-mono">
        <div className="text-lg font-semibold">New block</div>

        <input
          autoFocus
          className="w-full rounded border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-500 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="text-xs text-zinc-600">
          {range.start.toLocaleString()} → {range.end.toLocaleString()}
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={weekly}
            onChange={(e) => setWeekly(e.target.checked)}
          />
          Weekly repeat
        </label>

        {weekly && (
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            Count:
            <input
              type="number"
              min={1}
              max={52}
              value={Number.isFinite(count) ? count : 1}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(52, parseInt(e.target.value || '1', 10))))
              }
              className="w-20 rounded border border-zinc-300 bg-white text-zinc-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            className="px-3 py-1 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            disabled={!title.trim()}
            onClick={submit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
