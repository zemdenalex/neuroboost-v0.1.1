import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { NbEvent } from '../types';

// --- Time constants (MSK UI; UTC storage) ---
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+03:00
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_PX = 48;           // visual scale: 24h * 48px = 1152px tall
const MIN_SLOT_MIN = 15;      // snap to 15 minutes
const GRID_MIN_W = 1680;      // keep 7 columns readable on narrow screens

// --- Helpers: MSK <-> UTC conversions & week building ---
function mondayUtcMidnightOfCurrentWeek(): number {
  const nowUtcMs = Date.now();
  const nowMsk = new Date(nowUtcMs + MSK_OFFSET_MS);
  const mondayIndex = (nowMsk.getUTCDay() + 6) % 7; // Monday=0..Sunday=6
  const todayMskMidnight = new Date(nowMsk);
  todayMskMidnight.setUTCHours(0, 0, 0, 0);
  const mondayMskMidnightMs = todayMskMidnight.getTime() - mondayIndex * DAY_MS;
  return mondayMskMidnightMs - MSK_OFFSET_MS; // back to UTC midnight
}
function mskMidnightUtcMs(utcMs: number): number {
  const msk = new Date(utcMs + MSK_OFFSET_MS);
  msk.setUTCHours(0, 0, 0, 0);
  return msk.getTime() - MSK_OFFSET_MS;
}
function minutesSinceMskMidnight(utcISO: string): number {
  const utcMs = new Date(utcISO).getTime();
  const baseUtc = mskMidnightUtcMs(utcMs);
  return Math.max(0, Math.min(1440, Math.round((utcMs - baseUtc) / 60000)));
}
function snapMin(mins: number): number {
  return Math.round(mins / MIN_SLOT_MIN) * MIN_SLOT_MIN;
}
function minsToTop(mins: number): number {
  return (mins / 60) * HOUR_PX;
}
function topToMins(topPx: number): number {
  return (topPx / HOUR_PX) * 60;
}
function clampMins(m: number): number {
  return Math.max(0, Math.min(1440, m));
}
function mskDayLabel(mskDate: Date): string {
  return mskDate.toLocaleDateString('ru-RU', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

export type WeekGridProps = {
  events: NbEvent[];
  onCreate: (slot: { startUtc: string; endUtc: string; allDay?: boolean }) => void;
  onMoveOrResize: (patch: { id: string; startUtc?: string; endUtc?: string }) => void;
  onSelect: (e: NbEvent) => void;
};

type DragCreate = { kind: 'create'; dayUtc0: number; startMin: number; curMin: number };
type DragMove = { kind: 'move'; dayUtc0: number; id: string; offsetMin: number; durMin: number };
type DragResizeStart = { kind: 'resize-start'; dayUtc0: number; id: string; otherEndMin: number; curMin: number };
type DragResizeEnd = { kind: 'resize-end'; dayUtc0: number; id: string; otherEndMin: number; curMin: number };
type DragState = null | DragCreate | DragMove | DragResizeStart | DragResizeEnd;

export function WeekGrid({ events, onCreate, onMoveOrResize, onSelect }: WeekGridProps) {
  const mondayUtc0 = useMemo(() => mondayUtcMidnightOfCurrentWeek(), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dayUtc0 = mondayUtc0 + i * DAY_MS;
    const dayMsk = new Date(dayUtc0 + MSK_OFFSET_MS);
    const key = dayMsk.toISOString().slice(0, 10);
    return { i, dayUtc0, dayMsk, key };
  }), [mondayUtc0]);

  // Index events per MSK day, and compute absolute positions
  const perDay = useMemo(() => {
    const map = new Map<number, Array<NbEvent & { top: number; height: number }>>();
    for (const d of days) map.set(d.dayUtc0, []);
    for (const e of events) {
      const startMin = minutesSinceMskMidnight(e.startUtc);
      const endMin = Math.max(startMin + MIN_SLOT_MIN, minutesSinceMskMidnight(e.endUtc));
      const top = minsToTop(startMin);
      const height = Math.max(minsToTop(endMin - startMin), minsToTop(MIN_SLOT_MIN));
      const startUtcMs = new Date(e.startUtc).getTime();
      const bucketUtc0 = mskMidnightUtcMs(startUtcMs);
      if (map.has(bucketUtc0)) map.get(bucketUtc0)!.push({ ...e, top, height });
    }
    return map;
  }, [events, days]);

  // --- Drag state + handlers ---
  const [drag, setDrag] = useState<DragState>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!drag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = ev.clientY - rect.top - 32; // header offset
      const curMin = clampMins(snapMin(topToMins(y)));

      switch (drag.kind) {
        case 'create':
          setDrag({ ...drag, curMin });
          break;
        case 'resize-start':
        case 'resize-end':
          setDrag({ ...drag, curMin });
          break;
        case 'move':
          setDrag({ ...drag, offsetMin: clampMins(curMin - Math.round(drag.durMin / 2 / MIN_SLOT_MIN) * MIN_SLOT_MIN) });
          break;
      }
    }
    function onUp() {
      if (!drag) return;
      if (drag.kind === 'create') {
        const a = Math.min(drag.startMin, drag.curMin);
        const b = Math.max(drag.startMin, drag.curMin);
        if (b > a) {
          const startUtc = new Date(drag.dayUtc0 + a * 60000).toISOString();
          const endUtc = new Date(drag.dayUtc0 + b * 60000).toISOString();
          onCreate({ startUtc, endUtc, allDay: false });
        }
      } else if (drag.kind === 'resize-start') {
        const a = Math.min(drag.curMin, drag.otherEndMin);
        const b = Math.max(drag.curMin, drag.otherEndMin);
        if (b > a) {
          onMoveOrResize({
            id: drag.id,
            startUtc: new Date(drag.dayUtc0 + a * 60000).toISOString(),
            endUtc:   new Date(drag.dayUtc0 + b * 60000).toISOString()
          });
        }
      } else if (drag.kind === 'resize-end') {
        const a = Math.min(drag.curMin, drag.otherEndMin);
        const b = Math.max(drag.curMin, drag.otherEndMin);
        if (b > a) {
          onMoveOrResize({
            id: drag.id,
            startUtc: new Date(drag.dayUtc0 + a * 60000).toISOString(),
            endUtc:   new Date(drag.dayUtc0 + b * 60000).toISOString()
          });
        }
      } else if (drag.kind === 'move') {
        const startMin = snapMin(drag.offsetMin);
        const endMin = startMin + drag.durMin;
        onMoveOrResize({
          id: drag.id,
          startUtc: new Date(drag.dayUtc0 + startMin * 60000).toISOString(),
          endUtc:   new Date(drag.dayUtc0 + endMin   * 60000).toISOString()
        });
      }
      setDrag(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, onCreate, onMoveOrResize]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-1 border-b flex items-center gap-2">
        <button
          onClick={() => {
            const start = new Date(); const end = new Date(start.getTime() + 60 * 60 * 1000);
            onCreate({ startUtc: start.toISOString(), endUtc: end.toISOString(), allDay: false });
          }}
          className="px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
        >
          + Quick add (1h now)
        </button>
        <span className="text-xs text-zinc-400">Drag: create • Drag block: move • Resize: handles • snap 15m • MSK</span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto p-2" ref={containerRef}>
        {/* One row, 7 columns; each column is a 24h track */}
        <div className="grid grid-cols-7 gap-2" style={{ minWidth: GRID_MIN_W }}>
          {days.map(({ i, dayUtc0, dayMsk }) => {
            const dayLabel = mskDayLabel(dayMsk);
            const list = perDay.get(dayUtc0) ?? [];

            return (
              <div key={i} className="border border-zinc-700 rounded">
                {/* Column header */}
                <div className="text-xs px-2 py-1 text-zinc-400 border-b">{dayLabel}</div>

                {/* Time track */}
                <div
                  className="relative select-none"
                  style={{ height: HOUR_PX * 24 }}
                  onMouseDown={(ev) => {
                    const colRect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const y = ev.clientY - colRect.top;
                    const startMin = clampMins(snapMin(topToMins(y)));
                    setDrag({ kind: 'create', dayUtc0, startMin, curMin: startMin });
                  }}
                >
                  {/* hour lines */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h}
                      className={`absolute left-6 right-0 border-t ${h % 3 === 0 ? 'border-zinc-700' : 'border-zinc-800'}`}
                      style={{ top: h * HOUR_PX }}
                    >
                      <div className="absolute -left-5 -top-2 text-[10px] text-zinc-500 select-none">{h}:00</div>
                    </div>
                  ))}

                  {/* existing events (within this day) */}
                  {list.map(e => {
                    const startMin = minutesSinceMskMidnight(e.startUtc);
                    const endMin = Math.max(startMin + MIN_SLOT_MIN, minutesSinceMskMidnight(e.endUtc));
                    const top = minsToTop(startMin);
                    const height = Math.max(minsToTop(endMin - startMin), minsToTop(MIN_SLOT_MIN));
                    const durMin = endMin - startMin;
                    return (
                      <div
                        key={(e.id ?? '') + e.startUtc}
                        className="absolute left-1 right-1 rounded border border-zinc-600 bg-zinc-800/90 hover:bg-zinc-700/90 text-xs"
                        style={{ top, height }}
                        onMouseDown={(ev) => {
                          const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                          const y = ev.clientY - rect.top;
                          const isTopHandle = y < 6;
                          const isBottomHandle = y > rect.height - 6;
                          if (e.id) {
                            if (isTopHandle) {
                              setDrag({ kind: 'resize-start', dayUtc0, id: e.id, otherEndMin: endMin, curMin: startMin });
                            } else if (isBottomHandle) {
                              setDrag({ kind: 'resize-end', dayUtc0, id: e.id, otherEndMin: startMin, curMin: endMin });
                            } else {
                              setDrag({ kind: 'move', dayUtc0, id: e.id, offsetMin: startMin, durMin });
                            }
                            ev.stopPropagation();
                          }
                        }}
                        onDoubleClick={() => onSelect(e)}
                        title="Drag to move; resize handles; double-click to edit"
                      >
                        {/* resize handles */}
                        <div className="absolute left-0 right-0 h-1 top-0 cursor-n-resize bg-transparent" />
                        <div className="absolute left-0 right-0 h-1 bottom-0 cursor-s-resize bg-transparent" />
                        {/* label */}
                        <div className="px-1 py-0.5">
                          <div className="font-medium truncate">{e.title || '(no title)'}</div>
                          <div className="text-zinc-300">
                            {fmtTime(e.startUtc)}–{fmtTime(e.endUtc)} MSK
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* create / resize draft overlay */}
                  {drag && (drag.kind === 'create' || drag.kind === 'resize-start' || drag.kind === 'resize-end') && (() => {
                    const a = drag.kind === 'create'
                      ? Math.min(drag.startMin, drag.curMin)
                      : Math.min(drag.curMin, drag.otherEndMin);
                    const b = drag.kind === 'create'
                      ? Math.max(drag.startMin, drag.curMin)
                      : Math.max(drag.curMin, drag.otherEndMin);
                    const top = minsToTop(a);
                    const height = Math.max(minsToTop(b - a), minsToTop(MIN_SLOT_MIN));
                    return (
                      <div
                        className="absolute left-1 right-1 rounded border border-emerald-500/70 bg-emerald-500/20 pointer-events-none"
                        style={{ top, height }}
                      />
                    );
                  })()}

                  {/* move draft overlay */}
                  {drag && drag.kind === 'move' && (() => {
                    const top = minsToTop(clampMins(snapMin(drag.offsetMin)));
                    const height = minsToTop(drag.durMin);
                    return (
                      <div
                        className="absolute left-1 right-1 rounded border border-sky-500/70 bg-sky-500/20 pointer-events-none"
                        style={{ top, height }}
                      />
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- UI formatting ---
function fmtTime(utcISO: string): string {
  const d = new Date(new Date(utcISO).getTime() + MSK_OFFSET_MS);
  return d.toISOString().slice(11, 16); // HH:MM
}
