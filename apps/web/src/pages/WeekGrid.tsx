import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { NbEvent } from '../types';

// --- Time constants (MSK UI; UTC storage) ---
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+03:00
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_PX = 48;           // 24h * 48px = 1152px tall
const MIN_SLOT_MIN = 15;      // snap to 15 minutes
const GRID_MIN_W = 1200;      // allow tighter columns on laptops

// --- Helpers ---
type EvLite = { id?: string; startUtc: string; endUtc: string };
const evKey = (e: EvLite) => `${e.id ?? ''}${e.startUtc}`;
function startMin(e: EvLite) { return minutesSinceMskMidnight(e.startUtc); }
function endMin(e: EvLite) { return Math.max(startMin(e) + MIN_SLOT_MIN, minutesSinceMskMidnight(e.endUtc)); }

function computeOverlapLayout(list: EvLite[], minutesSinceMskMidnight: (iso: string) => number) {
  type Node = { e: EvLite; s: number; en: number; dur: number; key: string };
  const nodes: Node[] = list.map(e => {
    const s = minutesSinceMskMidnight(e.startUtc);
    const en = Math.max(s + MIN_SLOT_MIN, minutesSinceMskMidnight(e.endUtc));
    return { e, s, en, dur: en - s, key: evKey(e) };
  }).sort((a,b) => a.s - b.s || a.en - b.en);

  const layout = new Map<string, { left: number; right: number; z: number }>();
  const L = 4;                 // base left padding (px)
  const R = 4;                 // base right padding (px)
  const STEP = 12;             // inset step for shorter events (px)
  const CLAMP = 4;             // max number of visible inset steps

  let cluster: Node[] = [];
  let clusterMaxEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const maxDur = Math.max(...cluster.map(x => x.dur));
    const bases = cluster.filter(x => x.dur === maxDur);
    const others = cluster.filter(x => x.dur !== maxDur)
      .sort((a,b) => a.dur - b.dur || a.s - b.s); // shortest first (draw on top)

    // Longest event(s): full width (near full column), behind others
    for (const n of bases) layout.set(n.key, { left: L, right: R, z: 10 });

    // Shorter overlaps: shift right and draw above
    let i = 0;
    for (const n of others) {
      const step = Math.min(++i, CLAMP);
      layout.set(n.key, { left: L + step * STEP, right: R, z: 20 + step });
    }

    cluster = []; clusterMaxEnd = -1;
  };

  for (const n of nodes) {
    if (!cluster.length || n.s < clusterMaxEnd) {
      cluster.push(n);
      clusterMaxEnd = Math.max(clusterMaxEnd, n.en);
    } else {
      flush();
      cluster.push(n);
      clusterMaxEnd = n.en;
    }
  }
  flush();
  return layout;
}

function mondayUtcMidnightOfCurrentWeek(): number {
  const nowUtcMs = Date.now();
  const nowMsk = new Date(nowUtcMs + MSK_OFFSET_MS);
  const mondayIndex = (nowMsk.getUTCDay() + 6) % 7; // Mon=0..Sun=6
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

const snapMin = (m: number) => Math.round(m / MIN_SLOT_MIN) * MIN_SLOT_MIN;
const minsToTop = (m: number) => (m / 60) * HOUR_PX;
const topToMins = (y: number) => (y / HOUR_PX) * 60;
const clampMins = (m: number) => Math.max(0, Math.min(1440, m));
const mskDayLabel = (d: Date) =>
  d.toLocaleDateString('ru-RU', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

// ---- Props ----
export type WeekGridProps = {
  events: NbEvent[];
  onCreate: (slot: { startUtc: string; endUtc: string; allDay?: boolean }) => void;
  onMoveOrResize: (patch: { id: string; startUtc?: string; endUtc?: string }) => void;
  onSelect: (e: NbEvent) => void;         // open editor (edit mode)
  onDelete: (id: string) => Promise<void>; // delete selected
};

// ---- Internal drag types ----
type DragCreate = { kind: 'create'; dayUtc0: number; startMin: number; curMin: number };
type DragMove = { kind: 'move'; dayUtc0: number; id: string; offsetMin: number; durMin: number };
type DragResizeStart = { kind: 'resize-start'; dayUtc0: number; id: string; otherEndMin: number; curMin: number };
type DragResizeEnd = { kind: 'resize-end'; dayUtc0: number; id: string; otherEndMin: number; curMin: number };
type DragState = null | DragCreate | DragMove | DragResizeStart | DragResizeEnd;

export function WeekGrid({ events, onCreate, onMoveOrResize, onSelect, onDelete }: WeekGridProps) {
  const mondayUtc0 = useMemo(() => mondayUtcMidnightOfCurrentWeek(), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dayUtc0 = mondayUtc0 + i * DAY_MS;
    const dayMsk = new Date(dayUtc0 + MSK_OFFSET_MS);
    const key = dayMsk.toISOString().slice(0, 10);
    return { i, dayUtc0, dayMsk, key };
  }), [mondayUtc0]);

  // Index events by MSK day
  const perDay = useMemo(() => {
    const map = new Map<number, Array<NbEvent & { top: number; height: number }>>();
    for (const d of days) map.set(d.dayUtc0, []);
    for (const e of events) {
      const startMin = minutesSinceMskMidnight(e.startUtc);
      const endMin = Math.max(startMin + MIN_SLOT_MIN, minutesSinceMskMidnight(e.endUtc));
      const top = minsToTop(startMin);
      const height = Math.max(minsToTop(endMin - startMin), minsToTop(MIN_SLOT_MIN));
      const bucketUtc0 = mskMidnightUtcMs(new Date(e.startUtc).getTime());
      if (map.has(bucketUtc0)) map.get(bucketUtc0)!.push({ ...e, top, height });
    }
    return map;
  }, [events, days]);

  // Selection + keys
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { containerRef.current?.focus(); }, []);
  function handleKeyDown(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectedId) return;
    const evt = events.find(x => x.id === selectedId);
    if (!evt) return;

    if (ev.key === 'Enter') { ev.preventDefault(); onSelect(evt); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      if (confirm('Delete selected event?')) onDelete(selectedId);
      return;
    }
    const plus = ev.key === '+' || ev.key === '=';
    const minus = ev.key === '-' || ev.key === '_';
    if (!plus && !minus) return;

    const delta = (plus ? +15 : -15) * 60000;
    ev.preventDefault();
    onMoveOrResize({
      id: selectedId,
      startUtc: new Date(new Date(evt.startUtc).getTime() + delta).toISOString(),
      endUtc:   new Date(new Date(evt.endUtc).getTime()   + delta).toISOString(),
    });
  }

  // Drag state + scroll-aware math
  const [drag, setDrag] = useState<DragState>(null);
  const dragMetaRef = useRef<{ colTop: number; scrollStart: number } | null>(null);

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!drag || !containerRef.current || !dragMetaRef.current) return;
      const { colTop, scrollStart } = dragMetaRef.current;
      const yLocal = (ev.clientY - colTop) + (containerRef.current.scrollTop - scrollStart);
      const curMin = clampMins(snapMin(topToMins(yLocal)));

      switch (drag.kind) {
        case 'create':
        case 'resize-start':
        case 'resize-end':
          setDrag({ ...drag, curMin });
          break;
        case 'move': {
          const centerSnap = Math.round(drag.durMin / 2 / MIN_SLOT_MIN) * MIN_SLOT_MIN;
          setDrag({ ...drag, offsetMin: clampMins(curMin - centerSnap) });
          break;
        }
      }
    }
    function onUp() {
      if (!drag) return;
      if (drag.kind === 'create') {
        const a = Math.min(drag.startMin, drag.curMin);
        const b = Math.max(drag.startMin, drag.curMin);
        if (b > a) onCreate({
          startUtc: new Date(drag.dayUtc0 + a * 60000).toISOString(),
          endUtc:   new Date(drag.dayUtc0 + b * 60000).toISOString(),
          allDay: false
        });
      } else if (drag.kind === 'resize-start' || drag.kind === 'resize-end') {
        const a = Math.min(drag.curMin, drag.otherEndMin);
        const b = Math.max(drag.curMin, drag.otherEndMin);
        if (b > a) onMoveOrResize({
          id: drag.id,
          startUtc: new Date(drag.dayUtc0 + a * 60000).toISOString(),
          endUtc:   new Date(drag.dayUtc0 + b * 60000).toISOString()
        });
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

  // Current time line (MSK)
  const [nowInfo, setNowInfo] = useState(() => ({
    dayUtc0: mskMidnightUtcMs(Date.now()),
    min: minutesSinceMskMidnight(new Date().toISOString()),
  }));
  useEffect(() => {
    const id = setInterval(() => {
      setNowInfo({
        dayUtc0: mskMidnightUtcMs(Date.now()),
        min: minutesSinceMskMidnight(new Date().toISOString()),
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);

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
        <span className="text-xs text-zinc-400">
          Drag: create • Drag block: move • Resize: edges • snap 15m • Keys: <span className="font-mono">+</span>/<span className="font-mono">-</span> nudge, <span className="font-mono">Enter</span> edit, <span className="font-mono">Del</span> delete
        </span>
      </div>

      <div
        className="flex-1 overflow-x-auto overflow-y-auto p-2 outline-none"
        ref={containerRef}
        tabIndex={0}
        role="application"
        onKeyDown={handleKeyDown}
      >
        {/* 7 columns with min widths; horizontal scroll appears on small screens */}
        <div
          className="grid gap-2"
          style={{
            minWidth: GRID_MIN_W,
            gridTemplateColumns: 'repeat(7, minmax(140px, 1fr))',
          }}
        >
          {days.map(({ i, dayUtc0, dayMsk }) => {
            const dayLabel = mskDayLabel(dayMsk);
            const list = perDay.get(dayUtc0) ?? [];

            const layout = computeOverlapLayout(list, minutesSinceMskMidnight);
            
            // Compute lane index per event key (0..n) using greedy scan
            const sorted = [...list].sort((a, b) =>
              new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()
              || new Date(a.endUtc).getTime() - new Date(b.endUtc).getTime()
            );
            const laneByKey = new Map<string, number>();
            const laneEnds: number[] = []; // laneEnds[i] = endMin of last event in lane i

            for (const e of sorted) {
              const s = startMin(e), en = endMin(e);
              let lane = 0;
              // find first lane that has ended
              while (lane < laneEnds.length && laneEnds[lane] > s) lane++;
              laneByKey.set(evKey(e), lane);
              laneEnds[lane] = en;
            }

            return (
              <div key={i} className="border border-zinc-700 rounded">
                {/* Column header */}
                <div className="text-xs px-2 py-1 text-zinc-400 border-b">{dayLabel}</div>

                {/* Time track */}
                <div
                  className="relative select-none nb-day-track"
                  style={{ height: HOUR_PX * 24 }}
                  onMouseDown={(ev) => {
                    const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                    dragMetaRef.current = {
                      colTop: rect.top,
                      scrollStart: containerRef.current?.scrollTop ?? 0
                    };
                    const yLocal = (ev.clientY - rect.top)
                      + ((containerRef.current?.scrollTop ?? 0) - dragMetaRef.current.scrollStart);
                    const startMin = clampMins(snapMin(topToMins(yLocal)));
                    setDrag({ kind: 'create', dayUtc0, startMin, curMin: startMin });
                  }}
                >
                  {/* hour lines */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className={`absolute left-0 right-0 border-t ${h % 3 === 0 ? 'border-zinc-700' : 'border-zinc-800'}`}
                      style={{ top: h * HOUR_PX }}
                    >
                      <div className="absolute left-6 -top-2 px-1 text-[10px] text-zinc-400 bg-zinc-900/90 select-none">
                        {h}:00
                      </div>
                    </div>
                  ))}

                  {/* current time line */}
                  {dayUtc0 === nowInfo.dayUtc0 && nowInfo.min >= 0 && nowInfo.min <= 1440 && (
                    <div className="absolute left-0 right-0 h-[2px] bg-red-500" style={{ top: minsToTop(nowInfo.min) }}>
                      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}

                  {/* events */}
                  {list.map(e => {
                    const startMin = minutesSinceMskMidnight(e.startUtc);
                    const endMin = Math.max(startMin + MIN_SLOT_MIN, minutesSinceMskMidnight(e.endUtc));
                    const top = minsToTop(startMin);
                    const height = Math.max(minsToTop(endMin - startMin), minsToTop(MIN_SLOT_MIN));
                    const durMin = endMin - startMin;
                    const selected = selectedId && e.id === selectedId;
                    const keyStr = evKey(e);
                    const lay = layout.get(keyStr) ?? { left: 4, right: 4, z: 10 };
                    
                    return (
                      <div
                        key={keyStr}
                        className={`absolute rounded border text-xs ${selected
                          ? 'border-blue-400 ring-2 ring-blue-400 bg-zinc-700/90'
                          : 'border-zinc-600 bg-zinc-800/90 hover:bg-zinc-700/90'
                        }`}
                        style={{ top, height, left: lay.left, right: lay.right, zIndex: lay.z }}
                        onClick={(ev) => { ev.stopPropagation(); if (e.id) setSelectedId(e.id); }}
                        onMouseDown={(ev) => {
                          // Use the day track rect, not the event rect (scroll-correct)
                          const track = (ev.currentTarget as HTMLElement).closest('.nb-day-track') as HTMLDivElement;
                          const rect = track.getBoundingClientRect();
                          dragMetaRef.current = {
                            colTop: rect.top,
                            scrollStart: containerRef.current?.scrollTop ?? 0
                          };

                          const evRect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                          const yInEvent = ev.clientY - evRect.top;
                          const isTopHandle = yInEvent < 6;
                          const isBottomHandle = yInEvent > evRect.height - 6;

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
                        title="Click to select • Drag to move • Resize edges • Double-click to edit • +/- nudge • Enter edit • Del delete"
                      >
                        <div className="absolute left-0 right-0 h-1 top-0 cursor-n-resize bg-transparent" />
                        <div className="absolute left-0 right-0 h-1 bottom-0 cursor-s-resize bg-transparent" />
                        <div className="px-1 py-0.5">
                          <div className="font-medium truncate">{e.title || '(no title)'}</div>
                          <div className="text-zinc-300">{fmtTime(e.startUtc)}–{fmtTime(e.endUtc)} MSK</div>
                        </div>
                      </div>
                    );
                  })}

                  {/** CREATE ghost: match target event width */}
                  {drag && drag.kind === 'create' && drag.dayUtc0 === dayUtc0 && (() => {
                    const a = Math.min(drag.startMin, drag.curMin);
                    const b = Math.max(drag.startMin, drag.curMin);
                    const top = minsToTop(a);
                    const height = Math.max(minsToTop(b - a), minsToTop(MIN_SLOT_MIN));
                    return <div className="absolute bg-emerald-500/20 pointer-events-none"
                                style={{ top, height, left: 4, right: 4 }} />;
                  })()}

                  {/** RESIZE ghost: match target event width */}
                  {drag && (drag.kind === 'resize-start' || drag.kind === 'resize-end') && drag.dayUtc0 === dayUtc0 && (() => {
                    const target = list.find(x => x.id === drag.id);
                    const lay = target ? (layout.get(evKey(target)) ?? { left: 4, right: 4, z: 99 }) : { left: 4, right: 4, z: 99 };
                    const a = Math.min(drag.curMin, drag.otherEndMin);
                    const b = Math.max(drag.curMin, drag.otherEndMin);
                    const top = minsToTop(a);
                    const height = Math.max(minsToTop(b - a), minsToTop(MIN_SLOT_MIN));
                    return <div className="absolute bg-emerald-500/20 pointer-events-none"
                                style={{ top, height, left: lay.left, right: lay.right }} />;
                  })()}

                  {/** MOVE ghost: match target event width */}
                  {drag && drag.kind === 'move' && drag.dayUtc0 === dayUtc0 && (() => {
                    const target = list.find(x => x.id === drag.id);
                    const lay = target ? (layout.get(evKey(target)) ?? { left: 4, right: 4, z: 99 }) : { left: 4, right: 4, z: 99 };
                    const top = minsToTop(clampMins(snapMin(drag.offsetMin)));
                    const height = minsToTop(drag.durMin);
                    return <div className="absolute bg-sky-500/20 pointer-events-none"
                                style={{ top, height, left: lay.left, right: lay.right }} />;
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
