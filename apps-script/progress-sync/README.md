# Authenticated progress service and Vercel release

Status, 18 September 2026: all three existing versioned public Apps Script deployments run version 29. Vercel project `rorys-english` serves the Next.js app and `/api/service/`; Firebase project `rory-automation` manages student email/password accounts. The earlier GitHub Pages build, progress sheets, student codes and teacher login are preserved.

## Identity and records

- Deploy **Code.gs, V2.gs and FirebaseAuth.gs**, preserving the remote manifest and any unrelated remote edits. Only V2.gs defines public doGet/doPost.
- GET exposes health/version only. Private records require authenticated POST.
- The Vercel server verifies the Firebase token signature and exact project, then checks verified email and fixed UID against the server-only roster. Managed student requests cannot run teacher actions.
- Apps Script validates the same ID token with Google, requires verified email and server-managed `studentCode`/`role` custom claims, and issues a student session bounded by token expiry. A route identifier alone grants no access.
- Existing student/parent codes and the teacher Script Property password still work. Legacy/shared-device sessions last up to six hours; rotating a code revokes earlier sessions.
- Teacher “Keep me signed in” issues a 30-day device token after password verification. Only its hash is stored in durable Script Properties (not the evictable six-hour cache); every request checks expiry and the current password version. Logout deletes that record; password changes revoke remembered sessions. At most 20 remembered devices are retained. The browser stores a bearer session, never a password; use this only on a private device. Student Firebase persistence and ID-token lifetimes are unchanged.
- Submissions preserve exact original answers. Duplicate retries return the existing receipt; revisions create a new submitted copy. Teacher feedback does not overwrite answers.
- Resource reads never search Drive or alter sharing. Only teacher-approved student-safe links are presented.
- AI remains on the existing Anthropic provider. Teacher analyses remain drafts until explicitly published; practice AI is not a school grade.

## Configuration

Vercel client configuration uses `NEXT_PUBLIC_SYNC_URL=/api/service`, an empty `NEXT_PUBLIC_BASE_PATH`, Firebase Web SDK fields and `NEXT_PUBLIC_GOOGLE_SIGN_IN=false`. See `.env.example` at the repository root. The Web API key identifies the public Firebase project; it does not authorize private-record access.

Server-only Vercel configuration is `APPS_SCRIPT_URL`, `FIREBASE_PROJECT_ID` and `ACCOUNT_ROSTER_JSON` mapping each route to `{email, uid}`. Do not put the roster in public JSON or client environment variables. Firebase verification uses public signing certificates and an exact project ID; no service-account private key is deployed.

Existing Script Properties (sheet mappings, TEACHER_PASSWORD, ANTHROPIC_API_KEY, hashed access codes and approved resources) remain on Google. No shared browser secret is supported.

Each invited learner has a pre-created Firebase account with matching server claims and roster entry. First visit: **Set or reset password**, choose a password through their email, verify the email if prompted, and sign in. No student password is chosen, stored or distributed by the app operator. Remembered sign-in uses Firebase local persistence; the shared-device option uses session persistence. Google sign-in is hidden until the provider is configured and checked. School/family Google-account restrictions are unconfirmed; email/password does not require Google sign-in.

## Future releases

1. Inspect the maintained checkout and latest remote source before editing. Back up remote Apps Script content and deployment versions before backend changes; back up affected sheets before structural changes.
2. For ordinary homework content, update the existing student/unit schema and keep archived permanent links. A teacher dashboard assignment is immediate and needs no build. Routine content changes need no new backend deployment.
3. Run `npm test`, `npm run lint`, `npm audit` and `npm run build` with production configuration and no demo mode. The prebuild script generates manifests and a deployment-specific service-worker cache.
4. Push source to GitHub and publish with `vercel --prod` to the existing `rorys-english` project. Do not use the retired Pages script: the account API needs a server runtime.
5. Check the actual deployment URL, student/teacher routes, required media, unauthenticated denials and relevant workflow. Use synthetic checks without leaving fabricated learner evidence. A successful API test does not establish installed-phone behavior or actual student sign-in.
6. Backend changes must update every publicly accessible versioned deployment; never restore an old unauthenticated endpoint as a fallback. Preserve teacher access and existing records.

Rory already authorized the September launch and this login/hosting migration. Follow the authorization in the active task for later changes; these steps do not add a redundant permission gate.

## Practical boundaries

Static task descriptions and approved public assets remain downloadable; do not place teacher notes, answer keys, private feedback or full copyrighted books in them. Browser-local drafts and chat stay on the original device and origin. Moving from the old Pages URL to Vercel does not move unsent local drafts, although submitted records remain in the same Google service.

Live checks covered password-setup eligibility, real Google-signed identity verification, authenticated progress and denied cross-student/teacher access. Earlier activation also checked answer receipts, deduplication, feedback and revisions with synthetic records that were removed. Browser automation, installed-phone behavior and real student first sign-in remain unverified. The Vercel transport opens fresh IPv4 TLS connections, follows up to three additional redirects between the exact Google script hosts, and uses one 40-second deadline for the whole exchange. Only the result GET can be retried; an uncertain write or AI call is never replayed. Do not restore the former 15-second per-result timeout or reject a legitimate second Google result redirect. Logs include only a safe failure stage and HTTP status, never URLs, request bodies, passwords or response data. Keep failed answer transmissions in the outbox until a matching receipt arrives.
