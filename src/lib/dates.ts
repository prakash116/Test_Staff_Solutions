import type { DraftRequest } from './types';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Next occurrence of weekday (0-6) on or after `from`. */
export function nextWeekday(from: Date, weekday: number, includeToday = true): Date {
  const diff = (weekday - from.getDay() + 7) % 7;
  return addDays(from, diff === 0 && !includeToday ? 7 : diff);
}

export function formatDate(iso: string): string {
  const d = fromISODate(iso);
  return `${SHORT_DAY[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isPast(iso: string, today: Date): boolean {
  return fromISODate(iso).getTime() < fromISODate(toISODate(today)).getTime();
}

export function dateRangeLabel(draft: DraftRequest): string {
  if (!draft.date.value) return 'Date not set';
  const start = formatDate(draft.date.value);
  if (draft.endDate.value && draft.endDate.value !== draft.date.value) {
    return `${start} to ${formatDate(draft.endDate.value)}`;
  }
  return start;
}

export function timeRangeLabel(draft: DraftRequest): string {
  const s = draft.startTime.value;
  const e = draft.endTime.value;
  if (s && e) return `${formatTime(s)} to ${formatTime(e)}`;
  if (s) return `From ${formatTime(s)}`;
  return 'Time not set';
}
