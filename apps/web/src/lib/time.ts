export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0=Mon
  x.setHours(0,0,0,0);
  x.setDate(x.getDate() - day);
  return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
export function toISO(d: Date): string { return new Date(d).toISOString(); }
export function minutesBetween(a: Date, b: Date): number { return Math.max(0, Math.round((+b - +a)/60000)); }

// very small weekly expansion: FREQ=WEEKLY;COUNT=N
export function expandWeekly(ev: { startsAt: string; endsAt: string; rrule?: string | null; exceptions?: { occurrence: string; skipped: boolean }[] }, rangeStart: Date, rangeEnd: Date) {
  if (!ev.rrule || !ev.rrule.startsWith('FREQ=WEEKLY')) return [];
  const m = /COUNT=(\d+)/.exec(ev.rrule);
  const count = m ? parseInt(m[1], 10) : 1;
  const baseStart = new Date(ev.startsAt); const baseEnd = new Date(ev.endsAt);
  const out: { start: Date; end: Date }[] = [];
  const skips = new Set((ev.exceptions||[]).filter(e => e.skipped).map(e => new Date(e.occurrence).toISOString()));
  for (let k=0; k<count; k++) {
    const s = new Date(baseStart); s.setDate(s.getDate()+7*k);
    const e = new Date(baseEnd);   e.setDate(e.getDate()+7*k);
    if (s < rangeEnd && e > rangeStart) {
      const key = s.toISOString();
      if (!skips.has(key)) out.push({ start: s, end: e });
    }
  }
  return out;
}
