// Matching scorer. Every number that ends up in an explanation is computed
// here, and the explanation string is assembled from those numbers only.

import areasJson from '../data/areas.json';
import { addDays, formatDate, fromISODate, toISODate, toMinutes } from './dates';
import type { DraftRequest, Partner, RankedPartner, ScoreComponents, StaffLine, Subcategory } from './types';
import { ROLE_OF_SUBCATEGORY, SUBCATEGORY_LABEL } from './types';

export const WEIGHTS = { fit: 0.4, availability: 0.25, distance: 0.2, reliability: 0.15 } as const;
export const MAX_USEFUL_KM = 15;
export const OVER_BUDGET_PENALTY = 0.85;

interface Area { name: string; lat: number; lng: number }
const AREAS = areasJson as Area[];
const DELHI_CENTRE = { lat: 28.6139, lng: 77.209 };

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function areaCoords(name: string | null): { lat: number; lng: number; known: boolean } {
  const a = name ? AREAS.find((x) => x.name.toLowerCase() === name.toLowerCase()) : undefined;
  return a ? { lat: a.lat, lng: a.lng, known: true } : { ...DELHI_CENTRE, known: false };
}

function datesOf(draft: DraftRequest): string[] {
  if (!draft.date.value) return [];
  const end = draft.endDate.value ?? draft.date.value;
  const out: string[] = [];
  let d = fromISODate(draft.date.value);
  const last = fromISODate(end).getTime();
  while (d.getTime() <= last && out.length < 14) {
    out.push(toISODate(d));
    d = addDays(d, 1);
  }
  return out;
}

/** 1 = covers the whole window, 0.5 = overlaps part of it, 0 = none / blocked. */
export function availabilityFor(partner: Partner, iso: string, start: string, end: string): number {
  if (partner.blockedDates.includes(iso)) return 0;
  const windows = partner.weeklyAvailability[String(fromISODate(iso).getDay())] ?? [];
  const s = toMinutes(start);
  const e = toMinutes(end) <= s ? 24 * 60 : toMinutes(end);
  let best = 0;
  for (const w of windows) {
    const ws = toMinutes(w.start);
    const we = toMinutes(w.end);
    if (ws <= s && we >= e) return 1;
    if (ws < e && we > s) best = 0.5;
  }
  return best;
}

export function fitFor(requested: Subcategory | null, partner: Subcategory): number {
  if (requested === null) return 0.7; // "any chef": every chef qualifies, exact wins
  if (requested === partner) return 1;
  return 0.35; // same role, different specialty
}

export interface RankResult {
  ranked: RankedPartner[];
  excluded: Array<{ partner: Partner; reason: string }>;
  /** True when the request area is unknown and distance fell back to the city centre. */
  distanceApproximate: boolean;
}

export function rankPartners(draft: DraftRequest, line: StaffLine, partners: Partner[], limit = 5): RankResult {
  const role = line.role.value ?? (line.subcategory.value ? ROLE_OF_SUBCATEGORY[line.subcategory.value] : null);
  const origin = areaCoords(draft.location.value);
  const dates = datesOf(draft);
  const start = draft.startTime.value ?? '00:00';
  const end = draft.endTime.value ?? '23:59';
  const budget = draft.budgetPerDay.value;

  const ranked: RankedPartner[] = [];
  const excluded: RankResult['excluded'] = [];

  for (const p of partners) {
    if (!role || ROLE_OF_SUBCATEGORY[p.subcategory] !== role) {
      excluded.push({ partner: p, reason: 'Different role' });
      continue;
    }
    const availability = dates.length ? dates.reduce((acc, d) => acc + availabilityFor(p, d, start, end), 0) / dates.length : 0.5;
    if (availability === 0) {
      excluded.push({ partner: p, reason: `Not free on ${dates.map(formatDate).join(', ')}` });
      continue;
    }
    const distanceKm = haversineKm(origin, p);
    const components: ScoreComponents = {
      fit: fitFor(line.subcategory.value, p.subcategory),
      distanceKm: Math.round(distanceKm * 10) / 10,
      distance: Math.max(0, 1 - distanceKm / MAX_USEFUL_KM),
      availability,
      reliability: p.reliability / 5,
      overBudget: budget !== null && p.dayRate > budget,
    };
    const weighted =
      WEIGHTS.fit * components.fit +
      WEIGHTS.availability * components.availability +
      WEIGHTS.distance * components.distance +
      WEIGHTS.reliability * components.reliability;
    const total = Math.round((components.overBudget ? weighted * OVER_BUDGET_PENALTY : weighted) * 1000) / 1000;
    ranked.push({ partner: p, total, components, explanation: explain(components, line.subcategory.value, p, budget) });
  }

  ranked.sort(
    (a, b) =>
      b.total - a.total ||
      b.partner.reliability - a.partner.reliability ||
      a.components.distanceKm - b.components.distanceKm ||
      a.partner.name.localeCompare(b.partner.name),
  );

  return { ranked: ranked.slice(0, limit), excluded, distanceApproximate: !origin.known };
}

/** Builds the one-liner strictly from score components, ordered by weight. */
export function explain(c: ScoreComponents, requested: Subcategory | null, p: Partner, budget: number | null): string {
  const parts: string[] = [];

  if (c.fit === 1) parts.push(`Exact ${SUBCATEGORY_LABEL[p.subcategory]} match`);
  else if (c.fit === 0.7) parts.push(`${SUBCATEGORY_LABEL[p.subcategory]}, any specialty accepted`);
  else parts.push(`${SUBCATEGORY_LABEL[p.subcategory]}, not ${requested ? SUBCATEGORY_LABEL[requested] : 'the requested type'}`);

  if (c.availability === 1) parts.push('free for the whole slot');
  else if (c.availability >= 0.75) parts.push('free on most days');
  else parts.push('only partly free in that slot');

  if (c.distanceKm < 3) parts.push(`${c.distanceKm} km away, very close`);
  else if (c.distanceKm < 8) parts.push(`${c.distanceKm} km away`);
  else parts.push(`${c.distanceKm} km away, a long trip`);

  const r = p.reliability.toFixed(1);
  if (p.reliability >= 4.5) parts.push(`${r} reliability, excellent`);
  else if (p.reliability >= 4.0) parts.push(`${r} reliability`);
  else parts.push(`${r} reliability, below average`);

  if (c.overBudget && budget) parts.push(`₹${p.dayRate}/day is over your ₹${budget} budget`);

  return parts.join('; ') + '.';
}
