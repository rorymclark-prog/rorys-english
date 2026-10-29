# Practice desk and private Lesson brief

The learner can open **Practice desk** from Today, the learning navigation or Menu. The existing `/s/<code>/study/` route now gathers exercises from recent saved writing feedback, above the existing optional unit tools. Rory can open **Lesson brief** at the top of a learner’s Learning dashboard.

## Learner practice

The desk reads at most eight recent eligible uploaded documents, with at most three detail requests at once. It uses existing, released practice feedback; it does not generate new exercises or call a model. Documents with prose-backed exercises are supported by the current `documentPractice` endpoint. Typed homework/reply exercises remain available beside their original feedback, outside this initial desk collection. Worksheet-only analyses without a prose original are not supported by that endpoint.

Cards distinguish first tries, retries, recently practised exercises and exercises to revisit after three Vienna calendar days. These are optional suggestions, with no due dates, mastery score or new ring credit. Repeating a prompt is practice, not a fresh independent retention assessment. A short set contains up to three prompts; filters and further sets remain optional.

Every attempt stays with its exact document, exercise and feedback version. Earlier answers, examples and attempt history stay hidden on entry. The existing device draft and request ID survive an uncertain save; only an exact confirmed receipt clears the draft and reveals the example. Open writing uses comparison with an example, not an automatic correctness mark. Teacher preview exposes prompts and choices without answer controls or writes. Account, source or version changes discard stale UI responses.

The collection is bounded and may omit older usable practice. Saved work retains all originals and their existing practice routes. Partial read failures are reported separately from a true empty collection.

## Private preparation

The Lesson brief collects explicit next-check wording from validated skill checks, checkpoints, lesson assessments, progress observations and private teaching reflections. It preserves source dates, help, strengths and uncertainty. Readable original evidence expands inline; it is not routed through the general feedback list, which deliberately excludes some private source types.

Rory selects one or two priorities, writes the exact opening, practice and fresh exit tasks, and sets support and optional reserve notes. The core defaults to 90 minutes, including the break; the phase total must match the chosen length. Reserve minutes are additional. The brief is a preparation aid, not a complete teaching pack or a booking.

The existing authenticated teacher save action stores the latest brief under `teacher-next-lesson-brief`, with `visibility: teacher`, `kind: test`, and `body.tutorPrivate.lessonBrief`. Earlier backend versions remain retained. The general feedback feed excludes it, and the evidence portfolio counts it only as preparation. Existing assessment, activity and memory readers do not treat it as learner evidence. No backend deployment or new credential is required.

Device drafts are learner- and teacher-session-scoped. An uncertain save stays frozen; retry checks the exact private readback before appending again. The teacher can download a private text copy. Source changes are flagged beside saved priorities, and a saved brief from a different unit shows a warning. A corrupt local draft has an explicit private recovery download and replacement control.

## Validation

- `npm test`: 466 passing tests, including scheduling, Vienna dates, bounded reads, release/source/version isolation, private-source validation, exact receipts, stale-response suppression, answer hiding and preparation-versus-assessment separation.
- `npm run lint`: TypeScript passes.
- `npm run build`: production build passes.
- `git diff --check`: passes.
- `scripts/qa-practice-loop.mjs`: loopback-only Chrome fixture with synthetic records, no external requests or model calls. Run a local development app with `NEXT_PUBLIC_SYNC_URL=http://127.0.0.1:4311 npm run dev -- --hostname 127.0.0.1 --port 4310`, then `node scripts/qa-practice-loop.mjs`. It checks learner isolation, hidden earlier answers, draft reload, lost receipts, immutable retries, open-answer comparison, the two-priority cap, private evidence, teacher save/readback, timing validation, preview denial and desktop/390px/320px Extra large layouts.

Browser checks use desktop Chrome emulation. They do not certify physical iPhone/iPad behaviour or live production backend operation. This branch changes no live learner records, assignments, feedback publication, provider caps or billing, and has not been merged or deployed to production.
