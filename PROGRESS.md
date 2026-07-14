# Open Issues Implementation Progress

Autonomous multi-session effort to implement all 13 open GitHub issues (#25-#36).
This file is the resume point after any usage-limit interruption. Read this file
first on every /loop wake-up before doing anything else.

## Grouping decision (user-approved 2026-07-14)

- Group issues into themed branches/PRs (not one giant branch, not 13 separate ones).
- Auto-merge to main per CLAUDE.md once `npm run ci` is green (no extra confirmation needed).
- Sequencing chosen by Claude to minimize rework, based on each issue's `## Dependencies` section.

## Branch plan (must merge in this order — each branch builds on the previous merge)

### Branch A: `feature/learner-identity-fsrs-core`
Foundational identity + card model + ratings + session-cap invariant. Everything else depends on this.
1. #25 — stable learner identity + restore-first setup
2. #26 — hybrid atomic-fact/template FSRS cards + event-replay migration (depends on #25)
3. #27 — task-aware FSRS ratings, separate fluency from correctness (depends on #26)
4. #28 — one long-term scheduling update per card per session (depends on #26, #27)

### Branch B: `feature/grade3-curriculum-redesign`
Content/visual redesign per skill domain. Depends on Branch A (card model + ratings) being merged to main.
Order: 30, 31, then 32 -> 33 -> 34 (32/33/34 form a real dependency chain; 30/31 are independent, done first since simpler).
5. #30 — area & perimeter: visual concepts, misconception repair, transfer
6. #31 — fractions: visual equivalence, number-line reasoning, comparison
7. #32 — multi-digit addition/subtraction regrouping (place-value subskills)
8. #33 — division fact fluency vs decomposition/unknown-factor reasoning (reuses #32 patterns)
9. #34 — authentic time/measurement/graphs/line-plots/word-problems (reuses #33 division schemas)

### Branch C: `feature/adaptive-lesson-and-goals`
Depends on Branch A (required) and benefits from Branch B content (optional but planner must work without it too).
10. #35 — consolidate overlapping goals, cap daily workload, target-date lifecycle (depends on #26)
11. #29 — separate adaptive "Start Today's Lesson" tile, does not remove existing tiles (depends on #26,#27,#28; consumes #35's goal view)

### Branch D: `feature/scheduling-telemetry`
Capstone. Depends on nearly everything above (#25-#29, #30-#34, #35).
12. #36 — auditable scheduling telemetry + calibration analytics

## Status

| # | Title | Branch | Status |
|---|-------|--------|--------|
| 25 | Learner identity + restore-first setup | A | not started |
| 26 | Hybrid FSRS card model + migration | A | not started |
| 27 | Task-aware FSRS ratings | A | not started |
| 28 | One scheduling update per card/session | A | not started |
| 30 | Area & perimeter redesign | B | not started |
| 31 | Fractions redesign | B | not started |
| 32 | Multi-digit regrouping | B | not started |
| 33 | Division fact vs reasoning split | B | not started |
| 34 | Time/measurement/graphs redesign | B | not started |
| 35 | Goal consolidation + workload cap | C | not started |
| 29 | Adaptive "Start Today's Lesson" tile | C | not started |
| 36 | Scheduling telemetry + analytics | D | not started |

## Current focus

**Active branch:** (none yet — about to create `feature/learner-identity-fsrs-core`)
**Active issue:** #25
**Next concrete step:** Read `src/types/math.ts`, `src/db/dexie.ts`, `src/db/repositories.ts`,
`src/features/dashboard/ProfileSetup.tsx`, `src/App.tsx`, `src/features/sync/snapshot.ts` in full,
then create `src/features/profile/learnerIdentity.ts` per issue #25 spec.

## Resume protocol for each /loop wake-up

1. Read this file.
2. `git status` / `git branch` to see what's actually on disk vs what this file claims.
3. If mid-issue: continue from "Current focus" section above.
4. If an issue's code is done but not committed: commit it (one commit per completed bug fix/feature per CLAUDE.md).
5. If a branch's issues are all done and `npm run ci` is green: push and merge/PR to main per CLAUDE.md auto-merge instruction, then update this file's Status table and move to the next branch.
6. Always update this file's "Current focus" section before ending a work session (context/usage limit).
7. Run `python tools/generate_code_maps.py` after architecture changes and report results per CLAUDE.md.
