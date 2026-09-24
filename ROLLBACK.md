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

**Apps Script.** The Sonnet 5 bump changes the checked-in copy only. It reaches
the live script when someone runs `clasp push`, which nobody has.
