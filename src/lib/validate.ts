// Validation layer. Nothing from the parser (rules or LLM) reaches the UI
// without passing through here. It coerces loose JSON into a DraftRequest,
// rejects impossible values, and downgrades confidence when something smells.

import areasJson from '../data/areas.json';
import { addDays, formatDate, formatTime, fromISODate, isPast, toISODate, toMinutes } from './dates';
import type { Confidence, DraftRequest, Field, Intent, ParseResult, Role, StaffLine, Subcategory } from './types';
import { ROLES, ROLE_LABEL, ROLE_OF_SUBCATEGORY, SUBCATEGORIES_BY_ROLE, SUBCATEGORY_LABEL } from './types';

const AREA_NAMES = (areasJson as Array<{ name: string }>).map((a) => a.name);
const CONFIDENCES: Confidence[] = ['high', 'medium', 'low', 'missing'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const uid = () => Math.random().toString(36).slice(2, 9);

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function readField<T>(
  raw: unknown,
  coerce: (v: unknown) => T | null,
  missingReason: string,
): Field<T> & { suggestions?: T[] } {
  const r = asRecord(raw);
  const value = coerce('value' in r ? r.value : raw);
  const conf = CONFIDENCES.includes(r.confidence as Confidence) ? (r.confidence as Confidence) : value === null ? 'missing' : 'medium';
  const reason = typeof r.reason === 'string' ? r.reason : undefined;
  const suggestions = Array.isArray(r.suggestions) ? (r.suggestions.map(coerce).filter((s) => s !== null) as T[]) : undefined;
  if (value === null && conf !== 'high') {
    return { value: null, confidence: 'missing', reason: reason ?? missingReason, suggestions };
  }
  return { value, confidence: conf, reason, suggestions };
}

const coerceRole = (v: unknown): Role | null => (typeof v === 'string' && ROLES.includes(v as Role) ? (v as Role) : null);
const coerceSub = (v: unknown): Subcategory | null =>
  typeof v === 'string' && v in SUBCATEGORY_LABEL ? (v as Subcategory) : null;
const coerceCount = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
};
const coerceISO = (v: unknown): string | null => {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return null;
  const d = fromISODate(v);
  return Number.isNaN(d.getTime()) && toISODate(d) !== v ? null : v;
};
const coerceTime = (v: unknown): string | null => (typeof v === 'string' && HHMM.test(v) ? v : null);
const coerceArea = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 1 ? v.trim() : null);
const coerceBudget = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && n > 0 && n < 100000 ? Math.round(n) : null;
};

function validateLine(raw: unknown): StaffLine {
  const r = asRecord(raw);
  let role = readField<Role>(r.role, coerceRole, 'Who do you need?');
  let sub = readField<Subcategory>(r.subcategory, coerceSub, 'Pick the type of staff');
  const count = readField<number>(r.count, coerceCount, 'How many?');

  // Subcategory implies role. If the two disagree, trust the more specific one.
  if (sub.value && role.value !== ROLE_OF_SUBCATEGORY[sub.value]) {
    role = { value: ROLE_OF_SUBCATEGORY[sub.value], confidence: sub.confidence };
  }
  // A role with exactly one subcategory never needs a question.
  if (role.value && !sub.value && SUBCATEGORIES_BY_ROLE[role.value].length === 1) {
    sub = { value: SUBCATEGORIES_BY_ROLE[role.value][0], confidence: role.confidence };
  }
  if (!role.value && !sub.value) {
    sub = { ...sub, value: null, confidence: 'missing', reason: sub.reason ?? role.reason ?? 'Pick the type of staff' };
  }
  if (count.value === null) {
    return { id: uid(), role, subcategory: sub, count: { value: 1, confidence: 'medium', reason: 'Count was unreadable, assumed 1', suggestions: [1, 2, 3] } as Field<number> };
  }
  return { id: uid(), role, subcategory: sub, count };
}

export function validateDraft(raw: unknown, today: Date = new Date(), rawText = ''): DraftRequest {
  const r = asRecord(raw);
  const linesRaw = Array.isArray(r.lines) && r.lines.length > 0 ? r.lines : [{}];
  const lines = linesRaw.slice(0, 5).map(validateLine);

  let date = readField<string>(r.date, coerceISO, 'No date mentioned');
  let endDate = readField<string | null>(r.endDate, coerceISO, '');
  if (endDate.value === null) endDate = { value: null, confidence: 'high' };

  if (date.value && isPast(date.value, today)) {
    const d = fromISODate(date.value);
    const nextMonth = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    const nextYear = toISODate(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
    date = {
      value: date.value,
      confidence: 'low',
      reason: `${formatDate(date.value)} has already passed. Did you mean ${formatDate(nextMonth)}?`,
      suggestions: [nextMonth, nextYear],
    } as Field<string>;
  }
  if (!date.suggestions && date.value === null) {
    (date as Field<string> & { suggestions?: string[] }).suggestions = Array.from({ length: 7 }, (_, i) => toISODate(addDays(today, i)));
  }
  if (date.value && endDate.value && fromISODate(endDate.value) < fromISODate(date.value)) {
    endDate = { value: null, confidence: 'low', reason: 'End date was before the start date, cleared it' };
  }

  let startTime = readField<string>(r.startTime, coerceTime, 'No start time mentioned');
  let endTime = readField<string>(r.endTime, coerceTime, 'No end time mentioned');
  if (startTime.value && endTime.value && toMinutes(endTime.value) <= toMinutes(startTime.value)) {
    endTime = {
      value: endTime.value,
      confidence: 'low',
      reason: `${formatTime(endTime.value)} is not after ${formatTime(startTime.value)}. Overnight shift, or a mistake?`,
      suggestions: ['23:30', endTime.value],
    } as Field<string>;
  }
  if (!startTime.suggestions && !startTime.value) (startTime as Field<string> & { suggestions?: string[] }).suggestions = ['09:00', '12:00', '18:00'];
  if (!endTime.suggestions && !endTime.value) (endTime as Field<string> & { suggestions?: string[] }).suggestions = ['14:00', '17:00', '23:00'];

  let location = readField<string>(r.location, coerceArea, 'No area mentioned');
  if (location.value) {
    const known = AREA_NAMES.find((n) => n.toLowerCase() === location.value!.toLowerCase());
    if (known) location = { ...location, value: known };
    else {
      location = {
        value: location.value,
        confidence: 'low',
        reason: `"${location.value}" is not an area we serve yet. Pick the nearest one`,
      };
    }
  }

  const budgetPerDay = readField<number | null>(r.budgetPerDay, coerceBudget, '');
  if (budgetPerDay.value === null) (budgetPerDay as Field<number | null>).confidence = 'high';

  const notes = Array.isArray(r.notes) ? r.notes.filter((n): n is string => typeof n === 'string').slice(0, 6) : [];

  return {
    id: typeof r.id === 'string' ? r.id : uid(),
    raw: typeof r.raw === 'string' ? r.raw : rawText,
    lines,
    date,
    endDate,
    startTime,
    endTime,
    location,
    budgetPerDay,
    notes,
  };
}

export function validateParse(raw: unknown, today: Date, rawText: string, engine: ParseResult['engine']): ParseResult {
  const r = asRecord(raw);
  const intents: Intent[] = ['book', 'cancel_and_book', 'cancel_only', 'unclear'];
  const intent = intents.includes(r.intent as Intent) ? (r.intent as Intent) : 'book';
  const draftsRaw = Array.isArray(r.drafts) && r.drafts.length > 0 ? r.drafts : [{}];
  const drafts = draftsRaw.slice(0, 3).map((d) => validateDraft(d, today, rawText));
  const warnings: string[] = [];
  if (drafts.length > 1) warnings.push(`This looks like ${drafts.length} separate bookings. You will confirm them one at a time.`);
  if (intent === 'cancel_and_book') warnings.push('You asked to cancel your latest request. Confirm that below before booking.');
  if (intent === 'cancel_only') warnings.push('No new booking was found in this message.');
  if (intent === 'unclear') warnings.push('No staff type was found. Pick who you need.');
  return { intent, drafts, warnings, engine };
}

// ---- Review helpers --------------------------------------------------------

export type FieldKey = 'date' | 'endDate' | 'startTime' | 'endTime' | 'location' | 'budgetPerDay';

export interface Blocker {
  key: string;
  label: string;
}

/** Fields the owner must set (missing) or confirm (low) before continuing. */
export function blockers(draft: DraftRequest): Blocker[] {
  const out: Blocker[] = [];
  draft.lines.forEach((l, i) => {
    if (l.subcategory.confidence === 'missing' || l.subcategory.confidence === 'low') out.push({ key: `line:${l.id}:subcategory`, label: `Staff type${draft.lines.length > 1 ? ` (${i + 1})` : ''}` });
    if (l.count.confidence === 'low') out.push({ key: `line:${l.id}:count`, label: 'How many' });
  });
  const required: Array<[FieldKey, string]> = [
    ['date', 'Date'],
    ['startTime', 'Start time'],
    ['endTime', 'End time'],
    ['location', 'Area'],
  ];
  for (const [key, label] of required) {
    const c = draft[key].confidence;
    if (c === 'missing' || c === 'low') out.push({ key, label });
  }
  return out;
}

export function summarize(draft: DraftRequest): string {
  const who = draft.lines
    .map((l) => {
      const n = l.count.value ?? 1;
      const plural = n > 1 ? 's' : '';
      if (l.subcategory.value) return `${n} ${SUBCATEGORY_LABEL[l.subcategory.value]}${plural}`;
      if (l.role.value) return `${n} ${ROLE_LABEL[l.role.value]}${plural} (any type)`;
      return `${n} staff (type not set)`;
    })
    .join(' + ');
  const when = draft.date.value
    ? draft.endDate.value && draft.endDate.value !== draft.date.value
      ? `${formatDate(draft.date.value)} to ${formatDate(draft.endDate.value)}`
      : formatDate(draft.date.value)
    : 'date not set';
  const time = draft.startTime.value && draft.endTime.value ? `${formatTime(draft.startTime.value)} to ${formatTime(draft.endTime.value)}` : 'time not set';
  const where = draft.location.value ?? 'area not set';
  return `${who}, ${when}, ${time}, ${where}`;
}
