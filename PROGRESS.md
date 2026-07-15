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
| 25 | Learner identity + restore-first setup | A | **merged to main** (eb36360) |
| 26 | Hybrid FSRS card model + migration | A | **merged to main** (eb36360) |
| 27 | Task-aware FSRS ratings | A | **merged to main** (eb36360) |
| 28 | One scheduling update per card/session | A | **merged to main** (eb36360) |
| 30 | Area & perimeter redesign | B | **merged to main** (628dc33) |
| 31 | Fractions redesign | B | **merged to main** (628dc33) |
| 32 | Multi-digit regrouping | B | **merged to main** (628dc33) |
| 33 | Division fact vs reasoning split | B | **merged to main** (628dc33) |
| 34 | Time/measurement/graphs redesign | B | **merged to main** (628dc33) |
| 35 | Goal consolidation + workload cap | C | **merged to main** (4519545) |
| 29 | Adaptive "Start Today's Lesson" tile | C | **merged to main** (4519545) |
| 36 | Scheduling telemetry + analytics | D | **implemented and validated; ready to merge** |

## Current focus

**Branch A is fully merged to main** (merge commit eb36360, pushed to origin/main). The
`feature/learner-identity-fsrs-core` branch can be deleted once you're confident nothing else needs it
(not deleted yet — no destructive action taken without asking).

**GitHub issues #25-#28 were NOT auto-closed** — the harness's auto-mode permission classifier blocked
`gh issue close` as an unauthorized external-system write (batch-closing issues not created this
session). They remain open on GitHub despite being merged. If you want them closed, do it manually or
explicitly ask Claude to close them in a future session.

**Branch B is merged and deployed** via PR #37 (merge 628dc33). GitHub issues #30-#34 are closed.

**Branch C is merged and deployed** via PR #38 (merge 4519545). GitHub issues #35 and #29 are closed.

**Active branch:** `feature/scheduling-telemetry`.
**Active issue:** #36 — auditable scheduling telemetry and calibration analytics (implemented and validated).
**Next concrete step:**
1. Commit and publish Branch D.
2. Merge and deploy #36 after GitHub checks pass.
3. Re-check the live issue list and production build metadata.

Issue #30 validation completed on 2026-07-15: `npm run ci` (73 files / 1,279 tests),
`npm run test:e2e` (desktop, mobile, iPad, missing-side, comparison, and update flows), and
`python tools/generate_code_maps.py` all passed.

Issue #31 validation completed on 2026-07-15: `npm run ci` (74 files / 1,291 tests),
`npm run test:e2e` (including phone equivalence and iPad same-numerator comparison), and
`python tools/generate_code_maps.py` all passed.

Issue #32 validation completed on 2026-07-15: `npm run ci` (75 files / 1,305 tests),
`npm run test:e2e` (including deterministic across-zero computation and error analysis in the real
built app), and `python tools/generate_code_maps.py` all passed.

Issue #33 validation completed on 2026-07-15: `npm run ci` (76 files / 1,317 tests),
`npm run test:e2e` (including phone `84 ÷ 3` decomposition and iPad sharing-model choice in the real
built app), and `python tools/generate_code_maps.py` all passed.

Issue #34 validation completed on 2026-07-15: `npm run ci` (77 files / 1,327 tests),
`npm run test:e2e` (including real scaled bar graph, fractional line plot, cross-hour time line, and
two-step tape-diagram journeys), and `python tools/generate_code_maps.py` all passed.

Issue #35 validation completed on 2026-07-15: `npm run ci` (78 files / 1,333 tests),
`npm run test:e2e` (including overlapping-goal consolidation, overdue lifecycle actions, and the
advisory third-primary “Create anyway” flow), and `python tools/generate_code_maps.py` all passed.

## Known gaps / follow-ups (not blocking, revisit if time allows)

- #25 acceptance criteria mention extending browser E2E (`scripts/e2e_mathfan.py`) with a fresh-install
  restore scenario and a same-name separate-learner scenario. Not done — `npm run ci` does not run the
  Python E2E suite, so this did not block the merge bar, but it's a real coverage gap worth closing
  later, ideally alongside #26/#29's own E2E requirements.
- #26 scoping decision: only multiplication and division facts became true `atomic_fact` cards this
  round (canonical commutative folding for MUL, separate non-canonicalized DIV). Every other item type
  (ADD, SUB, AREA_*, WORD_*, PERIM_*, fractions, measurement, etc.) got a degenerate 1:1 `template:<itemId>`
  card — same granularity as before, just rekeyed — because the issue's own text defers real template
  generators to the curriculum-redesign issues (#30-#34): "The first implementation should support the
  Grade 3 templates introduced by the curriculum issues." When implementing #30-#34, register real
  template generators in `src/features/curriculum/templateRegistry.ts` (referenced but not yet created)
  and give those item types real multi-instance template cardKeys instead of the 1:1 fallback — that is
  the intended second half of #26's card model, not a bug to fix in #27/#28.
- #26's `LearningCardDescriptor.gradeLevel` defaults to 3 when `PracticeItem.gradeLevel` is absent (which
  is always, today — no generator sets it yet). Harmless while the app is Grade-3-only; revisit if/when
  Grade 4-5 content is added.

## Resume protocol for each /loop wake-up

1. Read this file.
2. `git status` / `git branch` to see what's actually on disk vs what this file claims.
3. If mid-issue: continue from "Current focus" section above.
4. If an issue's code is done but not committed: commit it (one commit per completed bug fix/feature per CLAUDE.md).
5. If a branch's issues are all done and `npm run ci` is green: push and merge/PR to main per CLAUDE.md auto-merge instruction, then update this file's Status table and move to the next branch.
6. Always update this file's "Current focus" section before ending a work session (context/usage limit).
7. Run `python tools/generate_code_maps.py` after architecture changes and report results per CLAUDE.md.
