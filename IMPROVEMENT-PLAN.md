# Improvement Plan — Rory's English

From a 17-agent audit + live web research (2026-07-18). Findings were adversarially
verified before landing here. **Everything in "Done this pass" is already shipped.**
This file is the working backlog; MASTERPLAN.md remains the source of truth for what exists.

---

## ✅ Done this pass (shipped + verified)

| Fix | Severity | Note |
|---|---|---|
| Ferdi score message crashed (`weakest` ReferenceError) | HIGH bug | encouragement message was silently blank; verified fixed in-browser |
| Ferdi contraction grading broken (ASCII-only apostrophe regex) | HIGH bug | iOS smart-quotes (`would've`) marked correct answers wrong; verified fixed |
| Self-XSS via typed answer in checkS2 feedback (both tools) | MED security | now `escHtml()`-escaped |
| SW never registered on fast cached visits (missed `load`) | HIGH bug | now registers immediately if `readyState==='complete'` |
| Offline fallback served wrong page / hard-errored | HIGH bug | now serves the student's own page → root → inline offline notice; never `undefined` |
| AI quota burned even with no key / on errors | HIGH bug | only charges a slot on a successful reply, under a lock |
| Rate-limit had no lock (concurrent bypass) | HIGH sec | `LockService` around the daily counter |
| Drive auto-share swept whole Drive incl. financial Sheets & name collisions | HIGH sec | excludes Sheets/Scripts; name-token match (kills `Valentina`); `[private]` opt-out |
| Update toast clipped under the notch; AI coach silent when unconfigured; privacy microcopy | MED | all addressed |

---

## ✅ Done — third pass (this session)

- **Record-and-compare speaking tool** (was #8). New `/s/<code>/speak` screen (Study-tab card):
  hear a model sentence (TTS) → record yourself (`MediaRecorder`, mic audio stays in-memory,
  never leaves the device) → play both back to self-compare. No scoring. Seeded 6 B1 lines per
  unit (`speakingLines` in units.json). Verified live.
- **Vary the example sentence (was #6).** Both tools: each vocab word now carries 2–3 example
  sentences, rotated on repeat encounters. Back-compatible with the old single-string slot.
- **TTS reads parentheticals fix.** `speak()` strips `(...)` so "racist (adj.)" isn't spoken "adj".
- **Study-tool drift fixed** — Valentin's due-badge updates per answer; example word bolded in both.
- **Apps Script hardening:** AI is now **student-code-only** (parent codes can read progress but
  can't spend the quota — verified); rate slot charged under a lock and only on success; a
  `max_tokens` cut-off adds a "…(cut off — ask me to continue)" note; old `ai_<code>_<date>`
  counters auto-pruned; `unshareStale_()` maintenance function revokes sharing on files that no
  longer match a student.
- **deploy-pages.sh** now uses portable `perl -i` (was BSD-only `sed -i ''`).
- **Docs** (README, HANDOVER, apps-script README) updated to the current system.

## ✅ Done — second pass (this session)

- **CORS POST migration (was #7, the headline).** Verified live that Apps Script returns
  CORS-readable JSON on a simple `text/plain` POST. `remote.ts` now POSTs (JSONP kept as
  fallback); `Code.gs doPost` routes `action=progress|resources|ai`. Result: **no URL-length
  limit** (writing coach raised 1500→4000 chars; `AI_MAX_INPUT` 2000→6000), secret + student
  text now travel in the **body not the URL**, and multi-turn is unconstrained. Verified: a
  2,626-char AI body delivered; resources/progress read via POST live.
- **Writing feedback → one focus-error (was #2).** `WRITING_SYSTEM` rewritten: one win, the
  single most useful fix framed as a reusable strategy, effort-based praise — not a list.
- **Today screen trimmed (was #3).** Dropped the redundant "Open a study tool" card; Lessons +
  Progress now a compact 2-up row under the prominent tutor card. Verified live above the fold.

## 🔜 Next — high value, low/med effort

1. **Cross-unit spaced repetition (before Unit 11 ships).** *Research: high impact / M.*
   SR keys are per-unit (`re_sr_<code>_<unit>`), so moving to a new unit abandons the old
   schedule — words never resurface across units, defeating long-term retention. Move to a
   single per-student SR store keyed by word, or have the Today "words due" count aggregate
   across all units (it already scans all `re_sr_<code>_*` keys — extend the study tools to
   read due words from *all* units, not just the current one).

2. **AI writing feedback: one focus-error at a time.** *Research: high impact / S.*
   Evidence (Shintani & Ellis; growth-mindset feedback studies) says B1 learners improve most
   from **one** targeted correction framed as strategy, not a list framed as ability. Tighten
   `WRITING_SYSTEM`: pick the single highest-value pattern, explain the rule, give one rewrite,
   praise effort ("you're getting the hang of past tenses") not talent.

3. **Trim + reorganise the Today screen.** *Audit: med / S.*
   Up to 7 stacked cards push Coach/Resources/Progress below the fold on an iPhone SE — and
   those three have **no other entry point** (not in the 3-tab bar). Drop the redundant
   "Open a study tool" card (duplicates the Study tab + words-due card), and put
   Coach / Resources / Progress in one compact 3-icon row.

4. **Sync retry queue hardening.** *Audit: med / S.*
   Scope the queue key per student code; add a short cross-tab lock (localStorage timestamp)
   before claiming, so two open tabs can't double-POST duplicate rows; raise/period-signal the
   50-item cap instead of silently dropping the oldest.

5. **3-way SR self-rating (Again / Good / Easy).** *Research: med / S.*
   Binary correct/incorrect loses information. A quick self-rating after the reveal (classic
   SM-2 quality signal) schedules far more accurately. Small UI + a tweak to `srUpdate`.

6. **Vary the example sentence per word.** *Research: med / S.*
   Same sentence every time → students memorise the sentence, not the word. Store 2–3 examples
   per vocab entry and rotate; richer retrieval.

---

## 🧭 Bigger moves — worth it, higher effort

7. **Switch AI from JSONP-GET to CORS POST.** *Research: high value / M — CONFIRMED viable.*
   The technical lane **verified against the live deployment** that Apps Script web apps now
   return `Access-Control-Allow-Origin: *`, so the app can `fetch()` a POST and *read* the JSON
   response. This removes the writing-coach's ~1500-char URL limit (full essays), gets the
   secret + a minor's text **out of the URL** and into a request body, and enables real
   multi-turn tutor chat. Migrate `remote.ts` (`fetchAi`/`fetchProgress`/`fetchResources`) to
   POST; keep JSONP as a fallback. *This is the single most impactful technical upgrade.*

8. **Shadowing / record-and-compare speaking tool.** *Research: high impact / M.*
   Browser `SpeechRecognition` is **confirmed non-functional in an installed iOS PWA** (don't
   build ASR scoring). Instead: play a model sentence (TTS, already built) → student records
   themselves with `MediaRecorder` → plays both back to self-compare. No scoring, no backend,
   works offline. High value for speaking practice; matches the "no punishing red" ethos.

9. **Resource sharing: periodic un-share sweep.** *Audit: med.*
   `ANYONE_WITH_LINK` is set once and never revoked, so a one-time false-positive match stays
   public forever. Add a sweep (time-driven trigger) that un-shares any cached `shared_ids`
   no longer in the current candidate set.

---

## 📋 Housekeeping (low effort, do opportunistically)

- **Docs drift:** `apps-script/progress-sync/README.md` predates the resources + AI endpoints
  and omits the `ANTHROPIC_API_KEY` setup + `script.external_request` scope (HIGH cleanup).
  README/HANDOVER still describe the old "drag into a Shared folder" model — now it's
  auto-name-search. Fix all three.
- **Parent code = student code** for AI + resources reads. If parents shouldn't burn the AI
  quota or trigger sharing, gate `action=ai` to student codes only.
- **`callClaude_`** ignores `stop_reason` — a `max_tokens`-truncated reply looks complete.
  Append a "…(cut off)" hint when truncated.
- **`ai_<code>_<date>` Script Properties** accumulate forever — prune keys older than a few days.
- **`deploy-pages.sh`** uses BSD `sed -i ''` (fine on Rory's Mac; would fail on Linux CI).
- Vocab TTS reads parenthetical annotations aloud (e.g. "racist (adj.)" → speaks "(adj.)").
  Strip `(...)` before `speak()`.
- Rotate the shared secret periodically (it's public in the repo by design — documented).

---

## ✅ Research: validated "keep doing / not doing"

- **iOS web push** now technically works (incl. EU) but needs a backend → **keep `.ics` reminders.**
- **Browser speech recognition** confirmed dead in iOS PWAs → the "not building ASR" call stands.
- **Apps Script quotas** safe with big headroom at current volume.
- **Models:** Haiku 4.5 stays right for word/tutor; Sonnet 4.6 fine for writing (optional bump
  to Sonnet 5 for the coach if desired).

_Sources gathered by the research lanes are in the workflow journal; key claims (CORS POST,
iOS SpeechRecognition, push) were verified against live behaviour, not just docs._
