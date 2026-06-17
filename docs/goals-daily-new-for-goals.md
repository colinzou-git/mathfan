# Goals, Daily New for Goals, and Daily Review

Last updated: 2026-06-17

This document describes the final product model for learning goals, adaptive goal evaluation, Daily New for Goals, Learn Extra, and their relationship to FSRS Daily Review.

## Product Model

MathFan keeps new learning and scheduled review separate:

```text
Daily New for Goals = unseen items from incomplete active-goal skills
Daily Review = previously learned items scheduled by FSRS
```

Daily New for Goals introduces new material for active goals. After the student makes a direct first attempt on an item, that item is no longer eligible for Daily New. Future practice for that item belongs to Daily Review when FSRS marks the item due.

Learn Extra is optional out-of-plan new learning. It uses the same unseen-item rule as Daily New for Goals, but it can exceed the planned daily workload without changing goal deadlines, thresholds, or lifecycle gates.

## Eligibility Rules

Daily New for Goals and Learn Extra use canonical `mathAnswerEvents` to identify seen items:

- A direct first attempt is `!isRetry && !relatedEvidence`.
- Previously directly attempted items are excluded from planned and extra Daily New work.
- Currently due `itemStates` are excluded from Daily New even when the due state came from related evidence.
- Planned Daily New item IDs are stable for the student's local day.
- Completing planned work marks the planned tile complete and does not silently refill required work.
- A new local day produces a fresh plan from the remaining unseen active-goal material.
- Legacy `origin: 'daily_recommended_learning'` events remain readable as historical Daily New completion data.

Daily New does not create a separate `review_for_goal` mode. Review remains Daily Review.

## Data Flow

The main flow is:

1. Goals are stored in `learningGoals`, with append-only lifecycle records in `goalEvents`.
2. Goal baselines are captured from existing canonical answer events, item states, and skill summaries.
3. `planDailyNewForGoals` derives planned and extra unseen batches from active incomplete goal targets.
4. Starting a tile creates a normal practice session with `origin: 'daily_new_for_goals'`.
5. Planned sessions carry `goalLearningKind: 'planned'`; Learn Extra sessions carry `goalLearningKind: 'extra'`.
6. Practice writes canonical `mathAnswerEvents`, compatibility `attempts`, and FSRS `itemStates`.
7. Goal progress is derived from events and states; it is not maintained as a conflicting manual counter.
8. Once an item becomes due, dashboard Daily Review reads the due item state and Daily New excludes the item.

The optional multi-goal fields `goalIds` and `goalTargetIds` preserve attribution when one tile supports overlapping goals. The single `goalId` and `goalTargetId` fields remain for compatibility.

## Adaptive Goal Evaluation

Adaptive goal evaluation is a 30-question planning aid, not a standardized calibrated test. It combines catalogue coverage, uncertainty, existing history, and response evidence to separate:

- new or unfinished learning that can become goal targets
- review findings that belong in Daily Review
- strengths

Evaluation writes are idempotent. If saving an answer fails and the student retries the save, the same event identity is reused. Closing and reopening the app resumes the latest in-progress evaluation at the next unanswered question.

## Sync and Snapshot Notes

Drive snapshots are versioned:

- Snapshot version 1 contains the original learning data shape and may omit goal arrays.
- Snapshot version 2 adds `learningGoals`, `goalEvents`, and `goalEvaluations`.

The merge strategy keeps `mathAnswerEvents` canonical, unions append-only goal events by ID, and merges mutable goals/evaluations by the latest valid `updatedAt`. Derived caches such as `itemStates` and `multFactStats` are rebuilt from merged events after sync.

New Daily New sessions write `origin: 'daily_new_for_goals'`. Existing snapshots with `origin: 'daily_recommended_learning'` remain valid and are not rewritten.

## Determinism and Limits

Recommendation and planning are deterministic for the same inputs and local date. Daily New planning uses precomputed sets for direct attempts, due items, planned IDs, completed Daily New IDs, and extra IDs so the dashboard can stay responsive with larger histories.

The recommendation engine estimates practical goal workloads from available skills, uncertainty, recent evidence, active-goal overlap, and daily goal minutes. It is a prioritization aid, not a guarantee that every student will master a skill inside the selected duration.

