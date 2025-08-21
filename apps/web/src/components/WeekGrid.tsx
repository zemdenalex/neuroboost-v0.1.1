import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, minutesBetween, startOfWeek, toISO, expandWeekly } from '../lib/time';
import { EventDTO, getEvents, patchEvent, skipOccurrence } from '../api';

type Occ = { id: string; start: Date; end: Date; baseId?: string; isRecurrence?: boolean };

export default function WeekGrid() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [drag, setDrag] = useState<{ dayIndex: number; startY: number; endY: number } | null>(null);
  const [editorRange, setEditorRange] = useState<{ start: Date; end: Date } | null>(null);
  const hourH = 48; // CSS var mirrors this

  const days = [...Array(7)].map((_,i)=>addDays(weekStart, i));
  const rangeStart = days[0];
  const rangeEnd = addDays(weekStart, 7);

  async function refresh() {
    const evs = await getEvents(toISO(rangeStart), toISO(rangeEnd));
    setEvents(evs);
  }
  useEffect(()=>{ refresh(); }, [weekStart]);

  // Build occurrences for render
  const occs: Occ[] = useMemo(() => {
    const out: Occ[] = [];
    for (const ev of events) {
      // base event itself
      out.push({ id: ev.id, start: new Date(ev.startsAt), end: new Date(ev.endsAt) });
      // weekly expansions
      for (const k of expandWeekly(ev, rangeStart, rangeEnd)) {
        out.push({ id: `${ev.id}:${k.start.toISOString()}`, start: k.start, end: k.end, baseId: ev.id, isRecurrence: true });
      }
    }
    // keep only occurrences in range
    return out.filter(o => o.start < rangeEnd && o.end > rangeStart);
  }, [events, rangeStart, rangeEnd]);

  // Mouse interactions (drag-create)
  const colRefs = useRef<HTMLDivElement[]>([]);
  useEffect(()=>{ colRefs.current = colRefs.current.slice(0,7); }, []);
  function onMouseDown(e: React.MouseEvent, dayIndex: number) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setDrag({ dayIndex, startY: e.clientY - rect.top, endY: e.clientY - rect.top });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const rect = colRefs.current[drag.dayIndex].getBoundingClientRect();
    setDrag({ ...drag, endY: Math.min(Math.max(e.clientY - rect.top, 0), rect.height) });
  }
  function onMouseUp() {
    if (!drag) return setDrag(null);
    const day = days[drag.dayIndex];
    const y1 = Math.min(drag.startY, drag.endY);
    const y2 = Math.max(drag.startY, drag.endY);
    const minutesPerPx = 60 / hourH;
    const start = new Date(day); start.setHours(0,0,0,0); start.setMinutes(start.getMinutes() + Math.round(y1 * minutesPerPx));
    const end   = new Date(day); end.setHours(0,0,0,0);   end.setMinutes(end.getMinutes() + Math.max(15, Math.round(y2 * minutesPerPx)));
    setDrag(null);
    setEditorRange({ start, end });
  }

  // Move/resize for base events (not recurrences)
  async function onDragEvent(id: string, deltaMin: number) {
    const ev = events.find(e => e.id === id); if (!ev) return;
    const s = new Date(ev.startsAt); s.setMinutes(s.getMinutes() + deltaMin);
    const e = new Date(ev.endsAt);   e.setMinutes(e.getMinutes() + deltaMin);
    await patchEvent(id, { startsAt: s.toISOString(), endsAt: e.toISOString() });
    await refresh();
  }
  async function onResizeEvent(id: string, deltaMin: number) {
    const ev = events.find(e => e.id === id); if (!ev) return;
    const e = new Date(ev.endsAt); e.setMinutes(e.getMinutes() + deltaMin);
    await patchEvent(id, { endsAt: e.toISOString() });
    await refresh();
  }

  // Skip one recurrence occurrence
  async function onSkipOccurrence(baseId: string, occStart: Date) {
    await skipOccurrence(baseId, occStart.toISOString());
    await refresh();
  }

  // Plan vs actual (actual=0 for now)
  const plannedMin = useMemo(() => occs.reduce((sum,o)=> sum + minutesBetween(o.start, o.end), 0), [occs]);

  // Mock nudge: show toast for T-5 and T-1 for next upcoming occurrence today
  const [toast, setToast] = useState<string | null>(null);
  function scheduleMockNudges() {
    const now = new Date();
    const upcoming = occs
      .filter(o => o.start > now)
      .sort((a,b)=>+a.start-+b.start)[0];
    if (!upcoming) return setToast('No upcoming blocks today.');
    const diff5 = (+upcoming.start - +now) - 5*60*1000;
    const diff1 = (+upcoming.start - +now) - 1*60*1000;
    window.setTimeout(()=>setToast(`Nudge: "${formatTime(upcoming.start)}" starts in 5 min`), Math.max(0, diff5));
    window.setTimeout(()=>setToast(`Nudge: "${formatTime(upcoming.start)}" starts in 1 min`), Math.max(0, diff1));
    setToast('Scheduled mock nudges for next block.');
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xl font-semibold">Week of {days[0].toLocaleDateString()}</div>
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded border" onClick={()=>setWeekStart(addDays(weekStart, -7))}>← Prev</button>
          <button className="px-2 py-1 rounded border" onClick={()=>setWeekStart(startOfWeek(new Date()))}>Today</button>
          <button className="px-2 py-1 rounded border" onClick={()=>setWeekStart(addDays(weekStart, 7))}>Next →</button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-2">
        <div />
        {days.map((d,i)=><div key={i} className="text-sm font-medium">{d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'})}</div>)}
        {/* Hours column */}
        <div className="flex flex-col">
          {[...Array(24)].map((_,h)=><div key={h} className="h-[var(--hour-h)] text-xs text-gray-500">{String(h).padStart(2,'0')}:00</div>)}
        </div>
        {/* Day columns */}
        {days.map((d,dayIdx)=>(
          <div
            key={dayIdx}
            ref={el => { if (el) (colRefs.current[dayIdx] = el); }}
            onMouseDown={(e)=>onMouseDown(e, dayIdx)}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            className="relative bg-white rounded-lg border overflow-hidden cursor-crosshair"
            style={{ userSelect: 'none' }}
          >
            {/* grid lines */}
            {[...Array(24)].map((_,h)=><div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `calc(${h} * var(--hour-h))` }}/>)}
            {/* drag ghost */}
            {drag && drag.dayIndex===dayIdx && (
              <div className="absolute left-0 right-0 bg-blue-500/30 border border-blue-500 rounded"
                   style={{ top: Math.min(drag.startY, drag.endY), height: Math.max(6, Math.abs(drag.endY-drag.startY)) }} />
            )}
            {/* events */}
            {occs.filter(o => sameDay(o.start,d)).map((o,i)=>{
              const top = (o.start.getHours()*60 + o.start.getMinutes()) * (hourH/60);
              const h = Math.max(6, minutesBetween(o.start,o.end) * (hourH/60));
              const isRec = !!o.isRecurrence;
              return (
                <div key={i}
                  className={`absolute left-1 right-1 rounded px-2 py-1 text-xs text-white ${isRec?'bg-purple-600':'bg-blue-600'}`}
                  style={{ top, height: h }}
                  onDoubleClick={()=>{ if (isRec && o.baseId) onSkipOccurrence(o.baseId, o.start); }}
                >
                  <div className="flex justify-between">
                    <div>{formatTime(o.start)}–{formatTime(o.end)}</div>
                    {isRec && o.baseId && <button title="Skip this occurrence" className="underline" onClick={()=>onSkipOccurrence(o.baseId!, o.start)}>skip</button>}
                  </div>
                  {!isRec && (
                    <div className="mt-1 flex gap-1">
                      <button className="px-1 bg-white/20 rounded" onClick={()=>onDragEvent(o.id, -15)}>-15m</button>
                      <button className="px-1 bg-white/20 rounded" onClick={()=>onDragEvent(o.id, +15)}>+15m</button>
                      <button className="px-1 bg-white/20 rounded" onClick={()=>onResizeEvent(o.id, +15)}>longer +15m</button>
                      <button className="px-1 bg-white/20 rounded" onClick={()=>onResizeEvent(o.id, -15)}>shorter -15m</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="text-sm">Planned this week: <span className="font-semibold">{Math.round(plannedMin/60)} h {plannedMin%60} m</span></div>
        <button className="px-2 py-1 rounded border" onClick={scheduleMockNudges}>Mock nudges</button>
        {toast && <span className="text-xs bg-yellow-100 border border-yellow-300 px-2 py-1 rounded">{toast}</span>}
      </div>

      {editorRange && <EditorWrapper range={editorRange} onClose={()=>setEditorRange(null)} onCreated={refresh} />}
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function EditorWrapper({ range, onClose, onCreated }: { range: { start: Date; end: Date }, onClose: ()=>void, onCreated: ()=>void }) {
  const Editor = require('./Editor').Editor;
  return <Editor range={range} onClose={onClose} onCreated={onCreated} />;
}
