# AI usage note

This file was drafted by Claude Code during the build session and should be edited into the candidate's own voice before submission. Every claim below reflects what actually happened in that session.

## Tools used

- **Claude Code (Claude Fable 5.1)** in VS Code, for the whole build: scaffolding the Expo project, writing the parser, validator, scorer, screens and tests, running the typechecker and tests, and drafting the README and design note.
- **Expo CLI** (`create-expo-app`, `expo install`) for scaffolding and SDK-compatible dependency resolution.
- **Jest via `jest-expo`** for the two required tests.

## How it was directed

The assignment PDF was given to the model with explicit constraints: Expo, frontend only, no Redux or Zustand, JSON dummy data, animations and icons. The model made the architectural choices (per-field confidence schema, validator as the only path to the UI, template-built explanations, press-and-hold confirm) and surfaced them in the design note so they can be defended line by line.

Verification was mechanical, not trust-based: `tsc --noEmit`, `jest`, and a smoke script (`npm run smoke`) that runs the parser over all ten test requests and prints every field with its confidence. The first smoke run exposed a real bug: the count regex missed "2 Chinese chefs" because it only matched a number directly before the noun, so request 1 came out as "plural, how many?" with low confidence. That was fixed and rerun before any screen was built.

## One suggestion rejected, and why

The Claude API reference loaded during the session recommends calling Claude through the official `@anthropic-ai/sdk` package for any TypeScript project. That was rejected for this app. The SDK expects Node-style stream and fetch shims that Expo Go does not provide, the LLM path is optional and off by default, and the call is a single JSON request with no streaming or tool use. A 30-line `fetch` in `src/lib/llm.ts` does the job, keeps the bundle small, and avoids a dependency that would have needed a development build just to run. The trade-off is losing typed errors and automatic retries, which is acceptable because every failure already falls back to the rule parser.

A second alternative was weighed before the review screen was written: block on `medium` confidence as well as `low` and `missing`. It was not built, because request 3 would then ask about "morning", which the owner obviously meant, and the screen would fill with questions nobody needed. `medium` shows an amber dot and the reason but does not block.
