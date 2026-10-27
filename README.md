# StaffUp: Smart Staff Request (owner flow)

A restaurant owner types what they need in plain language. The app turns it into a structured booking, shows what it understood, lets the owner fix anything in one or two taps, ranks the partners who fit, and confirms.

Built with Expo (SDK 58, React Native 0.88, TypeScript, Expo Router, Reanimated 4). Frontend only. State lives in one React context with a reducer; there is no Redux or Zustand, no backend, and no persistence by design.

## Setup

```bash
npm install --legacy-peer-deps
npx expo start
```

The `--legacy-peer-deps` flag is needed because Expo Router's web dependencies declare a `react-dom` peer that this mobile-only project does not install.

Scan the QR code with Expo Go on Android or iOS, or press `a` / `i` for an emulator. Every dependency is bundled with Expo Go, so no development build is needed.

Other commands:

```bash
npm test          # the two required tests (validator, scorer)
npm run typecheck # tsc --noEmit
npm run smoke     # runs the parser on all ten test requests and prints the result
npx tsx scripts/verify-readme.ts  # prints the rankings quoted in the results table
```

## Environment variables

The app works with no configuration. The built-in rule parser plays the role of the model, and the review screen says "Read by built-in rules" so nobody is misled.

To parse with Claude instead, copy `.env.example` to `.env` and set:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_LLM_API_KEY` | Anthropic API key. When set, requests go to the Claude API and the UI says "Read by Claude". Any failure falls back to the rules. |
| `EXPO_PUBLIC_LLM_MODEL` | Model id. Defaults to `claude-opus-5-5`. |

`.env` is git-ignored. Never commit a real key. Note that any `EXPO_PUBLIC_` variable is compiled into the app bundle, so this is only acceptable for a take-home; the design note describes moving the call behind a backend.

## How the flow works

1. **Request.** Home screen, one text box. The ten test requests are available as tap-to-fill chips so the recording is quick.
2. **Parse.** `src/lib/parse.ts` (rules) or `src/lib/llm.ts` (Claude) produces loose JSON. `src/lib/validate.ts` normalises it into a `DraftRequest` where every field carries `value`, `confidence` (`high`, `medium`, `low`, `missing`), a human `reason`, and optional `suggestions`.
3. **Review and correct.** `src/app/review.tsx`. A plain-English readback at the top, then one row per field. Amber rows are questions the owner must answer; tapping one opens a bottom sheet whose first row is the most likely answers. The continue button stays locked until every question is answered.
4. **Rank.** `src/lib/score.ts` scores partners on skill fit, availability, distance and reliability, and builds the one-line explanation strictly from those numbers. Top 5 per staff line.
5. **Confirm.** Press-and-hold to confirm. The booking appears in the requests list, and a mock notification toast (plus a console log line) stands in for push.

## Results on the ten test requests

Run on 27 Oct 2026 (a Tuesday) with the rule parser. "Blocked on" lists the questions the owner has to answer before the app will look for partners. Reproduce with `npm run smoke`.

| # | Request | What the app understood | Blocked on | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area. | 2 Chinese chefs + 1 kitchen helper, Sat 31 Oct, 6 PM to 11 PM, Connaught Place. All fields high confidence. | Nothing | Correct. Top match for chefs: Dorjee Lama (Paharganj, 1.4 km, score 97). Pema Bhutia, the highest-rated Chinese chef, is excluded because she is blocked on 31 Oct, and the screen can show why. |
| 2 | 1 tandoor chef, 25th October, 11am-4pm, Rajouri Garden. | 1 tandoor chef, 11 AM to 4 PM, Rajouri Garden. Date read as Sun 25 Oct. | Date | Correct, and the validator catches that 25 Oct has passed. The date sheet suggests Wed 25 Nov and 25 Oct 2027 first. On 25 Nov (a Wednesday), Mohd. Irfan ranks first; Balwinder Singh, the closest tandoor chef, is excluded because he does not work Wednesdays, so Rakesh Yadav is second despite 16 km and a 3.9 rating. |
| 3 | Deep cleaning crew of 3 for Sunday morning, Pitampura outlet. | 3 deep cleaners, Sun 1 Nov, Pitampura. "Morning" read as 8 AM to 12 PM at medium confidence, with the reason shown. | Nothing | Correct. Only 2 deep cleaners exist, so the matches screen says 2 of 3 slots can be filled and ops must fill the rest. |
| 4 | Waiter, 3 din ke liye, 28 se 30 October, shaam 6 baje se, Karol Bagh. | 1 waiter, Wed 28 Oct to Fri 30 Oct, from 6 PM, Karol Bagh. Count assumed 1 (medium, since "Waiter" is singular). End time defaulted to 11 PM at low confidence. | End time | Correct, with one honest guess. The app does not invent an end time silently; it asks, offering 9 PM, 11 PM and 2 AM. Amit Verma is blocked on 29 Oct, so he scores 0.67 availability and ranks below Rohit Bisht. |
| 5 | Need someone for tomorrow evening. | 1 person of unknown type, Wed 28 Oct, 6 PM to 10 PM (medium, from "evening"). No area. | Staff type, Area | Correct behaviour for an ambiguous request. Two taps to resolve: one on the staff row, one on the area row. |
| 6 | 2 chefs, Chinese, CP, Sat | 2 Chinese chefs, Sat 31 Oct, Connaught Place. Subcategory is medium because "Chinese" was detached from "chefs". "CP" expanded at medium confidence with the reason shown. | Start time, End time | Correct. Both medium fields show an amber dot and their reason but do not block. |
| 7 | Chef for party next week | 1 chef, cuisine unknown, note "For a party". Date is missing with the question "Which day next week?" and the seven days of next week as suggestions. | Staff type, Date, Start time, End time, Area | Correct. Five questions is a lot, but every one of them is a real gap in the message. Each is one tap. |
| 8 | Need a cook, budget max 1500 per day, Lajpat Nagar, this weekend | 1 chef, cuisine unknown, Lajpat Nagar, budget ₹1500/day. "This weekend" read as Sat 31 Oct at low confidence with Sun 1 Nov as the alternative. | Staff type, Date, Start time, End time | Correct parse. Picking "Any chef" is allowed. Partners over ₹1500/day are penalised by 15% and the explanation says so. Weak spot: with Saturday 6 to 11 PM, Priya Nair (₹2800, over budget) still ranks first because the only in-budget chef, Rakesh Yadav, is just partly free. The penalty is soft on purpose so the owner sees the option, but the ordering is arguable. |
| 9 | Need 2 chefs Saturday and 1 cleaner Sunday, both at Saket. | Split into two bookings: 2 chefs (cuisine unknown) Sat 31 Oct at Saket, and 1 deep cleaner Sun 1 Nov at Saket. A notice says the two will be confirmed one at a time. | Booking 1: Staff type, times. Booking 2: times. | Correct. After confirming the first, the done screen offers "Next: booking 2 of 2". |
| 10 | Cancel my last request and book a pastry chef instead for Friday. | Intent `cancel_and_book`. 1 pastry chef, Fri 30 Oct. The review screen shows a switch "Also cancel your latest request?" preset to on, naming the latest confirmed booking. | Start time, End time, Area | Correct. Cancellation only happens when the new booking is confirmed, so a half-finished flow never cancels anything. With the area set to Connaught Place, Joseph D'Souza (0.3 km) ranks first and Neha Kapoor second: her 4.9 rating does not beat 9.6 km of distance under these weights. |

Nothing here is reported as wrong, but several of these are honest guesses rather than certain reads, and the UI says so each time. The weakest results are 4 (the end time is invented, then asked about) and 7 (five questions).

## Known limitations

- **The rule parser is not a language model.** It handles the ten requests and obvious variations (number words, a few Hindi words, `am/pm` ranges, weekday names, explicit dates). Anything outside that vocabulary degrades to "missing" with a question, which is the safe failure, but a real deployment should use the LLM path.
- **"Next Saturday" is ambiguous** and read as the coming Saturday at medium confidence with the following week as a suggestion.
- **Availability on multi-day bookings is averaged** across days. A partner free two of three days scores 0.67, which is shown as "free on most days" rather than listing the day they miss.
- **A partner cannot be reused across staff lines** in the same booking, and partners are not marked busy after a booking, so two confirmed bookings can pick the same person for the same slot.
- **Distances are from area centroids**, not the restaurant's address. If the area is unknown, distance is measured from central Delhi and the screen says so.
- **The API key lives in the bundle** when the LLM path is enabled. Fine for a demo, not for a product.
- **No persistence.** Bookings reset when the app restarts.
- **Web is not a target.** Only Android and iOS were exercised.

## Project layout

```
src/app/            Expo Router screens: index, review, matches, done, requests
src/components/     UI pieces: FieldRow, OptionSheet, PartnerCard, HoldButton, Toast, SVG illustrations
src/lib/parse.ts    Rule-based parser (stands in for the LLM)
src/lib/llm.ts      Claude adapter with fallback to the rules
src/lib/validate.ts Validation layer, blockers, summary sentence
src/lib/score.ts    Scoring, ranking, explanation builder
src/data/           20 partners across 9 subcategories, 20 Delhi areas, 2 seed bookings
src/state/          BookingsContext (React context + reducer)
src/__tests__/      validate.test.ts, score.test.ts
scripts/smoke.ts    Prints parse results for the ten requests
DESIGN_NOTE.md      The two-page design note
AI_USAGE.md         Which AI tools were used and what was rejected
```
#   T e s t _ S t a f f _ S o l u t i o n s  
 