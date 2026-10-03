# Lesson calendar

Rory’s English has a teacher lesson calendar at `/teacher/calendar/`, student
calendars at `/s/<student-code>/calendar/`, and parent calendars at
`/p/<parent-code>/calendar/`. Today displays the next scheduled lesson.

## Teaching workflow

1. Add each student's confirmed school-break ranges first. Both endpoints of
   a break are included. Breaks are entered per student, so different school
   calendars can be respected. No holiday dates are inferred.
2. Schedule the first confirmed date and time, a duration (90 minutes by
   default), and an explicit series end date. Choose one lesson or every two
   weeks. Repeating lessons preserve their Vienna wall-clock time across clock
   changes. The missing spring hour and ambiguous autumn hour are rejected.
3. Dates inside breaks are skipped without changing the fortnightly pattern.
   A break added later cancels existing lessons within its dates. Removing a
   break does not silently rebook cancelled lessons.
4. Change or cancel an individual lesson. Rebook restores a cancelled lesson.
   Checks prevent Rory from scheduling overlapping lessons across students.
5. Students and parents can request a new time. Rory accepts or declines it;
   the existing booking remains until accepted. A stale request cannot override
   a later teacher edit. Requests are shown in the calendar, with no email,
   WhatsApp or push messages sent automatically.

## Calendar subscriptions

Create or replace a private link, then subscribe using Google Calendar's
“From URL”, Apple Calendar's subscription feature, or Outlook's “Subscribe
from web”. These are read-only subscriptions; importing a downloaded file
would be a one-time copy and would not keep updating. The app remains the
source of truth because provider refreshes can be delayed by more than a day.

The teacher can subscribe to all students or just the selected student.
Students and parents have independent links, and teacher links are separate
from learner links. Replacing a link revokes the previous link for that scope.
Disable calendar link revokes it. Link tokens are generated on request, kept
in component memory, and only their SHA-256 hashes are stored by the backend.
Losing the displayed link requires explicitly creating a replacement and
updating the subscription. Anyone holding the URL can read the lesson times,
lesson titles and locations. The link exposes no homework, feedback, files or
request messages. Teacher-password/access-code rotation invalidates links
for the corresponding identity. Already-downloaded calendar entries may
remain after revocation.

Events use permanent UIDs, UTC start/end times, incrementing SEQUENCE values,
LAST-MODIFIED dates, cancellation tombstones, UTF-8 folding and escaped text.
A one-hour display reminder is included, subject to the calendar provider's
subscription/reminder handling. No external provider account is connected or
read; this release does not implement availability checks or direct Google/
Microsoft event-writing permissions.

## Storage and access

`Calendar.gs` uses new `Lessons`, `Lesson requests`, and `Lesson breaks` tabs
inside each existing private progress workbook. Ordinary reads do not create
these tabs or change old records, tab structure or file sharing. Each row is
an identifier plus JSON, preserving literal user text. Teacher saves and
responses use the script lock, permanent request identifiers and sequence
checks. A series is appended in one batch. Retries do not duplicate a series,
request or cancellation, and stale writes are refused.

The existing session service, Firebase roster verification and read-only
student preview apply to all calendar actions. The separate `calendarFeed`
backend action validates only a scoped high-entropy token and exposes minimal
calendar fields. `/api/calendar/` returns ICS with no-store and no-referrer
headers. Invalid/revoked links return 404; service failures return 503, never
an empty successful calendar. The service worker excludes `/api/` requests.
No tokens, event contents or private bearer-link URLs are logged by app code.

## Checks

`npm test`, `npm run lint`, `npm audit`, `npm run build`. Browser checks use
`scripts/qa-calendar-api.mjs` (actual Calendar.gs, entirely in-memory) on port
4194 and `scripts/qa-calendar.mjs` against a local app on port 4193. Start that
local app with an empty Firebase public API key, demo mode, and its public
sync URL pointed to the in-memory server. Never deploy the demo configuration.
`CALENDAR_QA_OUT` selects a private screenshot/results directory.
