# Rollback — 2026-09-24 audit pass

Three levels, smallest first. Pick the smallest one that solves the problem.

Everything below is local. Nothing has been pushed.

## 1. Roll back one screen's look

The per-feature switch, unchanged from before this pass except that the
student sign-in screen is now its own feature rather than part of `entry`:

```bash
npm run ui:rollbacks
```

```bash
npm run ui:rollback signin
```

Restore it with `npm run ui:restore signin`. The working tree must be clean
first — the script refuses otherwise, on purpose.

This reverts **presentation only**. The correctness fixes in the same files —
the visibility-gated session polling, and the theme script sitting above the
sign-in gate — stay in place either way. Verified in both directions:
rolled back and restored each typecheck and build.

## 2. Undo one change

Each item in this pass is its own commit with nothing else in it, so any one of
them can go without touching the rest:

```bash
git log --oneline pre-audit-2026-09-24..HEAD
```

```bash
git revert <commit>
```

The commits, oldest first:

| Commit | What it does | Safe to revert alone |
|---|---|---|
| `31b37c8` | Outbox: stop one refused submission blocking the queue | Yes — reverts its tests with it |
| `a01f0c9` | Dark mode follows the phone by default | Yes |
| `5764da1` | Sign-in screen on design tokens, theme above the gate, opening state | Prefer `ui:rollback signin` for the look alone |
| `3ab9651` | Security headers, error screens, visibility-gated polling | Yes |
| `a84e24f` | CI, Dependabot, Sonnet 5 | Yes |
| `433a082` | The `signin` rollback feature itself | Only together with `5764da1` |
| `8b7ce6e` | ROLLBACK.md, the plan correction, PRIVACY.md | Yes — documentation only |
| `9433992` | Roster drift check, generated files ignored, streak guard | Yes |
| `8c514cc` | The last two rows of this table | Yes — documentation only |
| `77dec06` | Stay signed in across closing the app | Yes — students go back to signing in every time |
| `48676eb` | The two rows above | Yes — documentation only |
| `f5aad52` | Seven-day strip and streak back on Today | Prefer `ui:rollback momentum` for the strip alone |

### `unit-cover` (slide-deck picture on unit cards)

`npm run ui:rollback unit-cover` removes the picture from both the Lessons unit
card and the Today "Current unit" panel, and switches off
`visual-refresh/unit-cover.css`. The image files and the `coverImage` fields in
`units.json` stay put — they are data, not presentation, and nothing else reads
them.

### `speaking-budget` (weekly speaking allowance)

`npm run ui:rollback speaking-budget` takes the 15-minute weekly allowance off
the speaking screen: conversations go back to a flat 15-minute cap per call
with nothing counted between them. It is the first rollback feature with no
stylesheet of its own — it changes behaviour and wording, not layout — so it
sits in the `unstyled` set in `scripts/ui-rollback.mjs` beside `settings`.

`src/lib/speaking-budget.ts` and its tests stay in place, unused, the same way
`storage.ts` survives a `momentum` rollback. Nothing else reads the counter, so
nothing else breaks. What it does **not** touch is the real ceiling: the monthly
spend cap in the OpenAI dashboard. Roll this back and students can talk as often
as they like until that cap stops them.

`speaking.patch` had to be re-recorded in the same commit, because the allowance
wording sits inside lines that patch already quoted. The two are independent
after that: rolling back `speaking` keeps the allowance, and rolling back
`speaking-budget` keeps the speaking visuals.

### Three patches need re-recording

`npm run ui:rollbacks` reports `signin`, `homework` and now `today` as
**changed since release**:

```bash
npm run ui:rollbacks
```

`signin` and `homework` were already in that state before this pass — their
files moved under them in earlier commits and nobody regenerated the patch.

`today` is different: it was regenerated in `f5aad52` and has gone stale again,
because the unit picture added a line to `TodayView.tsx`. That is the recurring
cost of a whole-screen patch sitting under feature-sized ones — **any** change
to `TodayView.tsx` breaks it, and it has now broken twice in one day. Either
re-record it each time that file changes, or retire it and keep only the
feature-sized switches (`momentum`, `unit-cover`), which survive each other's
edits because each touches its own lines.

`momentum.patch` and `unit-cover.patch` were both recorded against the shipped
`TodayView.tsx`, so either can be rolled back without the other. Rolling back
`today` would still take both with it — the pre-refresh Today screen predates
them — so restore `today` before touching either.

## 3. Undo the whole pass

The checkpoint tag is the state before any of this:

```bash
git diff pre-audit-2026-09-24..HEAD --stat
```

To abandon everything, delete the branch. The audit was done in a separate
worktree, so Rory's own checkout was never touched and has nothing to undo:

```bash
git worktree remove ../rorys-english-audit && git branch -D audit/hardening-and-teen-ui
```

## Two things that do not roll back this way

**The CSP.** It ships as `Content-Security-Policy-Report-Only`, so it already
blocks nothing — there is nothing to roll back until someone renames the header
in `next.config.mjs`. Do that only after a week of real use reports nothing.

**Apps Script.** The Sonnet 5 bump and the remembered student session change
the checked-in copy only. They reach the live script when someone runs
`clasp push`, which nobody has.

**Half of `77dec06` is already useful without that push.** The client stops
throwing away a session when the app closes, which turns "sign in every time"
into "sign in at most once every six hours" the moment it deploys. The push is
what turns six hours into thirty days. Reverting the commit reverts both
halves; to keep the client half and drop the server half, revert only
`apps-script/progress-sync/V2.gs` and its README.
