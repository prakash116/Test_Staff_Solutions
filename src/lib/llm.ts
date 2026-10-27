// Parse entry point. Uses the hosted model when a key is configured, and the
// rule engine otherwise or on any failure. Both paths end in validateParse.
//
// Note: this calls the Claude API directly from the device with fetch, not the
// Anthropic SDK, because the SDK needs Node stream shims that Expo Go does not
// ship. Shipping an API key inside a mobile bundle is not acceptable for a real
// product; the design note covers moving this behind a backend.

import { parseWithRules } from './parse';
import type { ParseResult } from './types';
import { validateParse } from './validate';
import { toISODate } from './dates';

const API_KEY = process.env.EXPO_PUBLIC_LLM_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_LLM_MODEL || 'claude-opus-5-5';

export const llmEnabled = Boolean(API_KEY && API_KEY.length > 10);

const SYSTEM = `You extract restaurant staffing requests (Delhi, India; English or Hinglish) into JSON.
Return ONLY a JSON object: {"intent": "book"|"cancel_and_book"|"cancel_only"|"unclear", "drafts": Draft[]}.
Draft: {"lines": Line[], "date": F<ISO yyyy-mm-dd>, "endDate": F<ISO|null>, "startTime": F<"HH:MM">, "endTime": F<"HH:MM">, "location": F<area name>, "budgetPerDay": F<number|null>, "notes": string[]}.
Line: {"role": F<"chef"|"helper"|"waiter"|"cleaner"|"bartender">, "subcategory": F<"chinese_chef"|"tandoor_chef"|"continental_chef"|"south_indian_chef"|"pastry_chef"|"kitchen_helper"|"waiter"|"deep_cleaner"|"bartender">, "count": F<integer>}.
F<T> = {"value": T|null, "confidence": "high"|"medium"|"low"|"missing", "reason"?: string, "suggestions"?: T[]}.
Rules: never invent a value; use null + "missing" and a short reason instead. Use "low" when you guessed (e.g. "weekend" -> Saturday) and list alternatives in suggestions. Use "medium" for inferred values (e.g. "evening" -> 18:00-22:00). Split into separate drafts only when different staff are needed on different days.`;

export async function parseRequest(text: string, today: Date = new Date()): Promise<ParseResult> {
  if (llmEnabled) {
    try {
      const raw = await callClaude(text, today);
      return validateParse(raw, today, text, 'llm');
    } catch (err) {
      console.warn('[parse] LLM failed, using rules', err);
    }
  }
  // Small artificial delay so the loading state is visible and honest about
  // what a network round trip would feel like.
  await new Promise((r) => setTimeout(r, 650));
  return validateParse(parseWithRules(text, today), today, text, 'rules');
}

async function callClaude(text: string, today: Date): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY as string,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Today is ${toISODate(today)} (${today.toLocaleDateString('en-IN', { weekday: 'long' })}).\nRequest: ${text}` }],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = (await res.json()) as { stop_reason?: string; content?: Array<{ type: string; text?: string }> };
  if (data.stop_reason === 'refusal') throw new Error('LLM refused');
  const textBlock = data.content?.find((b) => b.type === 'text')?.text ?? '';
  const json = textBlock.slice(textBlock.indexOf('{'), textBlock.lastIndexOf('}') + 1);
  return JSON.parse(json);
}
