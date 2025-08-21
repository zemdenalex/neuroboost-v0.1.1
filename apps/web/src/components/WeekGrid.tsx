import React from 'react';
import type { NbEvent } from '../types';

export type WeekGridProps = {
  events: NbEvent[];
  onCreate: (slot: { startUtc: string; endUtc: string; allDay?: boolean }) => void;
  onMoveOrResize: (patch: { id: string; startUtc?: string; endUtc?: string }) => void;
  onSelect: (e: NbEvent) => void;
};

// Minimal presentational grid (no direct API calls; no imports from ../api).
// Renders a simple week-like list; click "Add" creates a 1h slot starting now (UTC).
export function WeekGrid({ events, onCreate, onMoveOrResize, onSelect }: WeekGridProps) {
  function addNow() {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    onCreate({ startUtc: start.toISOString(), endUtc: end.toISOString(), allDay: false });
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-1 border-b flex items-center gap-2">
        <button
          onClick={addNow}
          className="px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
        >
          + Quick add (1h now)
        </button>
        <span className="text-xs text-zinc-400">Drag/MR to be re-wired next commit</span>
      </div>

      <div className="flex-1 overflow-auto p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {/* Simple grouping by day (UTC) */}
        {[...Array(7)].map((_, i) => {
          const day = new Date();
          day.setUTCDate(day.getUTCDate() - day.getUTCDay() + i); // start week Sun
          day.setUTCHours(0, 0, 0, 0);
          const dayStr = day.toISOString().slice(0, 10);

          const dayEvents = events.filter(e => e.startUtc.slice(0, 10) === dayStr);

          return (
            <div key={i} className="border border-zinc-700 rounded p-2">
              <div className="text-xs mb-2 text-zinc-400">
                {day.toUTCString().slice(0, 16)}
              </div>

              <div className="flex flex-col gap-2">
                {dayEvents.length === 0 && (
                  <div className="text-xs text-zinc-500">—</div>
                )}
                {dayEvents.map(e => {
                  const t = new Date(e.startUtc).toUTCString().slice(17, 22) + '–' + new Date(e.endUtc).toUTCString().slice(17, 22);
                  return (
                    <button
                      key={(e.id ?? '') + e.startUtc}
                      onClick={() => onSelect(e)}
                      className="text-left text-xs p-2 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
                      title="Click to edit"
                    >
                      <div className="font-medium">{e.title || '(no title)'}</div>
                      <div className="text-zinc-400">{t} UTC</div>
                      {e.allDay && <div className="text-amber-400">all-day</div>}
                      {e.id && (
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-700 hover:bg-zinc-600"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              const start = new Date(e.startUtc);
                              const end = new Date(e.endUtc);
                              // Move by +15m as a demo move
                              onMoveOrResize({
                                id: e.id!,
                                startUtc: new Date(start.getTime() + 15 * 60 * 1000).toISOString(),
                                endUtc: new Date(end.getTime() + 15 * 60 * 1000).toISOString()
                              });
                            }}
                          >
                            +15m
                          </button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
