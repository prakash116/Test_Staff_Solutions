// Checks the ranking claims made in README.md against the real scorer.
import partners from '../src/data/partners.json';
import { parseWithRules } from '../src/lib/parse';
import { rankPartners } from '../src/lib/score';
import type { DraftRequest, Partner } from '../src/lib/types';
import { validateParse } from '../src/lib/validate';

const today = new Date(2026, 9, 27);
const P = partners as Partner[];

function draftFor(text: string, fix: Partial<Record<'date' | 'startTime' | 'endTime' | 'location', string>> = {}): DraftRequest {
  const d = validateParse(parseWithRules(text, today), today, text, 'rules').drafts[0];
  for (const [k, v] of Object.entries(fix)) (d as any)[k] = { value: v, confidence: 'high' };
  return d;
}

function show(label: string, d: DraftRequest, lineIdx = 0) {
  const r = rankPartners(d, d.lines[lineIdx], P);
  console.log(`\n${label}`);
  r.ranked.forEach((x, i) => console.log(`  ${i + 1}. ${x.partner.name} ${x.total} avail=${x.components.availability.toFixed(2)} :: ${x.explanation}`));
  const sameRole = r.excluded.filter((e) => e.reason !== 'Different role');
  if (sameRole.length) console.log('  excluded:', sameRole.map((e) => `${e.partner.name} (${e.reason})`).join('; '));
}

show('#1 chefs', draftFor('Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area.'));
show('#2 on 25 Nov', draftFor('1 tandoor chef, 25th October, 11am-4pm, Rajouri Garden.', { date: '2026-11-25' }));
show('#3 cleaners', draftFor('Deep cleaning crew of 3 for Sunday morning, Pitampura outlet.'));
show('#4 waiter', draftFor('Waiter, 3 din ke liye, 28 se 30 October, shaam 6 baje se, Karol Bagh.'));
show('#8 any chef, Sat 6-11 PM', draftFor('Need a cook, budget max 1500 per day, Lajpat Nagar, this weekend', { startTime: '18:00', endTime: '23:00' }));
show('#10 pastry Fri 10-6, CP', draftFor('Cancel my last request and book a pastry chef instead for Friday.', { startTime: '10:00', endTime: '18:00', location: 'Connaught Place' }));
