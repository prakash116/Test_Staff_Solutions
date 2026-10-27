import { parseWithRules } from '../src/lib/parse';
import { validateParse, blockers, summarize } from '../src/lib/validate';
import { rankPartners } from '../src/lib/score';
import partners from '../src/data/partners.json';

const today = new Date(2026, 9, 27);
const tests = [
  'Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area.',
  '1 tandoor chef, 25th October, 11am-4pm, Rajouri Garden.',
  'Deep cleaning crew of 3 for Sunday morning, Pitampura outlet.',
  'Waiter, 3 din ke liye, 28 se 30 October, shaam 6 baje se, Karol Bagh.',
  'Need someone for tomorrow evening.',
  '2 chefs, Chinese, CP, Sat',
  'Chef for party next week',
  'Need a cook, budget max 1500 per day, Lajpat Nagar, this weekend',
  'Need 2 chefs Saturday and 1 cleaner Sunday, both at Saket.',
  'Cancel my last request and book a pastry chef instead for Friday.',
];

for (const [i, t] of tests.entries()) {
  const res = validateParse(parseWithRules(t, today), today, t, 'rules');
  console.log(`\n#${i + 1} ${t}\n  intent=${res.intent} drafts=${res.drafts.length} warnings=${JSON.stringify(res.warnings)}`);
  for (const d of res.drafts) {
    console.log('  summary:', summarize(d));
    for (const l of d.lines) console.log('   line:', JSON.stringify({ role: l.role, sub: l.subcategory, count: l.count }));
    for (const k of ['date', 'endDate', 'startTime', 'endTime', 'location', 'budgetPerDay'] as const) {
      const f = d[k];
      if (f.confidence !== 'high' || k === 'date') console.log(`   ${k}:`, JSON.stringify(f));
    }
    console.log('   notes:', d.notes.join(' | '), ' blockers:', blockers(d).map((b) => b.label).join(', ') || 'none');
    if (blockers(d).length === 0) {
      const r = rankPartners(d, d.lines[0], partners as any);
      console.log('   top:', r.ranked.map((x) => `${x.partner.name} ${x.total} :: ${x.explanation}`).join('\n        '));
    }
  }
}
