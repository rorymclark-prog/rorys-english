# Refined studio branch

The first implementation from the 28 October 2026 app audit, based on main `64cfd84`.

## What changes

- Today has a distinctive task card, a short lesson focus and a visible holiday state. Start opens the exact named assignment. Operational reset suffixes are shortened for display; saved titles, dates, full instructions and original records are retained.
- Speak has illustrated starting points using existing conversation modes. A known current unit is the initial student choice. Teacher tests and requested lesson/guided modes keep their existing paths.
- Feedback puts filters and a source-linked next step before the results. Entries expand individually; exact review/writing links open their target. Phone sentence cards retain every sentence and all saved checks, with the full table still available. Full original/corrected/example paragraphs remain underneath.
- Saved work has title/content search, work-type filters, recent ordering and a phone detail/back view that keeps the current search.
- Unsent exercise answers, document questions, teacher feedback, learning replies and new teacher reviews have identity- and source-scoped device drafts. An uncertain send keeps its exact payload and retry ID; confirmed receipt clears the draft.
- Student speaking checkpoints captions and bounded sample chunks on the device. Recovery is explicit, uses the original session ID and frozen payload, and never automatically replays paid feedback analysis. A hard close can lose the final uncommitted audio chunk; unavailable sound remains distinct from saved captions.
- A corrupt queued item is retained in a downloadable local recovery copy while other valid answers continue sending.
- Desktop and phone names agree for Speak, Lessons and Feedback. Large text can wrap the longer phone navigation labels without overlapping.

## What remains

The current identity, appearance choices, avatars, practice rings and counting rules, full feedback, handwriting uncertainty, original/revision relationships, teacher checks and learner/parent/teacher permissions remain. No new task, deadline, grade, publication, billing rule or provider configuration is introduced. The backend is unchanged.

This is the first stage. A delayed-recall scheduler, a new teacher attention queue, a parent overview redesign, server-side document jobs, a new backend and account-wide voice budgets are separate future work.

## Verification

Run `npm test`, `npm run lint`, `npm run build` and `git diff --check`.

Local browser checks use a loopback-only synthetic API, with no real learner work or paid model requests: exact assignment navigation; phone sentence cards; feedback reply persistence and receipt; exercise/question persistence across reload; library search/detail/back; light/dark and 320px extra-large text. Current source and test fixtures retain privacy and uncertain-reading safeguards.

The new recovery sequencer has injected-service tests for exact receipts, immutable retries, stale account/session continuations, paid-request suppression, audio ordering, unavailable audio and cleanup retry. These checks do not certify physical iPhone/iPad recording, OS suspension, long recordings or real online call-tab audio. Confirm those on supported devices before treating the recovery behaviour as fully device-verified.

Keep this branch for review. It has not been merged into main or deployed to the production app.
