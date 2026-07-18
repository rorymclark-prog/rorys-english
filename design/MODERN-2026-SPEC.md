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
  primary-color triads, no confetti, no hype copy, no emoji-dense UI.
- Streak stays **chill**: quiet ember counter, zero guilt mechanics.
- One accent, functionally. The moment indigo becomes decoration, restraint is gone.

## 7. Landing / sign-in moment
Two layered radial glows over the page: indigo `#4F46E5` core + violet `#8B5CF6` halo
at low opacity — the one Twitch-y flourish, contained to the entry moment.

---
*Research + judging: workflow `wf_e1086501-2ac` (9 agents, journal in session dir).
Reference implementation of the portable spec: `projects/assistenze-care-app`.*
