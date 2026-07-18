# Rory's English

Mobile-first PWA for Rory Clark's English students. Built with Next.js 15 App Router, TypeScript, and Tailwind CSS. Output is a fully static export (`output: "export"`) — no server, no backend, no accounts. All content is shipped as JSON at build time; progress lives in localStorage on the student's device. Study tools are **external HTML pages** linked by URL — there is no in-app quiz engine.

### What students get

- **Today** — greeting, the next homework due, a gentle 7-day activity strip + streak (with a personal best), and cards for Study, Lessons & feedback, and Ask the English tutor.
- **Homework** — weekly tasks (tick boxes, lined written answers with debounced autosave, voice-memo prompts), a tasteful confetti + haptic celebration on completion, and an **Add due date to my calendar** button (downloads an `.ics`).
- **Study** — cards that open the unit's external HTML study tools in a new tab (vocab quizzes, grammar, German traps, text-to-speech, spaced-repetition review).
- **Lessons & feedback** — automatic search of Rory's Drive for files with the student's name (no manual drag-and-drop) — practice sheets, audio files, slides, etc. Cached and link-viewable once. Click to download/preview.
- **Ask the English tutor** — conversational Q&A (Haiku), vocabulary lookup, and writing coach feedback at `/s/<code>/coach`. On-device chat history, rate-limited to 40 calls/day per student.
- **Progress** — summary tiles + per-section tables (homework, quizzes, writing, etc.) at `/s/<code>/progress`, reached via a Today card. Parent view at `/p/<parentCode>` (private read-only link, same features).
- **Settings** — text size, light/dark/auto theme, **Send my progress to Rory** (native share sheet → WhatsApp, nothing sent automatically), and reset.
- **Installable PWA** — Add to Home Screen, full-screen, offline after first load, an offline banner when the connection drops, and long-press app-icon shortcuts to Homework/Study.
- **Private by design** — no accounts, no analytics, `noindex`, progress never leaves the device.

---

## Local dev

```bash
npm install
npm run dev      # predev auto-generates per-student manifests, then starts Next.js
```

Production build (static export to `out/`):

```bash
npm run build    # prebuild runs gen-pwa.mjs, then next build writes out/
```

---

## Project structure

```
rorys-english/
├── content/
│   ├── students.json               # master student list
│   ├── ferdi/
│   │   ├── units.json              # Ferdi's unit definitions + study tools
│   │   └── unit10/
│   │       └── homework.json       # homework weeks for Unit 10
│   └── valentin/
│       ├── units.json
│       └── unit05/
│           └── homework.json
├── public/
│   ├── icons/                      # icon-192.png, icon-512.png, apple-touch-icon.png
│   └── m/                          # per-student .webmanifest files (auto-generated)
├── scripts/
│   ├── gen-pwa.mjs                 # generates manifests on predev / prebuild
│   └── make-icons.py               # one-time icon generator (requires Pillow)
└── src/
    ├── app/                        # Next.js App Router pages
    └── lib/
        ├── content.ts              # build-time JSON loader (Server Components only)
        ├── storage.ts              # localStorage helpers (client only)
        └── types.ts                # content contract (Student, Unit, HomeworkWeek, …)
```

---

## How to add a student

1. Add an entry to `content/students.json`:

```json
{
  "id": "anna",
  "displayName": "Anna",
  "code": "anna-x4p7",
  "parentCode": "anna-fam-k2m9",
  "profile": "standard",
  "greeting": "Hi Anna",
  "units": [{ "id": "unit05", "title": "Trends & Choices", "active": true }]
}
```

- The `code` value is the **student's private-URL key** — they access the app at `/s/<code>/`. Keep it unguessable (a few random chars appended to the name works fine).
- The `parentCode` is an optional **parent/guardian read-only link** at `/p/<parentCode>/` — same progress data, no edits. Omit if no parent view is needed.

2. Create `content/anna/units.json` and `content/anna/unit05/homework.json` (see shapes below).

3. Re-run `npm run dev` or `npm run build`. `gen-pwa.mjs` runs automatically and writes `public/m/anna-x4p7.webmanifest`. No code changes needed.

---

## How to add a unit

1. Add an entry to `content/students.json` → `units[]` for the relevant student:

```json
{ "id": "unit11", "title": "City Life", "active": true }
```

Set at most one unit to `"active": true` — that's the unit shown on the Today and Study screens.

2. Add the same entry to `content/<studentId>/units.json` (with `studyTools[]`):

```json
[
  {
    "id": "unit11",
    "title": "City Life",
    "active": true,
    "studyTools": []
  }
]
```

3. Create `content/<studentId>/unit11/homework.json` with an empty array `[]` or your first weeks.

No code changes needed.

---

## How to add a study tool

Add a `{title, url, blurb}` object to `studyTools[]` in the relevant `units.json`. Example from Ferdi's `unit10`:

```json
"studyTools": [
  {
    "title": "Unit 10 Study Tool",
    "url": "https://example.com/REPLACE-WITH-NETLIFY-URL",
    "blurb": "Vocab quiz, conditionals practice & German traps."
  }
]
```

The app renders each entry as a card that opens the URL in a new tab. A study tool can live **either**:

- **Bundled with the app** — drop a self-contained `.html` file in `public/study-tools/` and use a root-relative URL like `/study-tools/ferdi-unit10.html`. It deploys with the app, works offline (cached by the service worker), and stays same-origin/private. Ferdi's Unit 10 tool is wired up this way as a working example.
- **External (Netlify etc.)** — build the HTML tool, host it anywhere, and paste the full `https://…` URL.

No code changes either way.

---

## How to add a homework week

Append an entry to `content/<studentId>/<unitId>/homework.json`. The three task types are `"checkbox"`, `"written"`, and `"voice"`. Written tasks accept an optional `"lines"` field (defaults to 3).

```json
{
  "week": 5,
  "title": "HW5 · Listening + reflection",
  "due": "Mon 6 July",
  "tasks": [
    { "id": "t1", "type": "checkbox", "prompt": "Watch the BBC clip and tick when done." },
    { "id": "t2", "type": "written", "prompt": "Write 3 sentences about what you heard.", "lines": 4 },
    { "id": "t3", "type": "voice",   "prompt": "Record yourself summarising the clip in 30 seconds." }
  ]
}
```

Weeks are sorted by `week` number at build time. No code changes needed.

localStorage keys follow the pattern `{studentId}_{unitId}_hw{week}_{taskId}` — e.g. `ferdi_unit10_hw1_t3`.

---

## Deploy to Vercel

1. Push the repo to GitHub (or any Git host).
2. Import the project on [vercel.com](https://vercel.com). Framework preset: **Next.js**.
3. Vercel runs `npm run build` and serves the static `out/` directory. Free-tier static hosting, no server needed.

Because this is a static export it can also deploy to Netlify, GitHub Pages, Cloudflare Pages, or any host that serves static files.

---

## Handing out a student link

Send the student their URL:

```
https://<your-vercel-domain>/s/ferdi-7h3k/
https://<your-vercel-domain>/s/valentin-q9m2/
```

Tell them: **Share → Add to Home Screen** (Safari on iPhone / Chrome on Android) to install as a PWA. The app launches full-screen, scoped to their code. An unknown code returns a 404.

---

## Progress sync to Google Sheets (optional)

By default the app is fully device-local. To collect results in a **Google Sheet per student** (homework completion, quiz/vocab scores — plus tabs ready for school tests, writing/speaking analysis and mock tests), deploy the Apps Script in [`apps-script/progress-sync/`](apps-script/progress-sync/README.md). It provisions a Drive folder + Sheet per student and gives you a Web App URL. Put the URL + secret in `.env.local` and `npm run deploy` — completing homework or a quiz then writes a row to that student's Sheet. Without it, nothing syncs and nothing leaves the device.

### Optional: enable the AI tutor

The Lessons & feedback hub (Drive-linked) is automatic once the Apps Script is deployed. To also enable the AI tutor (chat, word help, writing coach), add `ANTHROPIC_API_KEY` to the Apps Script's Script Properties (one-time setup), then approve the `script.external_request` scope. See [`apps-script/progress-sync/README.md`](apps-script/progress-sync/README.md#3-ai-helper-endpoints-tutor-chat--word-lookup--writing-coach) for details and rate limits (40 calls per student per day).

## Privacy

- No accounts, no server, no analytics.
- Homework progress (checkboxes, written answers, streak) is stored in localStorage on the student's own device and never leaves it.
- Voice tasks are recorded in the student's phone's own voice-memo app and sent via WhatsApp. The app never records or uploads audio.

---

## Regenerating icons

Icons are committed static assets (`public/icons/`). Only re-run this if the icon design changes:

```bash
pip install Pillow
python3 scripts/make-icons.py
# writes icon-512.png, icon-192.png, apple-touch-icon.png to public/icons/
```

The script draws an amber tile with a navy "RE" monogram. It is not part of the normal build.
