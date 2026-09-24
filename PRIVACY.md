# What this app stores, and where

Written 2026-09-24. The students are minors, so this is worth being exact
about. Everything below was read out of the code, not assumed — if you change
where data goes, change this file in the same commit.

## On the student's own device

`localStorage`, per browser. It is never sent anywhere except where noted, and
clearing the browser's site data removes all of it.

| Key | What it holds |
|---|---|
| `re_outbox_v2_<code>:<id>` | Work submitted while offline, waiting to reach Rory |
| `re_outbox_parked_v1_<code>:<id>` | A submission the service refused five times, kept so the student can retry or discard it rather than lose it |
| `re_outbox_meta_v1` | Retry counts and queue timestamps — deliberately separate, so a retry sends exactly the payload first saved |
| `re_draft_v2_<…>` | Unsent answer drafts |
| `re_sr_<code>_<…>` | Vocabulary review schedule |
| `<studentId>_settings` | Theme, text size, palette |
| `re_profile_photo_v1_<code>` | Profile picture, if one was set |
| `re_news_seen_<…>`, `re_install_hint_dismissed` | Which notices have been dismissed |
| `re_sync_drain_lock` | A short-lived cross-tab lock, not student data |

`sessionStorage` holds `re_session_v2_<code>` — the sign-in token, which
expires on its own and is gone when the tab closes. "Keep me signed in" moves
Firebase's own credential to `localStorage` instead; leaving it unticked on a
shared computer is the reason the checkbox says so.

## Off the device

| Where | What goes there | Retention |
|---|---|---|
| Google Apps Script → Sheets/Drive | Homework, answers, progress, uploaded documents | Rory's own Google account. **He controls how long; nothing here deletes it.** |
| Anthropic (Claude) | Document transcriptions and written work, for practice feedback | Sent through Apps Script with the student's work as the message. Not used for training under the API terms |
| OpenAI (live voice) | Speech during a live conversation | `store: false` is set on every session, so OpenAI does not retain the conversation. The identifier sent with it is a SHA-256 hash, not the student's email |
| Firebase Auth | Email address and password hash | Google, for as long as the account exists |

Nothing student-typed is sent to any analytics service. There is no analytics
service.

## Gaps worth closing

- **No retention policy on the Sheets side.** Work accumulates indefinitely in
  Rory's Drive. A student leaving does not cause anything to be deleted.
- **No way for a student or parent to ask for their data back or removed**
  other than asking Rory directly.
- **No written note to parents** covering the three third parties above. For
  minors in Austria that is the one worth doing first.

These are decisions for Rory, not code changes, which is why they are listed
here rather than fixed.
