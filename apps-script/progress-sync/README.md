# Progress service — version 2 activation guide

Status, 18 September 2026: V2 is live. Remote source and both progress spreadsheets were privately backed up before activation. The production endpoint and both older public deployment URLs now run version 28; anonymous record requests are denied on all three. The frontend was published to the existing GitHub Pages app. Rory confirmed teacher sign-in in his browser. Live API checks passed student sign-in, role isolation, answer submission and deduplication, feedback, revision preservation and the word helper. The two clearly labelled synthetic submissions were removed and read-back verified. Valentin’s access code is kept in a private access card outside the repository. Ferdi’s code is to be configured in his separate follow-up. Browser automation was unavailable; installed-phone/offline rollout is not claimed as checked.

## What changes

- Deploy BOTH Code.gs and V2.gs. Only V2.gs defines public doGet / doPost.
- GET returns version information only. Authenticated POST is the only data API. No JSONP or shared browser secret.
- Teacher signs in with the existing TEACHER_PASSWORD Script Property. Student and parent routing codes are public identifiers, not credentials.
- Teacher creates independent, high-entropy student/parent access codes in the dashboard and shares them privately. Only salted hashes are persisted. Rotating a code revokes its earlier sessions.
- Sessions expire after six hours, or sooner if the Apps Script cache evicts them. Browser session storage holds tokens, not passwords.
- Student answers become immutable Submissions rows. A retry with the same ID returns the original receipt; a revision uses a new ID.
- Teacher feedback changes the review status, not the original answer. Reviewed dynamic assignments remain accessible.
- Resources come only from a teacher-approved list. Reads never search Drive or change file permissions. Approval in the app does not itself grant Drive access.
- AI remains on the existing Anthropic provider. Teacher writing analysis is a draft; separate explicit approval publishes it. Practice AI is not a school grade.
- Quotas are reserved under a lock before provider calls. Failed attempts may consume a slot: this deliberately fails closed.
- Archived standalone quizzes are device-local practice only. Their old automatic uploads have been retired. Existing score records are not deleted.

## Configuration

The static frontend needs only NEXT_PUBLIC_SYNC_URL (the version-2 /exec URL) and, for GitHub Pages, NEXT_PUBLIC_BASE_PATH=/rorys-english.

Do not configure NEXT_PUBLIC_SYNC_SECRET. Do not put API keys, teacher passwords, access codes, private feedback, or teacher notes in static content or the repository.

Existing Script Properties (roster/sheet mappings, TEACHER_PASSWORD, ANTHROPIC_API_KEY) remain on the server. New properties use access_, access_version_, and approved_resources_ prefixes. Existing Sheets remain in place.

## Safe release sequence

1. Re-read the latest remote Apps Script source and compare it with the local implementation; the remote deployment can be newer than GitHub. Preserve unrelated changes, including Rory’s editor-only external-request authorization helper.
2. Save a private backup of that remote source and note every existing deployment/version. Back up the affected progress sheets before making any structural changes.
3. Verify the actual script project, Google account, and GitHub Pages destination. Do not create a new provider or replace Rory’s existing account configuration.
4. Deploy the two-file backend to a test deployment first. Test readable cross-origin POST from the real frontend origin: health, teacher login, student and parent access, denied cross-student reads, a synthetic submission/retry/revision, and teacher feedback.
5. Rory signs in, creates and privately distributes the new student access codes. The assistant must not display real access codes in reports or logs.
6. Review the specific files exposed by the old resource feature. Stop new automatic sharing immediately with the new backend, but do not bulk revoke Drive permissions without identifying the intended recipients and obtaining approval. Do not approve a full teacher deck containing answer keys or notes as student material.
7. Coordinate switching the existing live backend and frontend. Retire ALL older publicly accessible data deployments; otherwise the old unauthenticated path remains reachable even if the new frontend is secure. Do not leave old versions as public fallback endpoints.
8. Build with the real version-2 URL, the GitHub Pages base path, and no DEMO flag. Run tests, type checks, dependency audit, and production build. Stamp the service-worker cache version. Verify the real URLs in a browser, including an existing installed PWA.
9. Test a full workflow with a synthetic record first, then let Rory approve use with actual learners. Check Drive sharing explicitly; the local tests cannot prove the live permissions.

Do not run npm run deploy until this coordinated activation is approved. Do not roll back to the insecure public data endpoint if testing fails; pause writes and restore a secure maintenance state instead.

## Remaining boundaries

- Static textbook task descriptions remain public assets even though private records require a session. No protected teacher content belongs in those files.
- Browser-local drafts and chat remain on that device after sign-out. Use private devices; do not promise encryption or secure deletion.
- Full curriculum coverage needs actual textbook/edition pages, school requirements, and a term calendar. No unknown Unit 1 content or holiday dates have been invented.
- No automated audio upload/transcription, Drive reorganization, NotebookLM workflow, new textbook quizzes, or universal curriculum tracker is included in this first upgrade.
- Readable Google responses, real teacher/student authentication, real AI word help and service migration were checked on activation. Installed-phone and real offline behavior still need a device check. Apps Script can return transient transport errors; the frontend retries safe reads/sign-in, and keeps written submissions until a matching receipt is returned.
