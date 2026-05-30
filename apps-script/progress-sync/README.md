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

Done — completing a homework week or finishing a quiz round now appends a row to
that student's Sheet within a second or two.

### For the standalone study tools

The HTML study tools (`public/study-tools/*.html`) aren't built by Next, so paste
the same URL + secret into the `SYNC` config block near the top of each file.

## Notes

- The student **code** is the key (same one in their app link); `SECRET` is light
  anti-abuse. Because the app is static, the secret is visible in the page source
  — fine for this low-stakes data, not a vault.
- The app's localStorage stays the source of truth, so a missed sync is never lost
  progress — re-completing re-sends.
- To add a student later: add them to `STUDENTS`, re-run `setup()`.
