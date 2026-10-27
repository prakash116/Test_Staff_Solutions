import { describe, expect, it } from '@jest/globals';
import { explain, rankPartners, WEIGHTS } from '../lib/score';
import type { DraftRequest, Partner, StaffLine } from '../lib/types';

const allWeek = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i), [{ start: '08:00', end: '23:59' }]]));

const partner = (over: Partial<Partner>): Partner => ({
  id: 'x',
  name: 'X',
  subcategory: 'chinese_chef',
  area: 'Connaught Place',
  lat: 28.6315,
  lng: 77.2167,
  reliability: 4.5,
  completedJobs: 10,
  dayRate: 2000,
  weeklyAvailability: allWeek,
  blockedDates: [],
  avatarSeed: 'XX',
  ...over,
});

const line: StaffLine = {
  id: 'l1',
  role: { value: 'chef', confidence: 'high' },
  subcategory: { value: 'chinese_chef', confidence: 'high' },
  count: { value: 2, confidence: 'high' },
};

const draft: DraftRequest = {
  id: 'd1',
  raw: '',
  lines: [line],
  date: { value: '2026-10-31', confidence: 'high' }, // Saturday
  endDate: { value: null, confidence: 'high' },
  startTime: { value: '18:00', confidence: 'high' },
  endTime: { value: '23:00', confidence: 'high' },
  location: { value: 'Connaught Place', confidence: 'high' },
  budgetPerDay: { value: 1500, confidence: 'high' },
  notes: [],
};

describe('rankPartners', () => {
  const near = partner({ id: 'near', name: 'Near Exact', dayRate: 1400 });
  const far = partner({ id: 'far', name: 'Far Exact', lat: 28.75, lng: 77.05, dayRate: 1400 });
  const wrongCuisine = partner({ id: 'tandoor', name: 'Tandoor', subcategory: 'tandoor_chef', dayRate: 1400 });
  const wrongRole = partner({ id: 'waiter', name: 'Waiter', subcategory: 'waiter' });
  const blocked = partner({ id: 'blocked', name: 'Blocked', blockedDates: ['2026-10-31'], dayRate: 1400 });
  const partial = partner({ id: 'partial', name: 'Partial', weeklyAvailability: { '6': [{ start: '18:00', end: '21:00' }] }, dayRate: 1400 });
  const pricey = partner({ id: 'pricey', name: 'Pricey', dayRate: 2600, reliability: 4.9 });

  const { ranked, excluded } = rankPartners(draft, line, [far, wrongCuisine, wrongRole, blocked, partial, pricey, near], 10);
  const ids = ranked.map((r) => r.partner.id);

  it('hard-filters other roles and anyone not free, and explains why', () => {
    expect(ids).not.toContain('waiter');
    expect(ids).not.toContain('blocked');
    expect(excluded.find((e) => e.partner.id === 'waiter')?.reason).toBe('Different role');
    expect(excluded.find((e) => e.partner.id === 'blocked')?.reason).toMatch(/Not free on Sat 31 Oct/);
  });

  it('orders by the weighted score: exact + near + free beats far, partial and wrong cuisine', () => {
    expect(ids[0]).toBe('near');
    expect(ids.indexOf('near')).toBeLessThan(ids.indexOf('far'));
    expect(ids.indexOf('near')).toBeLessThan(ids.indexOf('partial'));
    expect(ids.indexOf('near')).toBeLessThan(ids.indexOf('tandoor'));
  });

  it('computes the total from the components with the published weights', () => {
    const top = ranked[0];
    const c = top.components;
    const expected = WEIGHTS.fit * c.fit + WEIGHTS.availability * c.availability + WEIGHTS.distance * c.distance + WEIGHTS.reliability * c.reliability;
    expect(top.total).toBeCloseTo(expected, 3);
    expect(c.fit).toBe(1);
    expect(c.availability).toBe(1);
  });

  it('penalises over-budget partners and says so in the explanation', () => {
    const p = ranked.find((r) => r.partner.id === 'pricey')!;
    expect(p.components.overBudget).toBe(true);
    expect(p.explanation).toContain('₹2600/day is over your ₹1500 budget');
    expect(ids.indexOf('near')).toBeLessThan(ids.indexOf('pricey'));
  });

  it('builds the explanation only from score components', () => {
    const text = explain(
      { fit: 1, distanceKm: 3.2, distance: 1 - 3.2 / 15, availability: 1, reliability: 0.92, overBudget: false },
      'chinese_chef',
      partner({ reliability: 4.6 }),
      null,
    );
    expect(text).toBe('Exact Chinese chef match; free for the whole slot; 3.2 km away; 4.6 reliability, excellent.');
  });

  it('breaks ties by reliability, then distance', () => {
    const a = partner({ id: 'a', name: 'A', reliability: 4.0, dayRate: 1000 });
    const b = partner({ id: 'b', name: 'B', reliability: 4.0, dayRate: 1000, lat: 28.64, lng: 77.22 });
    const c = partner({ id: 'c', name: 'C', reliability: 4.8, dayRate: 1000, lat: 28.64, lng: 77.22 });
    const equalDraft = { ...draft, budgetPerDay: { value: null, confidence: 'high' as const } };
    const r = rankPartners(equalDraft, line, [b, a, c]).ranked.map((x) => x.partner.id);
    expect(r[0]).toBe('c');
    expect(r.indexOf('a')).toBeLessThan(r.indexOf('b'));
  });
});
