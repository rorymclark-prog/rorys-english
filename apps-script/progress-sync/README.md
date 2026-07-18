# Progress Sync — Apps Script

Writes app + study-tool results into a **Google Sheet per student** (inside a
Drive folder per student). Free, no server, no API keys on the phone.

## What it creates

```
Drive / Rory's English — Progress /
  Ferdi/
    Ferdi — Progress   ← Sheet with tabs: Dashboard, Homework, Vocab & Quizzes,
    recordings/                            School Tests, Writing, Speaking, Mock Tests
    writing/
  Valentin/ …
```

- **Homework** + **Vocab & Quizzes** tabs fill automatically from the app.
- **School Tests / Writing / Speaking / Mock Tests** are ready for you (or Claude)
  to fill — these are the analysis pipelines we layer on next.
- **Dashboard** has starter formulas; add charts by hand.

## One-time setup

1. Go to <https://script.google.com> → **New project**.
2. Paste `Code.gs` into the editor. Then **Project Settings → check "Show
   appsscript.json"**, open it, and paste the contents of `appsscript.json`.
3. (Optional) edit `STUDENTS` and `SECRET` at the top of `Code.gs`. Keep
   `STUDENTS` in step with `content/students.json`.
4. Run the **`setup`** function once. Authorise when prompted (it needs Drive +
   Sheets access — that's your own account). Check the execution log: it prints
   each student's Sheet URL.
5. **Deploy → New deployment → type: Web app.**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Deploy, then **copy the `/exec` URL**.

## Connect the app

In the project root create **`.env.local`** (it's git-ignored):

```
NEXT_PUBLIC_SYNC_URL=https://script.google.com/macros/s/XXXX/exec
NEXT_PUBLIC_SYNC_SECRET=change-me-rory-english-2026
```

(The secret must match `SECRET` in `Code.gs`.) Then redeploy the app:

```
npm run deploy
```

## Teacher dashboard (one-time setup, needed to switch on)

`/teacher/` is a single password-gated page showing every student at a
glance (homework/quiz/writing counts, last updated) with drill-down into
full per-student progress — same data as each student's own Progress tab,
aggregated. It's POST-only end to end (no GET/JSONP path anywhere), so the
password can never end up in a URL, browser history, or a server log.

Same one-time-paste pattern as `ANTHROPIC_API_KEY`: Apps Script editor →
**Project Settings → Script Properties → add key `TEACHER_PASSWORD`** with a
password only you know. Until it's set, the endpoint fails closed (rejects
every attempt) rather than falling back to any default. Then visit
`/teacher/` and enter it — the app remembers you on that device (signed in
via a browser-stored token, not cookies) until you tap "Sign out."

Done — completing a homework week or finishing a quiz round now appends a row to
that student's Sheet within a second or two.

### For the standalone study tools

The HTML study tools (`public/study-tools/*.html`) aren't built by Next, so paste
the same URL + secret into the `SYNC` config block near the top of each file.

## The endpoints (what the app calls)

The Apps Script (`Code.gs`) handles three kinds of `doPost` requests (student code + secret in request body):

### 1. **Sync endpoint** (above: homework + quiz scores)

Write events to the Sheet tabs. Called when a student completes homework or finishes a study-tool quiz.

- Homework: writes/updates a row in **Homework** tab (week-level upsert).
- Quiz/vocab: appends a row to **Vocab & Quizzes** tab.

### 2. **Resources endpoint** — auto-linked Lessons & feedback hub

Called via `doGet?action=resources` (GET, JSONP, secret + student code as query params for progress reads; see below).

- **Fully automatic.** The Apps Script searches Rory's Drive for files whose **title contains the student's name** (e.g., any file titled with "Ferdi" becomes link-viewable for Ferdi's app) + any files in an optional `<studentName> Shared` subfolder.
- Newest 40 files, deduped; **excludes** Google Sheets and Apps Scripts (no infinite loops).
- Each file is set **link-viewable once** (cached in Script Property `shared_ids` for speed — first load ~9s while sharing, then ~4s).
- ⚠️ **Naming rule:** to keep a Drive file private from the student's app, name it *without* the student's name.
- **App:** renders as **"Lessons & feedback"** card on Today and a full screen at `/s/<code>/resources`. Reachable by student code or parent code.

### 3. **AI helper endpoints** (tutor chat + word lookup + writing coach)

Called via `doPost` with `action="ai"` (CORS POST, secret + student code in body, no length limit via body transport).

- **Ask the tutor** (Haiku): conversational Q&A in a chat bubble, on-device history (localStorage `re_tutor_chat_<code>`, last 30 messages), context of last ~6 turns (1200-char budget) so follow-ups work. B1-simple answers with German glosses; steers off-topic back to English; safety line in all AI responses.
- **Word help** (Haiku): vocabulary lookup with examples.
- **Writing coach** (Sonnet): practice-not-graded feedback, one-focus-error per submission.
- **Route:** `/s/<code>/coach` ("Ask the English tutor" card on Today). Reachable by student or parent code.
- **Rate limit:** 40 calls per student per day (`ai_<code>_<date>` counters in Script Properties). If hit, returns a friendly message (suggests asking Rory next lesson).
- **Input cap:** 2000 chars (writing samples up to 4000 via auto-chunking).
- **Key setup (1-time, needed to switch on):** Apps Script editor → **Project Settings → Script Properties → add key `ANTHROPIC_API_KEY` with value from Anthropic dashboard.** Then run any function (e.g., `setup`) once to approve the new `script.external_request` scope. Until then the app shows "isn't switched on yet." 
- **Transport:** CORS POST (request body carries secret + text, no length limit); JSONP GET as fallback for read endpoints.

### Note on sync behavior

- The student **code** is the key (same one in their app link); `SECRET` is light
  anti-abuse. Because the app is static, the secret is visible in the page source
  — fine for this low-stakes data, not a vault.
- The app's localStorage stays the source of truth, so a missed sync is never lost
  progress — re-completing re-sends.
- To add a student later: add them to `STUDENTS`, re-run `setup()`.
