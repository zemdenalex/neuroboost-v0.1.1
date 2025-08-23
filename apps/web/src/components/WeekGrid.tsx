import React from 'react';
import type { NbEvent } from '../types';

// Moscow is UTC+03:00 year-round
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function mskDateKeyFromUtcISO(iso: string): string {
  const d = new Date(iso);
  const msk = new Date(d.getTime() + MSK_OFFSET_MS);
  return msk.toISOString().slice(0, 10); // YYYY-MM-DD (in MSK)
}
function mskTimeHHMMFromUtcISO(iso: string): string {
  const d = new Date(iso);
  const msk = new Date(d.getTime() + MSK_OFFSET_MS);
  return msk.toISOString().slice(11, 16); // HH:MM
}
function mondayUtcMidnightOfCurrentWeek(): number {
  // Take "now" in MSK
  const nowUtcMs = Date.now();
  const nowMsk = new Date(nowUtcMs + MSK_OFFSET_MS);
  // JS: Sunday=0..Saturday=6; convert to Monday=0..Sunday=6
  const mondayIndex = (nowMsk.getUTCDay() + 6) % 7;
  // Get MSK midnight today
  const todayMskMidnight = new Date(nowMsk);
  todayMskMidnight.setUTCHours(0, 0, 0, 0);
  // Back up to Monday midnight (MSK), then return as UTC ms
  const mondayMskMidnightMs = todayMskMidnight.getTime() - mondayIndex * DAY_MS;
  const mondayUtcMidnightMs = mondayMskMidnightMs - MSK_OFFSET_MS;
  return mondayUtcMidnightMs;
}

export type WeekGridProps = {
  events: NbEvent[];
  onCreate: (slot: { startUtc: string; endUtc: string; allDay?: boolean }) => void;
  onMoveOrResize: (patch: { id: string; startUtc?: string; endUtc?: string }) => void;
  onSelect: (e: NbEvent) => void;
};

export function WeekGrid({ events, onCreate, onMoveOrResize, onSelect }: WeekGridProps) {
  function addNow() {
    // Create 1h slot starting "now" (UTC); grouping/labels will render in MSK
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    onCreate({ startUtc: start.toISOString(), endUtc: end.toISOString(), allDay: false });
  }

  const mondayUtc0 = mondayUtcMidnightOfCurrentWeek();
  const days = Array.from({ length: 7 }, (_, i) => {
    const dayUtc0 = mondayUtc0 + i * DAY_MS;
    const dayMsk = new Date(dayUtc0 + MSK_OFFSET_MS);
    const key = new Date(dayUtc0 + MSK_OFFSET_MS).toISOString().slice(0, 10); // MSK YYYY-MM-DD
    return { i, dayUtc0, dayMsk, key };
  });

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
        {days.map(({ i, dayMsk, key }) => {
          const dayEvents = events.filter(e => mskDateKeyFromUtcISO(e.startUtc) === key);
          const header = dayMsk.toLocaleDateString('ru-RU', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
          });

          return (
            <div key={i} className="border border-zinc-700 rounded p-2">
              <div className="text-xs mb-2 text-zinc-400">{header}</div>
              <div className="flex flex-col gap-2">
                {dayEvents.length === 0 && <div className="text-xs text-zinc-500">—</div>}
                {dayEvents.map(e => {
                  const t = `${mskTimeHHMMFromUtcISO(e.startUtc)}–${mskTimeHHMMFromUtcISO(e.endUtc)} MSK`;
                  return (
                    <button
                      key={(e.id ?? '') + e.startUtc}
                      onClick={() => onSelect(e)}
                      className="text-left text-xs p-2 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
                      title="Click to edit"
                    >
                      <div className="font-medium">{e.title || '(no title)'}</div>
                      <div className="text-zinc-400">{t}</div>
                      {e.allDay && <div className="text-amber-400">all-day</div>}
                      {e.id && (
                        <div className="mt-1">
                          <button
                            type="button"
                            className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-700 hover:bg-zinc-600"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              const start = new Date(e.startUtc);
                              const end = new Date(e.endUtc);
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
