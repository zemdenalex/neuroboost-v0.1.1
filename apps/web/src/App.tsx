import React, {useEffect, useMemo, useRef, useState} from 'react';
import { createEventUTC, fetchEvents, msToMsk, patchEventUTC, statsWeek, toUTCISOFromMsk, type EventOcc } from './api';

const H_START = 6, H_END = 22, STEP_MIN = 15;

function weekRangeUTC(now = new Date()) {
  // Monday-based week in Moscow; compute UTC bounds
  const mskNow = new Date(msToMsk(now));
  const day = mskNow.getUTCDay() || 7; // 1..7
  const monday = new Date(Date.UTC(mskNow.getUTCFullYear(), mskNow.getUTCMonth(), mskNow.getUTCDate() - (day-1)));
  const sunday = new Date(monday.getTime() + 7*86400000);
  return { startUTC: monday.toISOString(), endUTC: sunday.toISOString(), monday };
}

type DragState = null | { dayIdx:number; startY:number; startMin:number; endMin:number };

export default function App() {
  const [events, setEvents] = useState<EventOcc[]>([]);
  const [range, setRange] = useState(() => weekRangeUTC());
  const [selected, setSelected] = useState<EventOcc | null>(null);
  const [stats, setStats] = useState<{plannedMin:number;completedMin:number;adherencePct:number} | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = async () => {
    const data = await fetchEvents(range.startUTC, range.endUTC);
    setEvents(data);
  };

  useEffect(() => { reload(); }, [range.startUTC]);

  // Mock nudges: if any event starts within 5m (Moscow local), show toast
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const soon = events.find(e => {
        const startLocal = new Date(e.startsAt); // UTC
        const diffMin = Math.floor((startLocal.getTime() - now.getTime()) / 60000);
        return diffMin >= 0 && diffMin <= 5;
      });
      if (soon) setToast(`Upcoming: ${soon.title} in ≤5m`);
      else setToast(null);
    }, 30_000);
    return () => clearInterval(id);
  }, [events]);

  // Grid math
  const hours = useMemo(() => Array.from({length:(H_END-H_START+1)},(_,i)=>H_START+i), []);
  const days = useMemo(() => Array.from({length:7},(_,i)=>i), []);
  const gridRef = useRef<HTMLDivElement|null>(null);
  const [drag, setDrag] = useState<DragState>(null);

  function snapMin(m:number){ return Math.round(m/STEP_MIN)*STEP_MIN; }

  function coordToDayMin(ev: React.MouseEvent, dayIdx:number){
    const rect = gridRef.current!.getBoundingClientRect();
    const y = ev.clientY - rect.top - 32; // header height
    const totalMin = (H_END - H_START) * 60;
    const clamped = Math.max(0, Math.min(y, rect.height - 32)); // avoid overflow
    const minute = Math.floor(clamped / (rect.height - 32) * totalMin);
    return snapMin(minute);
  }

  function onMouseDownCell(ev: React.MouseEvent, dayIdx:number){
    const m = coordToDayMin(ev, dayIdx);
    setDrag({ dayIdx, startY: ev.clientY, startMin: m, endMin: m + STEP_MIN });
  }
  function onMouseMove(ev: React.MouseEvent){
    if (!drag) return;
    const m = coordToDayMin(ev, drag.dayIdx);
    setDrag({...drag, endMin: Math.max(m, drag.startMin + STEP_MIN)});
  }
  async function onMouseUp(){
    if (!drag) return;
    const { dayIdx, startMin, endMin } = drag;
    setDrag(null);
    const title = window.prompt('Title?');
    if (!title) return;

    // Build Moscow local time from Monday + dayIdx
    const monday = new Date(range.startUTC); // Monday 00:00 UTC
    const mskYear = monday.getUTCFullYear();
    const mskMonth = monday.getUTCMonth();
    const mskDay = monday.getUTCDate() + dayIdx;
    const sH = Math.floor(startMin/60) + H_START, sM = startMin % 60;
    const eH = Math.floor(endMin/60) + H_START, eM = endMin % 60;

    const startsAtUTC = toUTCISOFromMsk(mskYear, mskMonth, mskDay, sH, sM);
    const endsAtUTC   = toUTCISOFromMsk(mskYear, mskMonth, mskDay, eH, eM);
    await createEventUTC({ title, startsAt: startsAtUTC, endsAt: endsAtUTC, allDay: false, rrule: null });
    await reload();
  }

  function minutesBetweenUTC(a:string,b:string){ return Math.floor((new Date(b).getTime()-new Date(a).getTime())/60000); }

  async function moveSelected(deltaMin:number){
    if(!selected) return;
    const s = new Date(selected.startsAt).getTime()+deltaMin*60000;
    const e = new Date(selected.endsAt).getTime()+deltaMin*60000;
    await patchEventUTC(selected.masterId, { startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString() });
    await reload();
  }
  async function resizeSelected(deltaMin:number){
    if(!selected) return;
    const e = new Date(selected.endsAt).getTime()+deltaMin*60000;
    await patchEventUTC(selected.masterId, { endsAt: new Date(e).toISOString() });
    await reload();
  }
  async function makeWeeklyCount8(){
    if(!selected) return;
    // BYDAY from start date
    const start = new Date(selected.startsAt);
    const byday = ['SU','MO','TU','WE','TH','FR','SA'][start.getUTCDay()];
    await patchEventUTC(selected.masterId, { rrule: `FREQ=WEEKLY;COUNT=8;BYDAY=${byday}` });
    await reload();
  }
  async function refreshStats(){
    const weekStartISO = range.startUTC.slice(0,10);
    setStats(await statsWeek(weekStartISO));
  }

  // UI
  return (
    <div className="p-3">
      <header className="mb-2 flex items-center gap-3">
        <h1 className="text-xl font-semibold">NeuroBoost — Week</h1>
        <button className="px-3 py-1 rounded bg-zinc-800" onClick={()=>setRange(weekRangeUTC(new Date()))}>This week</button>
        <button className="px-3 py-1 rounded bg-zinc-800" onClick={refreshStats}>Refresh stats</button>
        {stats && <span className="text-sm opacity-80">Planned {stats.plannedMin}m • Completed {stats.completedMin}m • Adherence {stats.adherencePct}%</span>}
        {toast && <span className="ml-auto text-amber-300">{toast}</span>}
      </header>

      <div
        ref={gridRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        className="border border-zinc-800 rounded overflow-hidden select-none"
      >
        {/* header row */}
        <div className="grid grid-cols-8 bg-zinc-900 text-xs">
          <div className="p-1">All-day</div>
          {days.map(d => <div key={d} className="p-1 border-l border-zinc-800">D{d+1}</div>)}
        </div>

        {/* time grid */}
        <div className="grid grid-cols-8">
          {/* hours rail */}
          <div className="bg-zinc-900 text-xs">
            {Array.from({length:(H_END-H_START)}).map((_,i)=>(
              <div key={i} className="h-[calc(var(--hour-h)*2)] border-b border-zinc-800 px-1">{String(H_START+i).padStart(2,'0')}:00</div>
            ))}
          </div>

          {/* 7 days */}
          {days.map(day => (
            <div key={day} className="relative border-l border-zinc-800"
                 onMouseDown={(ev)=>onMouseDownCell(ev, day)}>
              {/* background hour lines */}
              {Array.from({length:(H_END-H_START)}).map((_,i)=>(
                <div key={i} className="h-[calc(var(--hour-h)*2)] border-b border-zinc-900/60"></div>
              ))}
              {/* existing events */}
              {events.filter(e=>{
                 const s = new Date(e.startsAt);
                 const m = new Date(range.startUTC);
                 const idx = Math.floor((s.getTime()-m.getTime())/86400000);
                 return idx===day;
               }).map(ev=>{
                 const s = new Date(ev.startsAt); const e = new Date(ev.endsAt);
                 const minutesFromStart = (s.getUTCHours()-H_START)*60 + s.getUTCMinutes();
                 const top = Math.max(0, minutesFromStart)*(48/60); // 48px per hour
                 const height = minutesBetweenUTC(ev.startsAt, ev.endsAt)*(48/60);
                 const isSel = selected?.masterId===ev.masterId && selected.startsAt===ev.startsAt;
                 return (
                  <div key={ev.startsAt+ev.masterId}
                       onClick={(e)=>{ e.stopPropagation(); setSelected(ev); }}
                       className={`absolute left-1 right-1 rounded-md ${isSel?'bg-blue-500':'bg-zinc-700'} cursor-pointer`}
                       style={{ top, height }}>
                    <div className="text-[11px] px-1 py-0.5 truncate">{ev.title}</div>
                  </div>
                 );
               })}
              {/* drag preview */}
              {drag && drag.dayIdx===day && (
                <div className="absolute left-1 right-1 bg-emerald-600/60 rounded"
                     style={{
                       top: ((drag.startMin)*(48/60)),
                       height: ((drag.endMin - drag.startMin)*(48/60))
                     }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected controls */}
      {selected && (
        <div className="mt-3 p-2 border border-zinc-800 rounded bg-zinc-900 flex items-center gap-2">
          <div className="text-sm">Selected: <b>{selected.title}</b></div>
          <button className="px-2 py-1 bg-zinc-800 rounded" onClick={()=>moveSelected(-15)}>Move −15m</button>
          <button className="px-2 py-1 bg-zinc-800 rounded" onClick={()=>moveSelected(+15)}>Move +15m</button>
          <button className="px-2 py-1 bg-zinc-800 rounded" onClick={()=>resizeSelected(+15)}>Resize +15m</button>
          <button className="px-2 py-1 bg-zinc-800 rounded" onClick={makeWeeklyCount8}>Repeat weekly (×8)</button>
          <button className="ml-auto px-2 py-1 bg-zinc-800 rounded" onClick={()=>setSelected(null)}>Close</button>
        </div>
      )}
      <p className="mt-2 text-xs opacity-60">TZ: Europe/Moscow (UI). Storage UTC. Drag to create; click to select; controls above to move/resize and add weekly recurrence.</p>
    </div>
  );
}
