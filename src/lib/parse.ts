// Rule-based parser. It plays the role of the LLM when no API key is set and is
// also the fallback when the LLM call fails or returns garbage. It produces the
// same loose JSON shape the LLM is asked for; `validateDraft` then normalises
// both paths so the UI never trusts either of them directly.

import areasJson from '../data/areas.json';
import { addDays, fromMinutes, nextWeekday, toISODate, toMinutes } from './dates';
import type { Confidence, Intent, Role, Subcategory } from './types';
import { SUBCATEGORIES_BY_ROLE } from './types';

export interface RawField<T> {
  value: T | null;
  confidence: Confidence;
  reason?: string;
  suggestions?: T[];
}

export interface RawLine {
  role: RawField<Role>;
  subcategory: RawField<Subcategory>;
  count: RawField<number>;
}

export interface RawDraft {
  lines: RawLine[];
  date: RawField<string>;
  endDate: RawField<string | null>;
  startTime: RawField<string>;
  endTime: RawField<string>;
  location: RawField<string>;
  budgetPerDay: RawField<number | null>;
  notes: string[];
}

export interface RawParse {
  intent: Intent;
  drafts: RawDraft[];
}

const uid = () => Math.random().toString(36).slice(2, 9);

const field = <T,>(value: T | null, confidence: Confidence, reason?: string, suggestions?: T[]): RawField<T> => ({
  value,
  confidence,
  ...(reason ? { reason } : {}),
  ...(suggestions ? { suggestions } : {}),
});

// ---- Vocabulary --------------------------------------------------------------

const NOUN =
  /\b(chefs?|cooks?|khansama|helpers?|assistants?|waiters?|waitress(?:es)?|servers?|stewards?|cleaners?|cleaning\s+(?:crew|staff|team)|housekeeping|bartenders?|barman|barmen|mixologists?|someone|somebody|anyone|staff|person|people|koi)\b/gi;

const ROLE_WORDS: Array<[RegExp, Role]> = [
  [/^(chefs?|cooks?|khansama)$/i, 'chef'],
  [/^(helpers?|assistants?)$/i, 'helper'],
  [/^(waiters?|waitress(?:es)?|servers?|stewards?)$/i, 'waiter'],
  [/^(cleaners?|cleaning\s+(?:crew|staff|team)|housekeeping)$/i, 'cleaner'],
  [/^(bartenders?|barman|barmen|mixologists?)$/i, 'bartender'],
];

const SUBCAT_CUES: Array<[RegExp, Subcategory]> = [
  [/\b(chinese|hakka|indo[- ]?chinese|chowmein|momos?)\b/i, 'chinese_chef'],
  [/\btandoor(?:i)?\b/i, 'tandoor_chef'],
  [/\b(continental|italian|european|pasta)\b/i, 'continental_chef'],
  [/\b(south[- ]?indian|dosa|idli)\b/i, 'south_indian_chef'],
  [/\b(pastry|baker|bakery|dessert|cakes?)\b/i, 'pastry_chef'],
  [/\bdeep[- ]?clean(?:ing)?\b/i, 'deep_cleaner'],
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, ek: 1, single: 1,
  two: 2, do: 2, couple: 2, pair: 2,
  three: 3, teen: 3, few: 3,
  four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5,
  six: 6, che: 6, chhe: 6,
  seven: 7, saat: 7,
  eight: 8, aath: 8,
  nine: 9, nau: 9,
  ten: 10, das: 10,
};

const WEEKDAYS: Array<[RegExp, number]> = [
  [/\b(sunday|sun|ravivar|itvaar|itwar)\b/i, 0],
  [/\b(monday|mon|somvar|somwar)\b/i, 1],
  [/\b(tuesday|tues?|mangalvar)\b/i, 2],
  [/\b(wednesday|wed|budhvar|budhwar)\b/i, 3],
  [/\b(thursday|thurs?|thu|guruvar)\b/i, 4],
  [/\b(friday|fri|shukravar)\b/i, 5],
  [/\b(saturday|sat|shanivar|shaniwar)\b/i, 6],
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const DAY_PARTS: Array<[RegExp, string, string, string]> = [
  [/\b(early\s+morning|subah|morning)\b/i, '08:00', '12:00', 'morning'],
  [/\b(afternoon|dopahar|lunch)\b/i, '12:00', '16:00', 'afternoon'],
  [/\b(evening|shaam|sham|dinner)\b/i, '18:00', '22:00', 'evening'],
  [/\b(night|raat|tonight)\b/i, '20:00', '23:30', 'night'],
];

interface Area { name: string; lat: number; lng: number; aliases: string[] }
const AREAS = areasJson as Area[];

// ---- Helpers ----------------------------------------------------------------

/**
 * Finds a count in the words just before a staff noun ("2 Chinese chefs",
 * "a cook", "crew of 3" is handled by the caller). Only the last four tokens
 * count, and digits glued to a time or date marker are ignored.
 */
function parseCount(window: string): number | null {
  const tokens = window.toLowerCase().trim().split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= Math.max(0, tokens.length - 4); i--) {
    const tok = tokens[i];
    const next = tokens[i + 1] ?? '';
    if (/^\d{1,2}$/.test(tok) && !/^(am|pm|baje|st|nd|rd|th|oct|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|din|days?|to|se|-|–)/.test(next)) {
      return Number(tok);
    }
    const word = tok.replace(/[^a-z]/g, '');
    if (word in NUMBER_WORDS) return NUMBER_WORDS[word];
  }
  return null;
}

function roleOf(noun: string): Role | null {
  for (const [re, role] of ROLE_WORDS) if (re.test(noun)) return role;
  return null;
}

function cueIn(text: string): Subcategory | null {
  for (const [re, sub] of SUBCAT_CUES) if (re.test(text)) return sub;
  return null;
}

interface Mention {
  start: number;
  end: number;
  noun: string;
  role: Role | null;
  count: number | null;
  cue: Subcategory | null;
}

function findMentions(text: string): Mention[] {
  const out: Mention[] = [];
  let prevEnd = 0;
  for (const m of text.matchAll(NOUN)) {
    const start = m.index ?? 0;
    const noun = m[0];
    const before = text.slice(prevEnd, start);
    const after = text.slice(start + noun.length, start + noun.length + 10);
    let count = parseCount(before);
    const ofN = after.match(/^\s+of\s+(\d{1,2})\b/i);
    if (ofN) count = Number(ofN[1]);
    out.push({ start, end: start + noun.length, noun, role: roleOf(noun), count, cue: cueIn(before) });
    prevEnd = start + noun.length;
  }
  // "Chinese chef" and "Chinese chefs and helper" -- a cue only applies to the
  // mention right after it, so the look-back window above is bounded by prevEnd.
  return out;
}

function buildLine(m: Mention, segmentText: string, fullText: string): RawLine {
  const roleField: RawField<Role> = m.role
    ? field(m.role, 'high')
    : field<Role>(null, 'missing', `"${m.noun}" does not say which role you need`);

  let count: RawField<number>;
  if (m.count !== null) count = field(m.count, 'high');
  else if (m.noun.toLowerCase().endsWith('s') && !/ss$/.test(m.noun.toLowerCase()) && /^(chefs|cooks|helpers|waiters|servers|cleaners|bartenders|people)$/i.test(m.noun)) {
    count = field(2, 'low', 'Plural with no number. How many?', [2, 3, 4, 5]);
  } else count = field(1, 'medium', 'No number given, assumed 1', [1, 2, 3]);

  let sub: RawField<Subcategory>;
  const role = m.role;
  if (!role) {
    sub = field<Subcategory>(null, 'missing', 'Pick the type of staff');
  } else if (SUBCATEGORIES_BY_ROLE[role].length === 1) {
    sub = field(SUBCATEGORIES_BY_ROLE[role][0], 'high');
  } else if (m.cue) {
    sub = field(m.cue, 'high');
  } else {
    const detached = cueIn(segmentText) ?? cueIn(fullText);
    if (detached && SUBCATEGORIES_BY_ROLE[role].includes(detached)) {
      sub = field(detached, 'medium', `Cuisine was mentioned separately, matched to ${m.noun}`);
    } else {
      sub = field<Subcategory>(null, 'missing', 'Which cuisine? Chinese, tandoor, continental, South Indian or pastry', SUBCATEGORIES_BY_ROLE[role]);
    }
  }
  return { role: roleField, subcategory: sub, count };
}

// ---- Date -------------------------------------------------------------------

interface DateParse {
  date: RawField<string>;
  endDate: RawField<string | null>;
  index: number;
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase());
}

function isoFor(day: number, month: number, today: Date): string {
  return toISODate(new Date(today.getFullYear(), month, day));
}

export function parseDate(text: string, today: Date): DateParse {
  const t = text.toLowerCase();

  // "28 se 30 October", "28 to 30 Oct", "28-30 October"
  const range = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:se|to|-|–|till|tak|through)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}`, 'i'));
  if (range) {
    const mi = monthIndex(range[3]);
    return {
      date: field(isoFor(Number(range[1]), mi, today), 'high'),
      endDate: field<string | null>(isoFor(Number(range[2]), mi, today), 'high'),
      index: range.index ?? 0,
    };
  }

  // "25th October", "25 Oct", "October 25"
  const dm = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, 'i'));
  const md = t.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  const explicit = dm ? { day: Number(dm[1]), month: monthIndex(dm[2]), index: dm.index ?? 0 } : md ? { day: Number(md[2]), month: monthIndex(md[1]), index: md.index ?? 0 } : null;
  if (explicit) {
    return { date: field(isoFor(explicit.day, explicit.month, today), 'high'), endDate: field<string | null>(null, 'high'), index: explicit.index };
  }

  // "25/10"
  const slash = t.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (slash) {
    return { date: field(isoFor(Number(slash[1]), Number(slash[2]) - 1, today), 'high'), endDate: field<string | null>(null, 'high'), index: slash.index ?? 0 };
  }

  let base: RawField<string> | null = null;
  let index = -1;

  if (/\bday after tomorrow\b|\bparso\b/.test(t)) {
    base = field(toISODate(addDays(today, 2)), 'high');
    index = t.search(/day after tomorrow|parso/);
  } else if (/\btomorrow\b|\bkal\b/.test(t)) {
    base = field(toISODate(addDays(today, 1)), 'high');
    index = t.search(/tomorrow|kal/);
  } else if (/\btoday\b|\baaj\b|\btonight\b/.test(t)) {
    base = field(toISODate(today), 'high');
    index = t.search(/today|aaj|tonight/);
  } else {
    for (const [re, wd] of WEEKDAYS) {
      const m = t.match(re);
      if (m) {
        const isNext = /\bnext\s+$/.test(t.slice(0, m.index));
        const d = nextWeekday(today, wd, false);
        base = isNext
          ? field(toISODate(d), 'medium', `"next ${m[1]}" read as the coming ${m[1]}, not the one after`, [toISODate(d), toISODate(addDays(d, 7))])
          : field(toISODate(d), 'high');
        index = m.index ?? 0;
        break;
      }
    }
  }

  if (!base) {
    if (/\bweekend\b/.test(t)) {
      const sat = nextWeekday(today, 6, false);
      const sun = nextWeekday(today, 0, false);
      base = field(toISODate(sat), 'low', 'Weekend could mean Saturday or Sunday', [toISODate(sat), toISODate(sun)]);
      index = t.indexOf('weekend');
    } else if (/\bnext week\b|\bagle hafte\b/.test(t)) {
      const monday = nextWeekday(addDays(today, 1), 1, true);
      const week = Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));
      base = field<string>(null, 'missing', 'Which day next week?', week);
      index = t.search(/next week|agle hafte/);
    } else if (/\bthis week\b/.test(t)) {
      const week = Array.from({ length: 6 }, (_, i) => toISODate(addDays(today, i + 1)));
      base = field<string>(null, 'missing', 'Which day this week?', week);
      index = t.indexOf('this week');
    }
  }

  if (!base) {
    const soon = Array.from({ length: 7 }, (_, i) => toISODate(addDays(today, i)));
    return { date: field<string>(null, 'missing', 'No date mentioned', soon), endDate: field<string | null>(null, 'high'), index: -1 };
  }

  // Duration: "3 din ke liye", "for 3 days", "3-day"
  const dur = t.match(/\b(\d{1,2}|two|three|four|five|do|teen|char|paanch)\s*(?:-|\s)?(?:din|days?)\b/);
  let endDate: RawField<string | null> = field<string | null>(null, 'high');
  if (dur && base.value) {
    const n = Number(dur[1]) || NUMBER_WORDS[dur[1]] || 1;
    endDate = field<string | null>(toISODate(addDays(new Date(base.value), n - 1)), 'high');
  }
  return { date: base, endDate, index };
}

function findDayTokens(text: string): number[] {
  const t = text.toLowerCase();
  const idx: number[] = [];
  for (const [re] of WEEKDAYS) {
    const m = t.match(re);
    if (m && m.index !== undefined) idx.push(m.index);
  }
  for (const re of [/\btomorrow\b/, /\btoday\b/, new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_RE}`, 'i')]) {
    const m = t.match(re);
    if (m && m.index !== undefined) idx.push(m.index);
  }
  return idx.sort((a, b) => a - b);
}

// ---- Time -------------------------------------------------------------------

function to24(h: number, min: number, mer: string | undefined, fallbackPm: boolean): string {
  let hour = h;
  if (mer === 'am') hour = h === 12 ? 0 : h;
  else if (mer === 'pm') hour = h === 12 ? 12 : h + 12;
  else if (h <= 12 && fallbackPm && h !== 12) hour = h + 12;
  return fromMinutes(hour * 60 + min);
}

export function parseTime(text: string): { startTime: RawField<string>; endTime: RawField<string> } {
  const t = text.toLowerCase().replace(/(\d)\s*(am|pm)/g, '$1$2');
  const part = DAY_PARTS.find(([re]) => re.test(t));
  const pmBias = part ? toMinutes(part[1]) >= 12 * 60 : true;

  // Range with at least one meridiem or 24h clock.
  const range = t.match(/\b(\d{1,2})(?::(\d{2}))?(am|pm)?\s*(?:to|-|–|till|until|se|tak)\s*(\d{1,2})(?::(\d{2}))?(am|pm)?\b/);
  if (range) {
    const [, h1s, m1s, mer1, h2s, m2s, mer2] = range;
    const h1 = Number(h1s), h2 = Number(h2s);
    const is24 = (m1s !== undefined || m2s !== undefined) && (h1 > 12 || h2 > 12);
    if (mer1 || mer2 || is24) {
      const mA = mer1 ?? (mer2 && h1 <= h2 ? mer2 : mer2 === 'pm' ? 'am' : mer2);
      const mB = mer2 ?? (mer1 && h2 >= h1 ? mer1 : mer1 === 'am' ? 'pm' : mer1);
      const start = to24(h1, Number(m1s ?? 0), is24 ? undefined : mA, false);
      const end = to24(h2, Number(m2s ?? 0), is24 ? undefined : mB, false);
      const inferred = !mer1 || !mer2;
      return {
        startTime: field(start, inferred && !mer1 ? 'medium' : 'high', inferred && !mer1 ? 'AM/PM taken from the end time' : undefined),
        endTime: field(end, inferred && !mer2 ? 'medium' : 'high', inferred && !mer2 ? 'AM/PM taken from the start time' : undefined),
      };
    }
  }

  // Bare "6 to 11" with a day-part or restaurant bias.
  const bare = t.match(/\b(\d{1,2})\s*(?:to|-|–|se)\s*(\d{1,2})\b(?!\s*(?:oct|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|din|days?|\/))/);
  if (bare && Number(bare[1]) <= 12 && Number(bare[2]) <= 12) {
    const start = to24(Number(bare[1]), 0, undefined, pmBias);
    const end = to24(Number(bare[2]), 0, undefined, pmBias);
    return {
      startTime: field(start, 'low', part ? `Read as ${part[3]} hours` : 'No AM/PM given, assumed PM', [start, to24(Number(bare[1]), 0, 'am', false)]),
      endTime: field(end, 'low', 'No AM/PM given', [end, to24(Number(bare[2]), 0, 'am', false)]),
    };
  }

  // Start only: "from 6 pm", "shaam 6 baje se", "at 7pm", "6pm"
  const single = t.match(/\b(?:from|at|@|se)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)\b(?:\s*(se|onwards|se\s+aage))?/);
  if (single) {
    const h = Number(single[1]);
    const mer = single[3] === 'baje' ? undefined : single[3];
    const start = to24(h, Number(single[2] ?? 0), mer, pmBias);
    const plus = (n: number) => fromMinutes(toMinutes(start) + n * 60);
    return {
      startTime: field(start, mer ? 'high' : 'medium', mer ? undefined : `"${single[1]} baje" read as ${part ? part[3] : 'PM'}`),
      endTime: field(plus(5), 'low', 'No end time given, assumed a 5-hour shift', [plus(3), plus(5), plus(8)]),
    };
  }

  if (part) {
    return {
      startTime: field(part[1], 'medium', `"${part[3]}" read as ${label(part[1])} to ${label(part[2])}`),
      endTime: field(part[2], 'medium', 'Taken from the time of day'),
    };
  }

  return {
    startTime: field<string>(null, 'missing', 'No start time mentioned', ['09:00', '12:00', '18:00']),
    endTime: field<string>(null, 'missing', 'No end time mentioned', ['14:00', '17:00', '23:00']),
  };
}

function label(hhmm: string): string {
  const h = Number(hhmm.split(':')[0]);
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ---- Location ---------------------------------------------------------------

export function parseLocation(text: string): RawField<string> {
  const t = ` ${text.toLowerCase()} `;
  let best: { name: string; alias: boolean; len: number } | null = null;
  for (const a of AREAS) {
    const candidates = [{ s: a.name.toLowerCase(), alias: false }, ...a.aliases.map((s) => ({ s, alias: true }))];
    for (const c of candidates) {
      const re = new RegExp(`(^|[^a-z])${c.s.replace(/[-]/g, '[- ]?')}([^a-z]|$)`, 'i');
      if (re.test(t) && (!best || c.s.length > best.len)) best = { name: a.name, alias: c.alias, len: c.s.length };
    }
  }
  if (!best) return field<string>(null, 'missing', 'No area mentioned');
  return best.alias
    ? field(best.name, 'medium', `Short form read as ${best.name}`)
    : field(best.name, 'high');
}

// ---- Budget & notes ---------------------------------------------------------

function parseBudget(text: string): RawField<number | null> {
  const t = text.toLowerCase();
  const a = t.match(/budget[^\d]{0,16}(\d{3,6})/);
  const b = t.match(/(?:₹|rs\.?|inr)\s*(\d{3,6})/);
  const c = t.match(/(\d{3,6})\s*(?:\/|per|a|each|har)\s*(?:day|din|shift)/);
  const m = a ?? b ?? c;
  if (!m) return field<number | null>(null, 'high');
  return field<number | null>(Number(m[1]), 'high');
}

function parseNotes(text: string): string[] {
  const t = text.toLowerCase();
  const notes: string[] = [];
  if (/\bparty\b/.test(t)) notes.push('For a party');
  if (/\bevent\b|\bfunction\b|\bshaadi\b|\bwedding\b/.test(t)) notes.push('For an event');
  if (/\boutlet\b|\bbranch\b/.test(t)) notes.push('At the outlet');
  if (/\brenovation\b/.test(t)) notes.push('After renovation');
  if (/\burgent\b|\basap\b|\bjaldi\b/.test(t)) notes.push('Urgent');
  if (/\binstead\b/.test(t)) notes.push('Replaces an earlier request');
  return notes;
}

// ---- Entry ------------------------------------------------------------------

export function parseWithRules(input: string, today: Date = new Date()): RawParse {
  const original = input.trim();
  let text = original;

  let intent: Intent = 'book';
  if (/\bcancel\b|\bradd\b/i.test(text)) {
    const stripped = text.replace(/\b(please\s+)?cancel\s+(my\s+)?(last|previous|earlier|latest)?\s*(request|booking|order)?\s*(and|aur|then|,)?\s*/i, '').trim();
    intent = NOUN.test(stripped) ? 'cancel_and_book' : 'cancel_only';
    NOUN.lastIndex = 0;
    text = stripped;
  }

  const mentions = findMentions(text);
  NOUN.lastIndex = 0;
  const dayTokens = findDayTokens(text);
  const shared = {
    time: parseTime(text),
    location: parseLocation(text),
    budget: parseBudget(text),
    notes: parseNotes(text),
    date: parseDate(text, today),
  };

  if (mentions.length === 0) {
    const emptyLine: RawLine = {
      role: field<Role>(null, 'missing', 'Who do you need? No staff type was mentioned'),
      subcategory: field<Subcategory>(null, 'missing', 'Pick the type of staff'),
      count: field(1, 'medium', 'No number given, assumed 1', [1, 2, 3]),
    };
    return {
      intent: intent === 'book' ? 'unclear' : intent,
      drafts: [makeDraft([emptyLine], shared.date, shared)],
    };
  }

  // One day group per mention when the text pairs each staff mention with its
  // own day ("2 chefs Saturday and 1 cleaner Sunday"). Otherwise one draft.
  const groups = new Map<string, { lines: RawLine[]; date: DateParse }>();
  const splitByDay = mentions.length >= 2 && dayTokens.length >= 2;

  mentions.forEach((m, i) => {
    const segStart = m.start;
    const segEnd = i + 1 < mentions.length ? mentions[i + 1].start : text.length;
    const segment = text.slice(segStart, segEnd);
    const segDate = splitByDay ? parseDate(segment, today) : shared.date;
    const dateParse = splitByDay && segDate.date.value ? segDate : shared.date;
    const key = dateParse.date.value ?? 'none';
    const line = buildLine(m, segment, text);
    const g = groups.get(key);
    if (g) g.lines.push(line);
    else groups.set(key, { lines: [line], date: dateParse });
  });

  const drafts = Array.from(groups.values()).map((g) => makeDraft(g.lines, g.date, shared));
  return { intent, drafts };
}

function makeDraft(
  lines: RawLine[],
  date: DateParse,
  shared: { time: ReturnType<typeof parseTime>; location: RawField<string>; budget: RawField<number | null>; notes: string[] },
): RawDraft {
  return {
    lines,
    date: date.date,
    endDate: date.endDate,
    startTime: shared.time.startTime,
    endTime: shared.time.endTime,
    location: shared.location,
    budgetPerDay: shared.budget,
    notes: shared.budget.value ? [...shared.notes, `Budget ₹${shared.budget.value} per day`] : shared.notes,
  };
}

export const _internal = { uid };
