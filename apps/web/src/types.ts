export type NbEvent = {
  id: string;
  title: string;
  startUtc: string; // UI expects these names
  endUtc: string;
  allDay?: boolean;
  masterId?: string | null;
  rrule?: string | null; // <— add
  tz?: string | null;
};
