import { describe, expect, it } from '@jest/globals';
import { blockers, validateDraft, validateParse } from '../lib/validate';

const today = new Date(2026, 9, 27); // Tue 27 Oct 2026

describe('validateDraft', () => {
  it('normalises a sloppy LLM payload and flags what needs the owner', () => {
    const sloppy = {
      lines: [
        // Wrong-case role, string count, subcategory wins over role.
        { role: { value: 'Chef', confidence: 'high' }, subcategory: { value: 'tandoor_chef', confidence: 'high' }, count: { value: '2', confidence: 'high' } },
        // Role with a single subcategory needs no question.
        { role: { value: 'cleaner', confidence: 'medium' }, subcategory: { value: null, confidence: 'missing' }, count: 'three' },
      ],
      date: { value: '2026-10-25', confidence: 'high' }, // already passed
      endDate: { value: '2026-10-20', confidence: 'high' }, // before start
      startTime: { value: '18:00', confidence: 'high' },
      endTime: { value: '17:00', confidence: 'high' }, // not after start
      location: { value: 'connaught place', confidence: 'high' },
      budgetPerDay: { value: '1500', confidence: 'high' },
      notes: ['For a party', 42, null],
    };

    const d = validateDraft(sloppy, today, 'raw text');

    expect(d.lines[0].role.value).toBe('chef');
    expect(d.lines[0].subcategory.value).toBe('tandoor_chef');
    expect(d.lines[0].count.value).toBe(2);

    expect(d.lines[1].subcategory.value).toBe('deep_cleaner');
    expect(d.lines[1].count.value).toBe(1);
    expect(d.lines[1].count.confidence).toBe('medium');

    expect(d.date.value).toBe('2026-10-25');
    expect(d.date.confidence).toBe('low');
    expect(d.date.suggestions).toContain('2026-11-25');

    expect(d.endDate.value).toBeNull();
    expect(d.endTime.confidence).toBe('low');

    expect(d.location.value).toBe('Connaught Place');
    expect(d.budgetPerDay.value).toBe(1500);
    expect(d.notes).toEqual(['For a party']);

    expect(blockers(d).map((b) => b.label)).toEqual(['Date', 'End time']);
  });

  it('never trusts garbage: null input still yields one reviewable draft', () => {
    const res = validateParse(null, today, 'hello', 'llm');
    expect(res.intent).toBe('book');
    expect(res.drafts).toHaveLength(1);
    const d = res.drafts[0];
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0].subcategory.confidence).toBe('missing');
    expect(d.date.confidence).toBe('missing');
    expect(d.location.confidence).toBe('missing');
    const labels = blockers(d).map((b) => b.label);
    expect(labels).toEqual(expect.arrayContaining(['Staff type', 'Date', 'Start time', 'End time', 'Area']));
  });

  it('downgrades an unknown area instead of dropping it', () => {
    const d = validateDraft({ location: { value: 'Gurgaon', confidence: 'high' } }, today);
    expect(d.location.value).toBe('Gurgaon');
    expect(d.location.confidence).toBe('low');
  });
});
