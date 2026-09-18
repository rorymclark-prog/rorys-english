# Rory's English

A lesson and homework hub for Rory, Ferdi and Valentin. The authenticated V2 app is live at https://rorymclark-prog.github.io/rorys-english/ (18 September 2026), backed by Google Apps Script version 28. All three versioned public service URLs now run the authenticated API. Existing progress records are retained.

## Student workflow

- Today shows the current book and teacher-assigned work for the school year.
- Lessons separates current units from archived material. Stable unit-and-week links never change when the active unit changes.
- Homework saves device-local drafts, sends complete answers, confirms receipt, and shows teacher feedback. Revisions create new submitted copies.
- The outbox retains an immutable pending copy until the server acknowledges it; retries are idempotent.
- AI provides practice hints and revision advice, using the existing Anthropic service. It is not a grading authority.
- Approved materials link to student-safe Drive files without changing their sharing settings.
- Old standalone quizzes remain local practice; their legacy automatic uploads have been removed.

Valentin’s current school book is way2go! 8, Unit 1. A 20-minute September writing starter is available from 18 September 2026, with no unconfirmed deadline. It is original supplementary practice, not a textbook exercise. Previous-year Unit 5 and Unit 9 material remain in the 2025–26 archive. Unit 9 includes the student PDF, fictional AI-narrated listening and checking transcript; teacher notes are excluded. New Unit 1 textbook exercises await the source pages. Ferdi’s current content is unchanged for his separate follow-up.

Lessons are term-time only: Valentin every second Saturday, Ferdi weekly, around 90 minutes in person with a shorter online core. Dates are assigned explicitly; no holiday calendar or unverified school requirements have been invented.

## Local preview (dummy data only)

Use two terminals in this directory:

```sh
npm install
node scripts/preview-api.mjs
```

```sh
NEXT_PUBLIC_SYNC_URL=http://127.0.0.1:4174 NEXT_PUBLIC_DEMO_MODE=true npm run dev -- --hostname 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173/s/valentin-q9m2/ or http://127.0.0.1:4173/teacher/ and use the synthetic access code `demo-only`. The demo cannot send AI requests or update real student records. It stores its example submissions in memory and resets when its service restarts.

## Checks

```sh
npm test
npm run lint
npm audit
NEXT_PUBLIC_BASE_PATH=/rorys-english npm run build
```

Live checks covered teacher/student authentication, denied cross-student access, exact written answers, duplicate retry, teacher feedback, revisions and the word helper. The two synthetic submissions were removed and existing records retained. Rory confirmed browser teacher sign-in; automated browser and installed-phone checks were unavailable during activation.

The source includes 23 automated tests for access isolation, teacher-session revocation, immutable/idempotent submissions, teacher review, quiz retries, resource safety, date handling, archived links and durable outbox behaviour.

## Production and future releases

Read [the deployment guide](apps-script/progress-sync/README.md) first. Keep the live Google service and frontend compatible; distribute student access codes privately. The deployment script refuses to run without explicit activation confirmation. Never publish a demo build or leave the old unauthenticated service available as a fallback.

The frontend receives only the version-2 endpoint URL. Server API keys and teacher credentials stay in Script Properties; no shared browser secret is used. Public routing identifiers are not credentials.

## Content boundaries

Content JSON and static files are publicly downloadable assets, not a safe place for answer keys, teacher notes, recordings, private feedback or full copyrighted ebooks. Publish only approved student material.

New-unit quizzes, audio upload/transcription, a complete curriculum tracker, deck revisions and NotebookLM integration are not included in this first implementation. These need source material and a separate content workflow, not invented textbook exercises.
