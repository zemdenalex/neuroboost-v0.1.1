const API = "http://localhost:3001";
export type EventOcc = {
  id: string; masterId: string; title: string; allDay: boolean; rrule: string | null;
  startsAt: string; endsAt: string; // UTC ISO
};

export const msFromMsk = (d: Date) => d.getTime() - 3 * 3600_000;
export const msToMsk = (d: Date) => d.getTime() + 3 * 3600_000;
export const toUTCISOFromMsk = (y: number,m: number,day: number,h: number,min: number) => {
  const local = new Date(Date.UTC(y, m, day, h-3, min)); // subtract +03
  return local.toISOString();
};

export async function fetchEvents(startUTCISO: string, endUTCISO: string): Promise<EventOcc[]> {
  const url = `${API}/events?start=${encodeURIComponent(startUTCISO)}&end=${encodeURIComponent(endUTCISO)}`;
  const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json();
}
export async function createEventUTC(body: {title:string; startsAt:string; endsAt:string; allDay?:boolean; rrule?:string|null}) {
  const r = await fetch(`${API}/events`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}
export async function patchEventUTC(id:string, body: Partial<{startsAt:string; endsAt:string; rrule:string|null}>) {
  const r = await fetch(`${API}/events/${id}`, { method: 'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}
export async function statsWeek(startISODate: string) {
  const r = await fetch(`${API}/stats/week?start=${encodeURIComponent(startISODate)}`);
  if (!r.ok) throw new Error(await r.text()); return r.json();
}
