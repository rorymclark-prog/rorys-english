# Rory's English

A lesson and homework hub for Rory, Ferdi and Valentin. The current deployment uses Vercel at https://rorys-english.vercel.app/ with Firebase email/password accounts and the authenticated Google Apps Script progress service (version 29). Existing records and the earlier GitHub Pages release are retained.

Students use their existing lesson link, enter the email they use with Rory, and choose **Set or reset password** on their first visit. They choose their own password through the email link. Email verification is required; the app offers a verification email if needed. **Keep me signed in on this device** remembers the login on their own phone. Google sign-in remains disabled pending provider setup and testing. Existing private access codes remain supported; the teacher keeps the existing teacher login.

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
NEXT_PUBLIC_FIREBASE_API_KEY= NEXT_PUBLIC_SYNC_URL=http://127.0.0.1:4174 NEXT_PUBLIC_DEMO_MODE=true npm run dev -- --hostname 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173/s/valentin-q9m2/ or http://127.0.0.1:4173/teacher/ and use the synthetic access code `demo-only`. The demo cannot send AI requests or update real student records. It stores its example submissions in memory and resets when its service restarts.

## Checks

```sh
npm test
npm run lint
npm audit
npm run build
```

Live checks covered teacher/student authentication, denied cross-student access, exact written answers, duplicate retry, teacher feedback, revisions and the word helper. The two synthetic submissions were removed and existing records retained. Rory confirmed browser teacher sign-in; automated browser and installed-phone checks were unavailable during activation.

The source includes 47 automated tests for access isolation, teacher-session revocation, immutable/idempotent submissions, teacher review, quiz retries, resource safety, date handling, archived links and durable outbox behaviour.

## Production and future releases

Read [the deployment guide](apps-script/progress-sync/README.md). Publish this Next.js app to the existing Vercel project `rorys-english` with `npm run deploy`. GitHub holds the source; the old Pages build is retained for existing links. The current app requires its server API route and cannot use a static Pages export.

Use `.env.example` for configuration names. The Firebase Web API key is public project configuration. Student emails/UID mappings belong only in the server environment; Firebase passwords, tokens, teacher credentials and provider secrets never belong in source. The server verifies Firebase signatures and maps the exact UID and verified email to one student. Apps Script independently validates Google identity and server-managed student permissions before issuing a short-lived student session.

The live login integration was checked with a temporary synthetic Firebase account: unverified email rejection, a real signed identity, authenticated progress, and denied cross-student/teacher access. Password-setup link generation was checked for both registered learners without sending mail or changing their passwords. The synthetic account was deleted; no learner answers were written. Real student sign-in and installed-phone/offline behavior still need a device check.

## Content boundaries

Content JSON and static files are publicly downloadable assets, not a safe place for answer keys, teacher notes, recordings, private feedback or full copyrighted ebooks. Publish only approved student material.

New-unit quizzes, audio upload/transcription, a complete curriculum tracker, deck revisions and NotebookLM integration are not included in this first implementation. These need source material and a separate content workflow, not invented textbook exercises.

### Menu and teacher preview

Teacher and student pages share a menu with appearance, text size and dated release notes. Teacher preferences use a separate device-local key. Select View as student from the teacher menu or a student workspace for a read-only preview, then Exit preview to return. Preview uses the existing teacher session, requires no student credentials, and blocks writes, AI, draft changes and outbox delivery. It must never populate a student session or silently drain their queued work. The API also rejects non-read operations marked as preview.

Slides & resources collects existing approved lesson assets and live approved Drive links. Editable teaching masters, notes and answers belong in private storage; student copies must be reviewed before being added.

## Visual workspace and speaking studio · 20 September 2026

The workspace expands across laptops and tablets, with bottom navigation on phones. Paper & blue is the default palette, with warm-white light mode and navy dark mode. Light/dark/system, palette and text-size choices persist locally. Existing learner data and read-only teacher preview remain on their established services. The home screen displays real assignments and notes, never the synthetic design-preview scores.

The speaking studio offers three conversation targets, a device-only rehearsal recorder (up to three minutes), and a GPT-Live-1 WebRTC integration. Live voice uses a server-only OpenAI key, verified Firebase student accounts matched to the server roster, same-origin requests, bounded requests and per-instance start throttling. Teacher preview and legacy-code-only sessions cannot start paid voice. The browser closes conversations after 15 minutes. This is not an account-wide spending cap: configure suitable Platform limits before wider rollout. Captions/reflections can be downloaded; they are not automatically submitted or graded. Model storage is disabled. No operating-system text-to-speech is used.

Production has the private key configured but `LIVE_VOICE_ENABLED=false`. The model-access check succeeded; an actual WebRTC session request returned HTTP 429 `insufficient_quota` / `credit_balance_exhausted`. Add API credit in the Personal / Default project, rerun `node scripts/qa-live-voice.mjs`, then enable the flag and redeploy only after a successful session. ChatGPT subscriptions and API billing are separate. GPT-5.4-mini is an option for simple text experiments; it does not replace GPT-Live-1 voice and still needs available API credit.

Verification: production build, TypeScript, 47 automated tests; browser layouts at 1440×1000, 820×1180 and 390×844 across Today, Homework, Speaking, Study, Resources, Progress and Settings; light/dark screenshots; a simulated microphone recording and playback. Actual iPad/Safari microphone permission, backgrounding and installed-PWA audio still require a device check.
