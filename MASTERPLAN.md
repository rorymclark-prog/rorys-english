# Rory's English — MASTERPLAN

> **The single source of truth for this project.** North star, manual, directory, status report, and roadmap in one. If you are a new person or AI assistant picking this up, **read this top to bottom** — it is written to let you continue seamlessly without any other context.
>
> **Maintained by:** Rory Clark (English tutor, Vienna). **Last updated:** 2026-05-31.
> **Companion docs:** [`HANDOVER.md`](HANDOVER.md) (operational runbook), [`README.md`](README.md) (how-to), [`apps-script/progress-sync/README.md`](apps-script/progress-sync/README.md) (sync deploy).

---

## 0. How to use this document

- **§1–§3** = the vision and the "why" (the north star).
- **§4–§7** = what exists today, exactly: architecture, file map, what works, what's been tested.
- **§8** = what's broken / known gaps.
- **§9–§11** = the roadmap, the backlog, and the dream scenario.
- **§12–§15** = the operating manual: how to run, deploy, add content, and hand off.
- **Appendices** = quick reference (URLs, codes, secrets-location, glossary, decision log).

If you change anything material, **update this file** and bump the date.

---

## 1. One-paragraph north star

**Rory's English is a private, mobile-first learning system for a small number of 1-on-1 English tutoring students.** Each student installs a phone app (a PWA) that holds their homework and tracks their progress. Practice happens in purpose-built interactive study tools. Everything a student does can flow into a per-student Google Sheet that acts as their permanent progress record, which over time becomes a rich learner-analytics hub (homework, quizzes, vocab, school tests, writing analysis, speaking analysis, mock tests). The long-term vision adds dashboards and a parents' view, so the people around each learner can see real, motivating progress — all built on free, no-backend, privacy-respecting infrastructure that one tutor can run and extend by editing data files or asking an AI assistant to build the next piece.

---

## 2. Who this is for (the humans)

| Person | Role | What they need from the system |
|---|---|---|
| **Rory** | The tutor / owner / author | Add content easily (no coding), see each student's progress, run it for free, extend it with AI help. |
| **Ferdi** | Student, 14, A2–B1, textbook **MORE! 4**, current unit "A Fair World" (Unit 10) | Daily homework + study practice on his phone; gentle motivation; nothing embarrassing. |
| **Valentin** | Student, B1, textbook **way2go!** | Same, his own content, fully isolated from Ferdi. |
| **Parents** *(future)* | Guardians of minors | A simple read-only view of their child's progress (see §9 / backlog). |

> Earlier drafts also included **Serban** (an adult learner with Down syndrome needing a stripped-down, picture-led, celebration-heavy mode). He was **dropped** from the current scope but the idea is preserved in the backlog (§10) because the "different profile, same shell" pattern may return.

---

## 3. Principles (the non-negotiables — every decision serves these)

1. **Mobile-first, one-handed.** Phone is the primary device. Big tap targets (≥44px), thumb-reachable nav, readable at arm's length.
2. **Installable + offline.** Add to Home Screen on iOS/Android, launches full-screen, works offline after first load.
3. **No passwords for students.** Each student's private URL *is* the key (`/s/<code>`). No sign-up, no email, no reset burden. This is intentional — **do not "fix" it.**
4. **Per-student isolation.** A student only ever sees their own content. Unknown code → 404.
5. **Rory authors content, not code.** Content lives in JSON / HTML files. Adding a unit, homework week, or study tool is a data edit, never a component edit.
6. **Free + no backend (v1).** Static hosting, device-local storage, and a free Google Apps Script for optional sync. No servers, no paid APIs, no databases.
7. **Privacy-respecting, especially for minors.** No analytics, no trackers, `noindex`. Nothing leaves the device except the **opt-in** Google Sheets sync, which goes only to Rory's own Google account (his teaching record). Voice memos are never uploaded by the app.
8. **Warm, not childish.** These are teenagers. Encouraging, never shaming. "Try first, see why, it comes back."
9. **Fast on old phones.** Prioritise load speed and simplicity over visual flourish.

---

## 4. The architecture (how it all fits together)

```
                          ┌─────────────────────────────┐
   Student's phone        │   THE APP (PWA)             │
   ┌───────────────┐      │   Next.js static export     │
   │ Home-screen   │ ───▶ │   /s/<code>/                │
   │ icon (PWA)    │      │   Today · Study · Homework  │
   └───────────────┘      │   · Settings                │
                          │   progress → localStorage   │
                          └───────┬─────────────────────┘
                                  │ opens (new tab)         │ posts events (opt-in)
                                  ▼                         ▼
                  ┌───────────────────────────┐   ┌──────────────────────────────┐
                  │  STUDY TOOLS (static HTML) │   │  APPS SCRIPT WEB APP          │
                  │  /study-tools/*.html       │   │  doPost(): writes rows        │
                  │  vocab quiz, conditionals, │──▶│  setup(): provisions Sheets   │
                  │  traps, text-to-speech     │   └──────────────┬───────────────┘
                  └───────────────────────────┘                  │ writes
                                                                  ▼
                                            ┌─────────────────────────────────────┐
                                            │  GOOGLE DRIVE (Rory's account)        │
                                            │  Rory's English — Progress/           │
                                            │   Ferdi/  Ferdi — Progress (Sheet)    │
                                            │     tabs: Dashboard, Homework,        │
                                            │     Vocab & Quizzes, School Tests,    │
                                            │     Writing, Speaking, Mock Tests     │
                                            │   Valentin/ …                         │
                                            └─────────────────────────────────────┘
```

**Why these choices (the load-bearing decisions):**

- **Static site, no backend.** The whole app is shipped as static files. Progress is device-local (`localStorage`). This is what makes it free, fast, offline-capable, and privacy-safe.
- **The app does NOT contain a quiz engine.** Study practice lives in separate, self-contained HTML study tools, linked from the Study tab. This keeps the app shell simple and lets each unit have a purpose-built tool. (This was a deliberate pivot — see Decision Log.)
- **Sync without a server = Google Apps Script.** A static site can't safely hold Google credentials, so it POSTs results to an Apps Script Web App that writes into a Google Sheet. Free, no server, and it matches Rory's existing Apps Script skillset. The Sheet is the durable, queryable record and the future analytics hub.
- **Sub-path hosting.** It's deployed on GitHub Pages at `/rorys-english`, so the build is "base-path aware" (see §13 gotchas).

---

## 5. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React + TypeScript** | `output: "export"` → pure static |
| Styling | **Tailwind CSS** | palette: amber `#F59E0B`, navy `#1E3A5F`, burgundy `#7C2D3B`, cream `#FDF6EC`; system fonts |
| Storage | **localStorage** | source of truth on the device |
| PWA | hand-rolled **service worker** + per-student **manifests** + generated icons | offline + installable |
| Study tools | **plain self-contained HTML** (inline CSS/JS, no deps) | one file per unit, in `public/study-tools/` |
| Sync | **Google Apps Script Web App** → **Google Sheets** | optional, opt-in |
| Hosting | **GitHub Pages** (repo `rorymclark-prog/rorys-english`, branch `gh-pages`) | free; deploy via `npm run deploy` |
| Tooling | Node 25, npm; `clasp` for Apps Script; `gh` CLI (authed as `rorymclark-prog`); Pillow for icon gen |

---

## 6. Repository map (where everything lives)

```
rorys-english/
├─ MASTERPLAN.md                  ← THIS FILE (the source of truth)
├─ HANDOVER.md                    ← operational handover / sync runbook
├─ README.md                      ← how-to (add student/unit/tool, deploy)
│
├─ content/                       ← ALL TUTOR CONTENT (edit JSON, no code)
│  ├─ students.json               ← id, displayName, code, profile, units[]
│  ├─ ferdi/units.json            ← units + studyTools[] {title,url,blurb}
│  ├─ ferdi/unit10/homework.json  ← weeks → tasks[] (checkbox|written|voice)
│  └─ valentin/{units.json, unit05/homework.json}
│
├─ public/
│  ├─ study-tools/ferdi-unit10.html  ← the live study tool (quiz + TTS + sync hook)
│  ├─ sw.js                       ← service worker (offline; network-first for pages)
│  ├─ icons/                      ← icon-192/512, apple-touch-icon (generated)
│  ├─ m/<code>.webmanifest        ← per-student manifests (GENERATED, don't hand-edit)
│  ├─ manifest.webmanifest        ← root manifest (generated)
│  └─ robots.txt                  ← Disallow all (privacy)
│
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx, page.tsx, not-found.tsx, globals.css, icon.png
│  │  └─ s/[code]/                ← the student app (dynamic per code)
│  │     ├─ layout.tsx            ← validates code (404 if unknown) + per-student metadata/manifest
│  │     ├─ page.tsx              ← Today
│  │     ├─ study/page.tsx        ← Study (external tool links)
│  │     ├─ homework/page.tsx     ← Homework week list
│  │     ├─ homework/[week]/page.tsx  ← a homework week (tasks, autosave, complete)
│  │     └─ settings/page.tsx     ← Settings
│  ├─ components/                 ← AppShell, TabBar, Screen, StudentContext, SettingsContext,
│  │                                 ServiceWorkerRegister, InstallHint, OfflineBanner, Icons
│  ├─ components/views/           ← TodayView, StudyView, HomeworkListView, HomeworkWeekView, SettingsView
│  └─ lib/
│     ├─ types.ts                 ← the content contract (TS types)
│     ├─ content.ts               ← build-time fs loader (Server Components only)
│     ├─ storage.ts               ← localStorage (homework, streak, settings, progress summary)
│     ├─ sync.ts                  ← posts events to the Apps Script
│     ├─ ics.ts                   ← calendar (.ics) export for due dates
│     └─ celebrate.ts             ← confetti + haptics
│
├─ apps-script/progress-sync/
│  ├─ Code.gs                     ← setup() provisions Sheets; doPost() ingests
│  ├─ appsscript.json             ← web app manifest (ANYONE_ANONYMOUS, Drive+Sheets scopes)
│  ├─ .clasp.json                 ← links to the deployed script (scriptId)
│  └─ README.md                   ← deploy steps
│
├─ scripts/
│  ├─ gen-pwa.mjs                 ← generates per-student manifests (runs on predev/prebuild)
│  ├─ deploy-pages.sh             ← `npm run deploy`: build + push to gh-pages
│  └─ make-icons.py               ← one-time icon generator (Pillow)
│
├─ .env.local                     ← sync URL + secret (GIT-IGNORED, local only)
└─ .env.local.example             ← template
```

**Git model:** `main` = source. `gh-pages` = the built static site GitHub Pages serves (force-pushed by `npm run deploy`). Never hand-edit `gh-pages`.

---

## 7. Current status — what EXISTS and what's been TESTED

**Legend:** ✅ done & verified · 🟡 partial · 🔭 planned

### 7.1 The app
| Feature | Status | Tested how |
|---|---|---|
| Today screen (greeting, "due now" card, 7-day activity strip + current/best streak) | ✅ | browser-verified on mobile viewport |
| Study screen (cards link out to external HTML tools, open in new tab) | ✅ | verified link target `_blank`, correct URL |
| Homework: week list with per-week "ticked" count + completion ticks | ✅ | verified live |
| Homework week: checkbox / lined-textarea (debounced autosave) / voice-prompt tasks | ✅ | **persistence verified across reload** |
| "Mark complete" → green state + confetti + haptics | ✅ | verified click → flag + confetti DOM |
| Add homework due date to calendar (.ics download, RFC-5545 UTC stamp) | ✅ | button renders; ICS builder unit-correct |
| Settings: text size, light/dark/auto theme, reset (with confirm) | ✅ | verified |
| Settings: "Send my progress to Rory" (native share → WhatsApp, clipboard fallback) | ✅ | verified summary content |
| Per-student isolation; unknown code → 404 | ✅ | verified Ferdi≠Valentin; bad code → not-found |
| Install hint (Android prompt / iOS instructions, dismissible) | ✅ | code-reviewed |
| Offline banner (in normal flow, doesn't overlap headers) | ✅ | code-reviewed |

### 7.2 PWA / hosting
| Item | Status | Notes |
|---|---|---|
| Installable, full-screen, per-student manifests | ✅ | start_url/scope correct under `/rorys-english` |
| Offline after first load (service worker, network-first for pages) | ✅ | SW fix for sub-path verified live |
| Deployed live on GitHub Pages | ✅ | all key paths return 200 |
| One-command redeploy (`npm run deploy`) | ✅ | rebuilds + pushes gh-pages |
| Icons, robots `noindex` | ✅ | |

### 7.3 Study tool (Ferdi Unit 10)
| Item | Status |
|---|---|
| Vocab quiz (38 words, both directions, distractors from same list) | ✅ "Question 1 of 10" verified, scoring + warm feedback |
| Conditionals gap-fill (7 real Unit-10 sentences, lenient grading, explanations) | ✅ |
| German-trap drill (4 real pairs) | ✅ |
| Score summary, "Try again" | ✅ |
| **Text-to-speech** 🔊 (Web Speech API, speaks English en-GB, doesn't advance question) | ✅ **verified live** |
| Sends quiz scores to the Sheet | ✅ wired (URL + secret baked in, verified live) |

### 7.4 Google Sheets sync
| Item | Status |
|---|---|
| Apps Script written (setup + doPost), deployed via `clasp` | ✅ |
| `setup()` run, OAuth approved, per-student Drive folders + Sheets provisioned | ✅ (Rory approved consent) |
| Homework completion → row in **Homework** tab | ✅ **verified — real synced row screenshotted** |
| Quiz scores → **Vocab & Quizzes** tab | ✅ wired & live |
| Secret consistent in all 3 places (Code.gs, .env.local, study tool) = `re-sync-7b3h8d9f4` | ✅ verified |
| `.env.local` NOT leaked to git | ✅ verified |
| **Writing tab pipeline** (`scripts/analyse-writing.py` → Claude → Writing tab) | ✅ write/read plumbing verified; needs `ANTHROPIC_API_KEY` to run the AI step |
| Sheet tabs awaiting pipelines (School Tests, Speaking, Mock Tests) | 🟡 created, empty (Phase 2c–2d) |

### 7.5 Live coordinates
- **Live app:** https://rorymclark-prog.github.io/rorys-english/
- **Ferdi:** …/s/ferdi-7h3k/ · **Valentin:** …/s/valentin-q9m2/
- **Repo:** https://github.com/rorymclark-prog/rorys-english
- **Apps Script /exec:** `https://script.google.com/macros/s/AKfycbxzo-IunYLs8JA6R-ZCCrzIiB7Gt1gONgFJvYbnOc119XEnmaFaHp4AW2DYnJRS_lNsxQ/exec`

---

## 8. What does NOT work yet / known gaps

1. **Valentin has no study tool** — his Study card points at a placeholder URL. Ferdi's `ferdi-unit10.html` is the working template to clone.
2. **German vocab translations are AI best-effort** — the study tool shows a "double-check against the MORE! 4 glossary" note. Rory should verify.
3. **The rich Sheet tabs are empty** — School Tests, Writing, Speaking, Mock Tests have headers but no data pipeline yet (this is the big Phase-2 work, §9).
4. **No Progress section or parent view yet** — decided this session, now in the backlog (§10).
5. **Sync is best-effort, fire-and-forget** — uses `no-cors`, so the app can't read a success/failure response. `localStorage` remains the source of truth (so nothing is ever lost), but there is no retry/queue and no read-back. Fine for current scale; revisit if reliability matters.
6. **Secret is client-visible** — it ships in the page source (light anti-abuse, not real security). Acceptable for this low-stakes data, by design.
7. **Cross-origin browser automation is flaky** in the dev preview harness — not a product issue, just a note for whoever tests live URLs (use `curl` for live checks; use the local dev server for browser checks).

---

## 9. Roadmap (phased, in priority order)

### Phase 1 — Foundation ✅ DONE
The app, study tool, PWA, deployment, and Google Sheets sync are all built, deployed, and verified (see §7).

### Phase 2 — The progress hub becomes real (the next big push)
Turn the Sheet from "homework + quizzes" into a full learner record, and surface it.

- **2a. Read endpoint on the Apps Script.** ✅ **DONE.** `doGet` returns a progress snapshot as JSONP (CORS-free), resolves student OR parent code, secret-gated. Verified live.
- **2b. Writing-analysis pipeline.** ✅ **DONE.** `scripts/analyse-writing.py` (zero-dependency, stdlib only) scores a writing sample with Claude (`claude-sonnet-4-6`, tool-use for structured output, cached rubric) → CEFR, grammar/vocab/coherence /10, top error patterns, feedback → POSTs to the Apps Script (`type:"writing"`) which appends to the **Writing** tab. It then shows automatically in the Progress section + parent view. Run: `export ANTHROPIC_API_KEY=… ; python3 scripts/analyse-writing.py --student ferdi --file sample.txt --title "HW2 essay"` (add `--dry-run` to preview without writing). Write/read plumbing verified live; the AI step needs an `ANTHROPIC_API_KEY`.
- **2c. Speaking/audio-analysis pipeline.** Student records (voice memos, as today) → audio reaches the `recordings/` folder → transcribe → score fluency/pronunciation/grammar/vocab range → **Speaking** tab.
- **2d. School tests + mock tests.** Manual entry, or AI scores a photo/scan → **School Tests** / **Mock Tests** tabs.
- **2e. Dashboard.** Charts on the Sheet's Dashboard tab (levels over time, % learned, trends) and/or an in-app Progress view that reads via 2a.

### Phase 3 — Progress section + parent view ✅ DONE
- In-app **Progress section** (`/s/<code>/progress`, reached via a "See my progress" card on Today): summary tiles + per-tab tables (homework, quizzes, school tests, writing, speaking, mock) + a links shelf (`progressLinks` in students.json). Verified live.
- **Parent view** (`/p/<parentCode>`): read-only, no tab bar, follows OS theme, own private code that maps to the child's Sheet without exposing the student's app code. Verified live.
- *Remaining for Phase 3+:* populate the rich tabs (writing/speaking/school/mock) via Phase 2b–2d pipelines; charts.

### Phase 4 — Scale & polish
- More units + more study tools (clone the Ferdi pattern).
- Spaced-repetition review inside the study tools (highest learning ROI — see §10).
- Example sentences + audio per vocab item.
- Possibly: cloud sync upgrade (Supabase) only if/when the Apps Script approach is outgrown.

---

## 10. Backlog (agreed, parked — with the decisions already made)

These are captured so nothing is lost, with the **decision already taken** where one exists:

- **Progress section — "links shelf" first.** *Decision (this session):* start with just a place in the app to house links (e.g. a progress dashboard URL, the Google Sheet, resources) — like the study-tool cards but for progress. Live data dashboard comes later (needs the read endpoint, 2a).
- **Parent access — private parent link.** *Decision (this session):* when built, parents get a **code-in-URL read-only link** (e.g. `/p/ferdi-fam-x4k2`), **no passwords**, consistent with the student model. Real email/password login was **explicitly declined** (would need a backend, breaks the free/no-backend model).
- **The shared Netlify dashboard** (`ubiquitous-dragon-abc593.netlify.app`) — a React app Rory shared as an example of "the kind of thing the Progress section should hold / link to." Clarify what it is and whether to link it or fold its ideas in.
- **Spaced-repetition (SM-2) review** inside study tools — research-backed highest-value learning feature; per-word due-dates in localStorage, surfaced on Today.
- **Example sentences** per vocab word (static JSON) + reuse TTS to read them.
- **Listening practice** study tool (short clips + comprehension) — code is easy; sourcing/recording clips is the bottleneck.
- **Writing self-check** rubric on `written` homework tasks.
- **"Serban mode" / alternate profile** — picture-led, audio, celebration-heavy, no scoring, for a low-level or special-needs learner. The "different profile behind the same shell" pattern is preserved should it return.
- **Explicitly NOT doing:** leaderboards (demotivating 1-on-1), browser speech-recognition (poor non-native accuracy, mic permission for minors, not offline), web-push notifications (needs a backend — `.ics` reminders cover it).

---

## 11. The dream scenario (the destination)

> *A student opens the app on their phone each day. The home screen greets them, shows exactly what's due, and a gentle streak that makes the habit stick. Homework is a tap; written answers and voice prompts are built in. Study practice is a purpose-built tool per unit — vocab they can hear spoken, grammar that explains the "why," all warm and never shaming. Everything they do quietly lands in their own Google Sheet.*
>
> *Behind the scenes, that Sheet is a complete learner record: not just homework and quizzes, but their school test results, AI-analysed writing samples with CEFR levels and error patterns, speaking recordings scored for fluency and pronunciation, and mock-test breakdowns — building a longitudinal picture of exactly how each student is growing.*
>
> *Rory opens a dashboard and sees, per student, where they are and where they're stuck — and can act on it in the next lesson. Parents open their own private link and see a clean, encouraging summary of their child's progress, building trust and keeping families engaged.*
>
> *And the whole thing costs nothing to run, has no servers to maintain, keeps minors' data private, and can be extended — a new unit, a new study tool, a new analysis pipeline — by editing a file or asking an AI assistant to build the next piece. One tutor, a genuinely modern learning platform.*

---

## 12. Operating manual — running it day to day

**Local dev:**
```bash
cd /Users/roryclark/Claude/projects/rorys-english
npm install
npm run dev        # predev auto-generates manifests; open the printed localhost URL
```

**Build (static export to out/):**
```bash
npm run build      # prebuild runs gen-pwa; type-checks; exports
```

**Deploy live (the only deploy path):**
```bash
npm run deploy     # rebuilds with the /rorys-english base path + pushes to gh-pages
# live in ~1 min at https://rorymclark-prog.github.io/rorys-english/
```

**Regenerate icons (rare):** `pip install Pillow && python3 scripts/make-icons.py`

---

## 13. Gotchas (the things that will bite you — read before editing)

- **A. Base path.** Hosted at `/rorys-english`, so builds set `NEXT_PUBLIC_BASE_PATH=/rorys-english`. Next auto-prefixes `<Link>` and `_next/` assets, but **NOT** metadata icon/manifest URLs or hand-written `/…` paths — those are prefixed manually (`layout.tsx`, `s/[code]/layout.tsx`, `ServiceWorkerRegister.tsx`, `StudyView.tsx`, `gen-pwa.mjs`). New root-absolute path? Prefix it with `process.env.NEXT_PUBLIC_BASE_PATH`. Empty for local dev / a root host (Vercel/Netlify).
- **B. `.nojekyll`.** The deploy script creates it so `_next/` serves on Pages. Don't remove.
- **C. Deploy only via `npm run deploy`.** It sets the base path and pushes `gh-pages`. Don't push the built site to `main`.
- **D. Manifests are generated.** Edit `scripts/gen-pwa.mjs`, not `public/m/*`. A build run *without* the base-path env regenerates them at root paths (dirty working tree) — `npm run deploy` re-fixes them; don't commit root-path manifests.
- **E. Study tools are static** — env vars don't reach them. Their `SYNC` config (URL + secret) and any sub-path links are **hand-pasted**.
- **F. Sync secret lives in 3 places** that must match: `apps-script/progress-sync/Code.gs` (`SECRET`), `.env.local` (`NEXT_PUBLIC_SYNC_SECRET`), and each study tool's `SYNC.secret`. Currently `re-sync-7b3h8d9f4`.
- **G. Apps Script redeploy can mint a new URL** — use *Manage deployments → edit (same URL)*, or update the URL in `.env.local` + study tools and `npm run deploy`.
- **H. CORS errors in the console for sync are expected/benign** (`no-cors` write). Don't switch to a JSON content-type (triggers preflight Apps Script rejects).

---

## 14. How to add content (no code changes)

- **New student:** add to `content/students.json` (+ `content/<id>/units.json` + `content/<id>/<unit>/homework.json`); add to `STUDENTS` in `Code.gs`; re-run `setup()`; `npm run deploy`.
- **New homework week:** append to the unit's `homework.json` (task `type`: `checkbox|written|voice`; `written` supports `lines`).
- **New study tool:** build a self-contained HTML file in `public/study-tools/`, then add `{title,url,blurb}` to the unit's `units.json` `studyTools[]` (root-relative URL gets base-path-prefixed automatically). Clone `ferdi-unit10.html` as the template; remember to set its `SYNC` block.
- Full detail: `README.md`.

---

## 15. Handoff protocol (to a new chat / AI / developer)

Give them this one line:

> *"Read `MASTERPLAN.md` in the repo `rorymclark-prog/rorys-english` (local: `/Users/roryclark/Claude/projects/rorys-english`). It's the complete source of truth — vision, status, architecture, gotchas, and roadmap. Then read `HANDOVER.md` for the operational runbook. Continue from §9 (roadmap)."*

That, plus repo access (and Rory's Google login for any Apps Script change), is everything needed to continue seamlessly.

---

## Appendix A — Quick reference

| Thing | Value |
|---|---|
| Live app | https://rorymclark-prog.github.io/rorys-english/ |
| Ferdi link | …/s/ferdi-7h3k/ |
| Valentin link | …/s/valentin-q9m2/ |
| Ferdi PARENT link | …/p/ferdi-fam-3p9k/ |
| Valentin PARENT link | …/p/valentin-fam-8w2d/ |
| GitHub repo | https://github.com/rorymclark-prog/rorys-english (account `rorymclark-prog`) |
| Apps Script /exec | `https://script.google.com/macros/s/AKfycbxzo-IunYLs8JA6R-ZCCrzIiB7Gt1gONgFJvYbnOc119XEnmaFaHp4AW2DYnJRS_lNsxQ/exec` |
| Apps Script scriptId | `1wATmdmLpg5EfE8f3Ub5BL7HtObWg1RkYVR7WqvMAWNwUQZ3_5zVB8S8_` |
| Sync secret | `re-sync-7b3h8d9f4` (in Code.gs, .env.local, study tools — keep in sync) |
| Google Drive folder | "Rory's English — Progress" (Rory's account) → per-student subfolders + Sheets |
| Deploy command | `npm run deploy` |

## Appendix B — Glossary

- **PWA** — Progressive Web App; a website that installs to the home screen and works offline.
- **localStorage** — the browser's on-device key/value store; the app's source of truth.
- **Apps Script** — Google's free serverless scripting tied to a Google account; here it bridges the static app to Google Sheets.
- **clasp** — the CLI that pushes/deploys Apps Script from the terminal.
- **basePath** — the sub-path the site is served under (`/rorys-english`).
- **Study tool** — a standalone interactive HTML practice page, one per unit, linked from the app.
- **Profile** — a variant of the app experience (currently only "standard"; "serban"-style profiles are a backlog idea).

## Appendix C — Decision log (why things are the way they are)

| Decision | Rationale |
|---|---|
| Spec pivoted v1 (Next.js+IndexedDB study engine) → static HTML → **Next.js PWA, study engine removed** | Converged on: app = homework+progress shell; practice = external HTML tools. Simpler shell, purpose-built tools per unit. |
| IndexedDB → **localStorage** | Simpler, sufficient for ticks/answers/flags; less code. |
| Backend sync → **Google Apps Script + Sheets** (not Supabase) | Free, no new accounts, data lands in Sheets (where Rory works), matches his Apps Script skillset. |
| Hosting → **GitHub Pages** via existing `gh` auth (not Netlify/Vercel) | No new service/login needed; deployable immediately. (Netlify/Vercel remain options — the build also works at a root path.) |
| Parent access → **private link, no passwords** (declined real auth) | Keeps the free/no-backend model; consistent with student links. |
| Serban profile **dropped** from current scope | Focus on the two active students; pattern preserved in backlog. |
| URL code as the only "key" | Intentional low-friction model for a tiny, trusted user base — "obscurity not security," accepted. |

---

*End of MASTERPLAN. Keep this document current — it is the north star.*
