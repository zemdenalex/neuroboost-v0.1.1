import type { NbEvent } from './types';

export const API_BASE =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3001';

export type CreateEventBody = {
  title: string;
  startsAt: string; // UTC ISO
  endsAt: string;   // UTC ISO
  allDay?: boolean;
  rrule?: string | null;
};

export async function getEvents(startISO: string, endISO: string): Promise<NbEvent[]> {
  const r = await fetch(`${API_BASE}/events?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`);
  if (!r.ok) throw new Error('Failed to load events');
  const raw = await r.json();
  return raw.map((o: any) => ({
    id: o.id,
    title: o.title,
    startUtc: o.startsAt,
    endUtc: o.endsAt,
    allDay: !!o.allDay,
    masterId: o.masterId ?? null,
    rrule: o.rrule ?? null,
  })) as NbEvent[];
}

export async function createEventUTC(body: CreateEventBody): Promise<{ id: string }> {
  const r = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Failed to create');
  return r.json();
}

export async function patchEventUTC(id: string, patch: Partial<CreateEventBody> & { title?: string }): Promise<void> {
  const r = await fetch(`${API_BASE}/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('Failed to patch');
}

export async function deleteEvent(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Failed to delete');
}
