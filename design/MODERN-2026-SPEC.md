# Rory's English — 2026 Design System ("VOLTSTONE")

The portable Modern-2026 spec (`~/Claude/design/MODERN-2026-SPEC.md`, "calm precision")
applied to this app, with a **new palette researched for the users: Austrian teenagers**.
Chosen by a 9-agent research + judge workflow (2026-07-18): 3 web-research lanes →
3 candidate palettes → 3 judges (teen-appeal / accessibility / spec-fit) → **unanimous
winner: VOLTSTONE** — electric indigo (the Discord/Knowunity lane, empirically what
German/Austrian teens choose voluntarily) on warm stone, Spotify-charcoal dark mode
as the flagship. All contrast pairs below were independently recomputed by two judges.

**Philosophy:** depth from tone not borders · hierarchy from type not decoration ·
ONE functional accent · motion that settles · zero "baby-app" cues (instant teen rejection).

---

## 1. Palette (Tailwind names kept for cascade — values are new)

| Tailwind class | Hex | Role | Key verified ratio |
|---|---|---|---|
| `navy` | `#17161C` | ink text (light) · **dark-mode base** | 16.96:1 on cream |
| `navy-soft` | `#5A5662` | muted text (light) | 6.73:1 |
| `navy-raised` | `#201E26` | dark-mode raised card (+1 elevation) | — |
| `navy-mist` | `#B3B1BD` | dark-mode muted body text | 7.80:1 on raised |
| `cream` | `#FAF8F5` | warm stone page bg (light) · text (dark) | — |
| `surface` | `#FEFDFB` | light card fill (never pure #fff) | — |
| `amber` | `#A2A4FC` | **bright accent**: dark-mode accent, bright fills w/ ink text | 7.92:1 ink-on-it |
| `amber-deep` | `#4F46E5` | light-mode accent text · primary buttons · light focus ring | 5.93:1 on cream |
| `amber-press` | `#4338CA` | hover/pressed | 7.90:1 white-on-it |
| `amber-soft` | `#ECEAFD` | light active-pill wash | accent text 5.32:1 |
| `amber-dusk` | `#262347` | dark active-pill wash | — |
| `burgundy` | `#C2410C` | **ember reward channel** (streak/progress) text on light | 4.89:1 |
| `burgundy-deep` | `#9A3412` | text on the soft wash | 6.16:1 |
| `burgundy-soft` | `#FDE8D8` | streak-pill wash (light) | — |
| `burgundy-bright` | `#F59D6E` | dark-mode ember numerals | 8.50:1 on base |
| `good` / `-soft` / `-bright` / `-dusk` | `#166534` `#F0FDF4` `#4ADE80` `#16281C` | success | 6.81:1 |
| `warn` / `-soft` / `-bright` / `-dusk` | `#92400E` `#FFFBEB` `#FBBF24` `#2E2413` | due-soon | 6.84:1 |
| `bad` / `-soft` / `-bright` / `-dusk` | `#BE123C` `#FFF1F2` `#FDA4AF` `#2E1A1E` | overdue/error | 5.72:1 |

**Hard rules that fell out of the math (judge-verified):**
1. `amber-deep #4F46E5` is **2.86:1 on the dark base — NEVER** a ring/icon/text in dark
   mode. Dark always accents with `amber #A2A4FC`.
2. Filled accent buttons: light mode = `amber-deep`→`amber-press` gradient + **white**
   text; dark mode = `amber` fill + **navy (ink)** text (the Spotify pattern). Never ink
   text on `amber-deep`, never `text-amber` (bright) on light backgrounds.
3. `burgundy` (ember) is reward-only — streaks, progress, celebration. Never for errors
   (that's `bad`), never as a second UI accent.
4. Status = soft-tint pattern: `bg-good-soft text-good` light / `bg-good-dusk
   text-good-bright` dark. Same for warn/bad.

## 2. Surfaces
- Light card: `bg-surface rounded-card shadow-card` (+ `border border-black/[.06]` where
  structure needs it). Dark card: `dark:bg-navy-raised dark:shadow-card-dark` — depth
  from tone, no visible borders.
- Radius vocabulary: **8 (`rounded-lg`) / 12 (`rounded-xl`) / 20 (`rounded-card`) / pill**.
- Glass (`.glass`): EXACTLY two uses — the AI tutor surface + the floating tab bar.

## 3. Type
- **Manrope** (`--font-sans`, next/font, self-hosted) — 3 working weights.
- Headers: `.display` (−0.02em, 800). All data (scores/streaks/dates): `.tnum` or
  `font-mono` (JetBrains Mono) for tiny data labels.

## 4. Motion
- Default `ease-out2026` 120/200ms. Overlays/sheets: `animate-sheet` (spring settle).
- Buttons: `active:scale-[.97]`. Reduced-motion guard already global.

## 5. AI presence (AiCoachView)
- Panel = the one glass surface; tutor bubble = indigo gradient + `shadow-glow`
  (`shadow-glow-dark` in dark); "thinking" = `.ai-shimmer` text sweep.

## 6. Teen rules (from the research — violations = instant "baby app" rejection)
- Dark mode is the flagship; charcoal tones, never #000. No cartoon mascots, no
  primary-color triads, no ambient confetti (the single earned burst in
  `src/lib/celebrate.ts` is Rory's choice, 24 Sep), no hype copy, no emoji-dense UI.
- Streak stays **chill**: quiet ember counter, zero guilt mechanics.
- One accent, functionally. The moment indigo becomes decoration, restraint is gone.

## 7. Landing / sign-in moment
Two layered radial glows over the page: indigo `#4F46E5` core + violet `#8B5CF6` halo
at low opacity — the one Twitch-y flourish, contained to the entry moment.

---
*Research + judging: workflow `wf_e1086501-2ac` (9 agents, journal in session dir).
Reference implementation of the portable spec: `projects/assistenze-care-app`.*


## Complete work feedback · 28 October 2026

Use the same sentence table in uploaded writing, retained writing reviews and new typed homework. Table order: original, corrected, optional stronger wording, checks/explanation. Correct rows may collapse; no sentence is omitted. Below it, retain the full original, corrected and optional example as paragraphs. Use the established red/green/blue writing tokens consistently in headings, borders and changed-word highlights; preserve unchanged words and paragraph gaps. Corrections expose their reason on demand. The table scrolls within its container on small screens. Put new practice beneath the full text and keep answers hidden until the learner saves a try. Show saved conversation feedback beside its audio original and in Speaking, with an explicit caption limitation. Rory's private checks never appear in student/parent/preview views. An AI result is not a formal teacher mark.


## One map and Find · 12 November 2026

`src/lib/student-navigation.ts` is the only definition of where student pages live. It has five sections, one per tab (Today, Homework, Speak, Lessons, Feedback); each section lists its pages in `more` and may `own` unlisted pages (notifications, year plan). The tab bar, the sidebar and the menu all render from it, and `navPlace()` decides which tab is lit, so a page cannot be listed under one section and light another. A new student route must be added to the map; `tests/find.test.mjs` fails otherwise.

- **Tab bar:** the five sections. A homework task lights Homework although its address sits under its unit.
- **Sidebar (desktop):** Find, then each section with its pages indented beneath, without icons. The student’s name appears once, at the bottom.
- **Menu (phone):** Find, then only the pages that are not tabs, grouped under their tab’s name, each with a short hint. Then Settings, What’s new and Sign out.
- **Find** (`FindBox`, `src/lib/find.ts`): one search field, 44px, 16px text so iOS does not zoom. Matches pages, released homework, available units and lesson files for students; students, workspace pages and the seven student sections for the teacher. It runs on the device and sends nothing. Homework with a future `availableFrom` and unavailable units are never returned. Results show name, hint and kind; arrow keys and Enter work; “/” focuses the sidebar field. Never auto-focus it when the menu opens, because that raises the phone keyboard.
- **Words:** each place carries hidden search words, German included. Add a synonym there rather than renaming a page.
- **Back:** the top bar owns Back. Pages do not add a second one.
- Styles live in `visual-refresh/navigation.css` and use only the shared type sizes, the 10px radius and colour tokens.

## Shorter Today and teacher focus · 12 November 2026

Four separate steps, each with its own rollback area.

- **Today diet (`today-diet`).** Today keeps the next step, the weekly rings summary, current tasks, the lesson and Practice desk rows, the seven-day strip and the year plan. The full practice panel moves to Feedback under `#weekly-practice`; Today mounts it with `summaryOnly` so the rings use the same loads and credit rules. Rows that repeat a tab (Speak, Feedback) are not drawn on Today.
- **Four teacher tabs (`teacher-tabs`).** One student's workspace shows Dashboard, Work, Teach and Results. The seven sections and their `?section=` addresses are unchanged; `TEACHER_GROUPS` and `TEACHER_FIND_SECTIONS` in `src/lib/find.ts` are the only list, and the workspace draws tabs and the row of pages from it. A tab opens on its first page; a tab with one page shows no second row.
- **Needs you today (`needs-you`).** The teacher home opens with one list from `teacherNotifications` and the student summaries: unread messages, feedback to check, new work, then students with no saved activity for seven days. One row per student per kind, oldest wait first, six rows at most. A failed check says so and never reads as all clear. The list marks nothing as read.
- **Dashboard folds (`dashboard-folds`).** A block of the learning dashboard with nothing in it is hidden, not unmounted, and named as a button in a "Nothing here yet" bar; Show all opens every block. Lesson brief and Practice overview always show. New styles use `--re-*` tokens only.

## Homework that has not opened · 13 November 2026

A homework week with a future `availableFrom` shows one `week-notice` line, "This homework opens on <date>" (Vienna date, `lessonDate`), and the existing Back to homework link, instead of the week's tasks. `isHomeworkReleased` in `src/lib/homework-release.ts` is the single release rule.
