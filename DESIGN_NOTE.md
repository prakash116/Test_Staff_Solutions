# Design note

## Parse output schema, and why

Every extracted field is a `Field<T>`: `{ value, confidence, reason?, suggestions? }`. Confidence is one of `high`, `medium`, `low`, `missing`. A draft has `lines[]` (each `role`, `subcategory`, `count`), `date`, `endDate`, `startTime`, `endTime`, `location`, `budgetPerDay`, `notes[]`. A parse result is `{ intent, drafts[] }` so one message can become two bookings (request 9) or carry a cancel intent (request 10).

Why per-field confidence instead of one overall score: the review screen has to decide *which row* to make amber, and the owner has to know *why*. "The parse is 70% confident" tells him nothing he can act on. "End time: 11 PM. No end time given, assumed a 5-hour shift" is a question he can answer in one tap. `suggestions` exist so the model's second-best guesses become the first chips in the picker instead of being thrown away.

Why `role` and `subcategory` both exist: scoring uses role as a hard filter and subcategory as a soft fit. "Any chef" is a legitimate, explicit answer (value null, confidence high), and the schema has to distinguish that from "we don't know yet" (value null, confidence missing).

## How a field becomes uncertain

The parser assigns confidence by *how* it found the value, not by a probability: explicit text is `high`; an inference with one obvious reading ("evening" to 6 to 10 PM, "CP" to Connaught Place) is `medium`; a guess with real alternatives ("weekend", a missing end time, "6 to 11" with no AM/PM) is `low`; absent is `missing`. Then the validator, which trusts neither parser nor model, applies its own checks and can only lower confidence: a date in the past, an end time before the start, an area we do not serve, a count outside 1 to 20. The validator is the only thing the UI reads, so a hallucinated enum value or a string count never reaches a screen.

The review screen's rule is simple: `missing` and `low` block, `medium` warns, `high` is quiet. Blocking on `medium` was tried first and rejected: request 3 would then ask about "morning", which the owner clearly meant, and the screen filled with questions nobody needed.

## Review UI: taps and attention

The first design was a form: every field an editable input. Rejected, because a form gives no signal about which fields the app is unsure of, and the owner's eye has nowhere to go. The second was chat-style follow-up questions, one at a time. Rejected because it is serial (request 7 would take five round trips) and the owner never sees the whole booking in one place.

What shipped: a plain-English readback sentence at the top (the one thing he must read), then rows grouped Who / When / Where. Uncertain rows are amber with the question in plain words and a "Set" or "Check" tag. Tapping a row opens a bottom sheet whose first group is "Most likely", pre-populated from `suggestions`, so the common fix is exactly two taps: open, pick. Fixing a wrong value that the parser was confident about is the same two taps. Adding a second staff type is one tap plus a pick.

What stops a careless confirm: the "Find staff" button is locked while any question is open, and pressing it anyway scrolls to the summary and flashes it instead of doing nothing. On the matches screen the final confirm is press-and-hold, which costs 0.7 seconds of attention and cannot happen by brushing the screen. The summary sentence sits directly above the hold button.

## Scoring

`total = 0.40 × fit + 0.25 × availability + 0.20 × distance + 0.15 × reliability`, then × 0.85 if the partner's day rate exceeds a stated budget.

- Hard filters first: wrong role, or zero overlap with the requested window on any requested day. A filtered partner is listed with the reason, which feeds the "nobody matches" state.
- `fit`: 1.0 exact subcategory, 0.7 when the owner said "any", 0.35 same role but a different specialty. Highest weight because the wrong cuisine is useless no matter how close or reliable.
- `availability`: 1 if the window is fully covered, 0.5 partial, averaged over days. Second because a partly free partner creates ops work.
- `distance`: linear from 1 at 0 km to 0 at 15 km, area centroid to partner home. Matters for punctuality but Delhi is small enough that it should rarely override skill.
- `reliability`: rating / 5. Lowest weight, deliberately a tiebreaker, because all seeded partners sit between 3.7 and 4.9 and it should not dominate.
- Ties: reliability, then distance, then name, so the order is stable and deterministic.

The explanation is a template over the components: fit sentence, availability sentence, rounded km, rating, budget flag. The model never writes it.

## The out-of-scope pieces, if this were real

- **Backend and auth.** The parse call moves to a server that holds the API key, logs prompts and outputs for review, and returns the validated draft. The client keeps the validator anyway as defence in depth.
- **Partner side.** A partner app receiving offers with accept / decline and a hold timer. Availability becomes a calendar the partner edits, not a weekly template.
- **Push.** Expo Notifications with a server-side send on confirm, cancel, and partner acceptance. The toast in this build is exactly where that hook goes.
- **Auto-replacement.** On a partner cancel, re-run `rankPartners` with the cancelled partner excluded and the same draft, offer the next candidate to the owner with a single accept tap, and only escalate to ops if nobody scores above a floor.
- **Voice.** Speech-to-text into the same text box; nothing downstream changes.

## What breaks first at 10,000 partners

Scoring every partner in JavaScript on the phone. Today it is a linear scan with a haversine per partner per staff line, and the roster is a JSON file in the bundle. At 10,000 that is still fast enough to compute, but the bundle size, the per-day availability expansion, and shipping the whole roster to every owner's phone all break before the arithmetic does. The fix is to move ranking server-side and pre-filter in the database: index by subcategory, then by availability on the requested dates, then a geo index for the radius, and only score the few hundred that survive. The weights and explanation builder stay exactly as they are; they just run on a shortlist instead of a full scan. The second thing that breaks is reliability as a single number: at scale it needs recency weighting and a minimum job count before a 5.0 from two jobs can outrank a 4.7 from two hundred.
