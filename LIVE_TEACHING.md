# Live teaching · first working version

This is a full-screen teacher presenter workspace in the existing app. Open Teacher → **Live teaching**, or `/teacher/live/`. It uses the existing teacher sign-in and student list. It includes current-slide display, running commentary, private AI questions, and a slide-only audience window. It does not change student homework, submit assessments or synchronise the student's iPad slide selection.

## Try the workflow

1. Sign in as the teacher and choose a learner. Try **Prepared rehearsal** to see two clearly labelled examples without microphone access or a paid AI request. These are interface examples, never learner evidence.
2. Enter the speaking activity and teaching objective. Open a `.pptx` below 3 MB to extract slide text and select the current slide. The importer follows the deck's presentation order. Graphics, layouts, animations, notes, embedded audio and image-only text are not extracted: check the source and supply missing instructions in the context box. Decks with more than 200 slides are rejected.
3. Open a PDF exported from PowerPoint (below 25 MB, at most 200 pages) for visual presentation. PDF.js renders the original page and extracts its text locally. Previous/Next changes the current-page image and source text used by the AI. Current slide images are sent privately to the AI when connected or when asking a question; the full PDF is not uploaded. Animations and embedded media are not played. Neither PDFs nor imported PowerPoints are published into student resources or committed to GitHub.
4. For a live test, confirm the learner/parent arrangement, start listening, and select the current microphone speaker: the learner, Rory, or unassigned. The first version has no automatic speaker separation; it must not be mistaken for verified diarisation. Captions appear in a named running commentary with a correction selector. Teacher/unassigned speech cannot produce a displayed learner correction. Corrected labels are supplied as evidence to the ongoing AI session. Feedback arrives after completed answers and shows a faithful quote, strength, priority, minimal correction, teacher prompt and next practice step. Machine captions can mishear or normalise mistakes; the teacher remains responsible for checking evidence.
5. Export notes explicitly to retain them. Feedback lives in browser memory, with a maximum of 100 entries; reloading discards it. Changing learners clears the previous context and feedback. No audio recording or automatic student submission is made. The AI provider processes live audio and selected context while connected; this does not guarantee zero provider retention. The text Responses request uses `store:false`.
6. Ask the AI a private question from the commentary panel. It receives the current slide image, selected source text and up to eight recent conversation entries. Prepared rehearsal is excluded from real lesson evidence.
7. For an online lesson, choose **Open student window** and share that window through Zoom or Meet. Only slide images and page numbers are sent to that window. It synchronises with the presenter using a randomly scoped browser-local channel; it is not a remotely joinable call room or an iPad pairing service. A built-in call service is not implemented. Confirm which window you share in the call application.

## AI configuration and integration

The new teacher-only `/api/live-coach/` route verifies the existing teacher session against the progress backend before status, imports, or paid requests. It enforces same-origin requests, bounded payloads, server-selected models and per-instance request limits. No secret reaches the browser. Realtime uses native audio input and text-only output; it does not create a speaking partner or mute a generated voice. The dedicated feature flag is independent of the student's speaking studio. [Research and design decisions](LIVE_COACH_RESEARCH.md) identify relevant precedents and their limits.

Private environment configuration:

- `OPENAI_API_KEY`: a server credential with credit and access to the selected models.
- `APPS_SCRIPT_URL`: the existing authenticated progress backend.
- `LIVE_COACH_ENABLED=true`: enable only on the reviewed test deployment once access and billing are checked. Absent or false keeps live/typed AI off; imports and prepared rehearsal still work after teacher sign-in.
- Optional `LIVE_COACH_MODEL` (default `gpt-realtime-2.1`) and `LIVE_COACH_TEXT_MODEL` (default `gpt-6-sol`). The text model is used only for manually entered answers.

The browser stops listening on exit, page backgrounding, connection failure, microphone disconnection, or after 15 minutes. The teacher can reconnect explicitly. This client timer and per-instance rate limiting are not an account-wide spending cap. Configure Platform project limits and verify them before routine lesson use.

## Review and validation

Work belongs on `codex/live-teaching-coach` for review before merging. GitHub holds source only. Use the existing Vercel project's preview deployment rather than changing hosting or publishing the source to a second service. The existing README recorded a previous voice failure due to exhausted API credit; that historical note is not a current billing check. No new key was created by this implementation.

Run `npm run lint`, `npm test`, and `npm run build`. Targeted tests cover teacher access, request limits, structured feedback parsing, presentation order, corrupt archives and decompression bounds. A real teacher-authenticated WebRTC session and iPad/Safari permission handling need a device check with available API credit. Live AI quality, response timing, mixed speakers and actual pronunciation analysis are unverified until that test succeeds.

Official implementation references: [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime), [Realtime calls](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create), and [Realtime events](https://developers.openai.com/api/docs/guides/realtime-conversations).
