# HANDOVER — Rory's English (PWA + Google Sheets progress sync)

**For:** the next agent/developer (e.g. Antigravity) taking over this task.
**Owner:** Rory Clark, English tutor, Vienna. Students: **Ferdi** (14, A2–B1, MORE! 4) and **Valentin** (B1, way2go!).
**This doc is self-contained** — you should not need any other context to finish the immediate task.

---

## 0. TL;DR — what needs doing right now

The app is **built, deployed, and live**. The only unfinished piece is **turning on the Google Sheets progress sync**, which needs access to Rory's Google account (Apps Script deploy + OAuth consent). That is THE TASK.

**Definition of done:**
1. The Apps Script in `apps-script/progress-sync/` is deployed as a Web App in Rory's Google account.
2. `setup()` has been run once → a Drive folder + Progress Sheet exists per student.
3. A real shared secret is set consistently in **3 places** (see §4).
4. The app + study tool are rebuilt with the Web App URL and redeployed.
5. **Verified:** completing a homework week in the app adds a row to that student's Sheet.

Jump to **§4 (the runbook)** for exact steps.

---

## 1. What this project is

A mobile-first **PWA** the students install on their phones for **homework + progress tracking**. Study practice happens in separate self-contained **HTML study tools** linked from the app (no quiz engine inside the app shell).

- **Live:** https://rorymclark-prog.github.io/rorys-english/
- **Repo:** https://github.com/rorymclark-prog/rorys-english (GitHub account `rorymclark-prog`, already authenticated via `gh` on Rory's Mac)
- **Local path:** `/Users/roryclark/Claude/projects/rorys-english`
- **Student links (the URL code is the only key):**
  - Ferdi → `…/s/ferdi-7h3k/`
  - Valentin → `…/s/valentin-q9m2/`

---

## 2. Tech stack & key decisions (read before changing anything)

- **Next.js 15 (App Router) + TypeScript + Tailwind**, `output: "export"` → pure static site. No backend, no accounts.
- **Design system = "VOLTSTONE" (2026)** — `design/MODERN-2026-SPEC.md` is the styling source of truth; read it before changing any UI. Electric indigo accent (`#4F46E5` light / `#A2A4FC` dark), warm stone `#FAF8F5`, charcoal `#17161C` dark base (also the PWA `themeColor`), ember `#C2410C` reward channel; legacy Tailwind names (`amber`/`navy`/`burgundy`/`cream`) kept with new values. Fonts: Manrope + JetBrains Mono. Charcoal/indigo "RE" icon; floating glass tab bar. **Hard rule: `#4F46E5` never on the dark base — dark accents with `#A2A4FC`.**
- **Progress = `localStorage`** on the device. localStorage is the source of truth; sync is best-effort on top.
- **Hosting = GitHub Pages** under a sub-path `/rorys-english`. This is why `basePath` matters (see §6, Gotcha A).
- **Sync (optional) = Google Apps Script Web App.** The static app can't hold Google credentials, so it POSTs events to an Apps Script `/exec` URL that writes into a Google Sheet. Free, no server, matches Rory's existing Apps Script workflow.
- **Privacy:** nothing leaves the device *except* the opt-in sync (Rory consented — it's his teaching record). Pages are `noindex`. The URL code is "obscurity not security" by design — **do not "fix" it.**

---

## 3. Repo map (the files that matter)

```
rorys-english/
├─ design/MODERN-2026-SPEC.md       # VOLTSTONE design system (styling source of truth)
├─ content/                         # ALL tutor content (edit JSON, no code changes)
│  ├─ students.json                 # id, displayName, code, profile, units[]
│  ├─ ferdi/units.json              # units + studyTools[] (title,url,blurb)
│  ├─ ferdi/unit10/homework.json    # weeks: tasks[] (checkbox|written|voice)
│  └─ valentin/…                    # same shape
├─ public/
│  ├─ study-tools/ferdi-unit10.html # self-contained study tool (vocab/conditionals/traps + TTS + sync hook)
│  ├─ sw.js                         # hand-rolled service worker (offline)
│  ├─ icons/  m/  manifest.webmanifest   # PWA assets (m/ = per-student manifests, generated)
├─ src/
│  ├─ app/                          # routes: /, /s/[code]/(today), /study, /homework[/week], /settings
│  ├─ components/                   # AppShell, TabBar, Screen, InstallHint, OfflineBanner, contexts, Icons
│  ├─ components/views/             # TodayView, StudyView, HomeworkListView, HomeworkWeekView, SettingsView
│  └─ lib/                          # types, content (build-time fs loader), storage (localStorage),
│                                   #   sync (→ Apps Script), ics, celebrate
├─ apps-script/progress-sync/       # ← THE SYNC BACKEND
│  ├─ Code.gs                       # setup() provisions; doPost() ingests
│  ├─ appsscript.json               # webapp manifest (ANYONE_ANONYMOUS, Drive+Sheets scopes)
│  └─ README.md                     # deploy steps (same as §4 here)
├─ scripts/
│  ├─ gen-pwa.mjs                   # generates per-student manifests (runs on predev/prebuild)
│  ├─ deploy-pages.sh              # `npm run deploy` → build + push to gh-pages
│  └─ make-icons.py                 # one-time icon generator (Pillow)
└─ README.md                        # full how-to (add student/unit/tool, deploy)
```

**Git branches:** `main` = source. `gh-pages` = the built static site that GitHub Pages serves (force-pushed by `npm run deploy`). Don't hand-edit `gh-pages`.

---

## 4. THE RUNBOOK — turn on Google Sheets sync

> Needs Rory's Google account. An agent with browser control can do steps 1–5; a human does the OAuth click. Everything else is CLI.

### Step 0 — pick a real secret
Choose a value to replace the placeholder `change-me-rory-english-2026`, e.g. `re-sync-<random>`. It will go in **3 places** (steps 1, 4, 5). NOTE: it's visible in the client bundle — it's light anti-abuse, not a vault. That's acceptable for this low-stakes data.

### Step 1 — create the Apps Script
1. Go to <https://script.google.com> → **New project**.
2. Replace the default `Code.gs` with the contents of `apps-script/progress-sync/Code.gs`.
3. **Project Settings → tick "Show appsscript.json manifest in editor"**, open `appsscript.json`, paste the contents of `apps-script/progress-sync/appsscript.json`.
4. In `Code.gs`, set `SECRET` to your chosen value. Confirm the `STUDENTS` array matches `content/students.json` (currently ferdi-7h3k / valentin-q9m2).

### Step 2 — provision the Sheets
Run the **`setup`** function once. Approve the OAuth consent (it needs Drive + Sheets — Rory's own account). The execution log prints each student's Sheet URL. This creates:
```
Drive / Rory's English — Progress / <Student>/  →  "<Student> — Progress" Sheet
   tabs: Dashboard, Homework, Vocab & Quizzes, School Tests, Writing, Speaking, Mock Tests
   + recordings/ and writing/ subfolders
```
`setup()` is idempotent (safe to re-run; won't clobber the Dashboard once it has data).

### Step 3 — deploy the Web App
**Deploy → New deployment → Web app.** Execute as **Me**, Who has access **Anyone**. Deploy → **copy the `/exec` URL** (looks like `https://script.google.com/macros/s/AKfy…/exec`).

### Step 4 — connect the Next app
Create **`.env.local`** in the project root (git-ignored; template in `.env.local.example`):
```
NEXT_PUBLIC_SYNC_URL=https://script.google.com/macros/s/AKfy…/exec
NEXT_PUBLIC_SYNC_SECRET=<your secret from step 0>
```

### Step 5 — connect the study tool(s)
The HTML study tools are static (not built by Next), so paste the same values into the `SYNC` config block near the top of each file in `public/study-tools/`. In `ferdi-unit10.html` find:
```js
var SYNC = { url: "", secret: "change-me-rory-english-2026", code: "ferdi-7h3k", tool: "unit10" };
```
Set `url` to the `/exec` URL and `secret` to your secret. (`code`/`tool` are already correct.)

### Step 6 — redeploy
```
cd /Users/roryclark/Claude/projects/rorys-english
npm install        # if deps not present
npm run deploy     # rebuilds with .env.local baked in + pushes to gh-pages
```
Wait ~1 min for GitHub Pages.

### Step 6b — (optional) enable the AI tutor
The Lessons & feedback hub (auto-linked Drive files) is now live. To also enable the AI helper (chat, word help, writing coach), add the Anthropic API key to Script Properties:

1. Go to the Apps Script editor → **Project Settings → Script Properties**.
2. Add a new property: `ANTHROPIC_API_KEY` = your key from [Anthropic dashboard](https://console.anthropic.com/api-keys/).
3. Run any Apps Script function (e.g., `setup()` again) once to approve the new `script.external_request` scope.
4. That's it — students now see an "Ask the English tutor" card on Today, and the `/s/<code>/coach` endpoint works. Rate limit: 40 calls/student/day; input capped at 2000 chars.

### Step 7 — verify (do not skip)
1. Open `…/s/ferdi-7h3k/homework/1/`, tick a task, tap **Mark as complete**.
2. Open the **Ferdi — Progress** Sheet → **Homework** tab → a row should appear within seconds.
3. Open the study tool, finish a vocab round → a row in the **Vocab & Quizzes** tab.
4. If nothing appears: see §7 troubleshooting.

---

## 5. How the sync works (so you can debug it)

- App event → `src/lib/sync.ts` → `fetch(SYNC_URL, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body: JSON})`.
- `no-cors` + `text/plain` is deliberate: it's a "simple request" (no CORS preflight, which Apps Script can't answer). Trade-off: the response is **opaque** — the app can't read success/failure. That's fine; localStorage remains the source of truth, and re-completing re-sends.
- Payload shapes (must match `Code.gs`):
  - homework: `{secret, type:"homework", code, unitId, week, title, status:"complete"|"incomplete"}` → upserts one row per week in **Homework**.
  - quiz: `{secret, type:"quiz", code, tool, section, score, total}` → appends to **Vocab & Quizzes**.
- `Code.gs` `doPost` validates `secret`, looks up the student's Sheet id from Script Properties (key `sheet_<code>`, written by `setup()`), and writes the row.

---

## 6. Gotchas (these will bite you if you don't know them)

**A. `basePath`.** Hosted at `/rorys-english`, so the build sets `NEXT_PUBLIC_BASE_PATH=/rorys-english` (see `next.config.mjs` + `scripts/deploy-pages.sh`). Next auto-prefixes `<Link>` and `_next/` assets, but **NOT** metadata icon/manifest URLs or hand-written `/…` paths — those are prefixed manually in `layout.tsx`, `s/[code]/layout.tsx`, `ServiceWorkerRegister.tsx`, `StudyView.tsx`, and `gen-pwa.mjs`. If you add a new root-absolute path, prefix it with `process.env.NEXT_PUBLIC_BASE_PATH`. For local dev / a root host (Vercel/Netlify), leave the env unset (empty basePath).

**B. GitHub Pages needs `.nojekyll`.** The deploy script `touch`es it so the `_next/` folder is served. Don't remove it.

**C. Deploy = `npm run deploy`.** It rebuilds with the right basePath and force-pushes `out/` to `gh-pages`. Don't `git push` the built site to `main`.

**D. Per-student manifests are generated**, not hand-written — edit `scripts/gen-pwa.mjs`, not `public/m/*`. It runs automatically on `predev`/`prebuild`.

**E. Study tools are static** — env vars don't reach them; their `SYNC` config is hand-pasted (§5 step 5). They also already have **text-to-speech** (Web Speech API, `🔊`) and the sync hook.

**F. The secret is client-visible.** By design. Don't treat it as security.

---

## 7. Troubleshooting the sync

- **No rows appear:** open the Apps Script editor → **Executions** to see `doPost` runs/errors. Common causes: secret mismatch (3 places must agree), `setup()` not run (no `sheet_<code>` property), wrong deployment URL (must end `/exec`, not `/dev`).
- **Re-deployed Apps Script, sync stopped:** a *new deployment* can mint a new URL. Either use **Manage deployments → edit (same URL)**, or update the URL in `.env.local` + study tools and `npm run deploy`.
- **CORS errors in console:** expected/benign with `no-cors` — the write still lands. Don't switch to a JSON content-type (it triggers preflight that Apps Script rejects).

---

## 8. How to add content (no code changes)

- **New student:** add to `content/students.json` (+ `content/<id>/units.json` + `content/<id>/<unit>/homework.json`), add to `STUDENTS` in `Code.gs`, re-run `setup()`, `npm run deploy`.
- **New homework week:** append to the unit's `homework.json` (task `type`: `checkbox|written|voice`; `written` supports `lines`).
- **New study tool:** add `{title,url,blurb}` to the unit's `units.json` `studyTools[]`. Bundle the HTML under `public/study-tools/` and use a root-relative URL (gets basePath-prefixed automatically by `StudyView`), or an external `https://…` URL.
- Full details: `README.md`.

---

## 9. Known open items & roadmap

**Shipped (✅ done & live):**
- Valentin's study tool (`public/study-tools/valentin-unit05.html`) — 20 vocab words, comparatives gap-fill, B1 German traps, TTS, spaced-rep.
- Lessons & feedback hub — auto-linked Drive files (no manual drag-and-drop); 40 newest, Sheets/Scripts excluded, [private] naming opt-out.
- AI helper suite — tutor chat, word lookup, writing coach at `/s/<code>/coach`; 40 calls/student/day, models: Haiku (chat/word), Sonnet (writing).
- Progress section & parent view — `/s/<code>/progress` and `/p/<parentCode>/` (read-only, same features).

**Open (content, not code):**
- **German vocab translations** in both study tools are AI best-effort — verify against the MORE! 4 and way2go! glossaries (the tools show a note).

**Roadmap (researched, ranked by value-for-effort):**
1. ~~**Spaced-repetition review (SM-2)**~~ ✅ **DONE** — both study tools now ship with SM-2-lite (per-word due-dates in localStorage, "N words ready to review" card on Today, questions sorted by due-first).
2. ~~**Example sentences**~~ ✅ **DONE** — every vocab word in both tools reveals a B1 example sentence + 🔊 TTS button after answer.
3. **Analysis pipelines feeding the Sheets** (the rich tabs are already created):
   - *Writing analysis:* tutor drops a sample in the student's `writing/` Drive folder → an agent scores CEFR/grammar/vocab/coherence → appends to the **Writing** tab.
   - *Speaking/audio analysis:* recording → transcribe → fluency/pronunciation/grammar → **Speaking** tab.
   - *Mock tests / school results:* manual or agent-scored → **Mock Tests** / **School Tests** tabs.
   These are the natural Phase 2 and are why the Sheet has more tabs than the app currently fills.

**Explicitly decided AGAINST** (don't build): leaderboards (demotivating 1-on-1), browser speech-recognition (poor non-native accuracy, mic-permission for minors, not offline), web-push notifications (needs a backend — the `.ics` calendar export covers reminders).

---

## 10. Verify the whole app still works (regression check)

```
cd /Users/roryclark/Claude/projects/rorys-english
NEXT_PUBLIC_BASE_PATH=/rorys-english npm run build   # must exit 0
```
Then live-smoke (after a deploy): all should be `200`:
`/s/ferdi-7h3k/`, `/s/valentin-q9m2/`, `/s/ferdi-7h3k/homework/3/`, `/study-tools/ferdi-unit10.html`, `/sw.js`.
Acceptance: install to home screen (full-screen), works offline after first load, homework ticks/answers persist across restarts, unknown code → 404, study tool quiz scores + speaks (🔊).
