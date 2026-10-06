# Grade 4 foundation: Units 1–2

Issue #100 adds the first complete Grade 4 slice: six factors/patterns skills and seven place-value/addition/subtraction skills. Readiness is Unit 0, outside the two content units. The Math Map names later content as future phases; estimate/check provides partial support for 4.OA.3, not full multistep/remainder coverage.

## Contracts and compatibility

`curriculumRegistry.ts` is the versioned registry for units, standards, prerequisite edges, evidence profiles, blueprints, misconceptions, instruction, and transfer relations. Grade 3 adapts the existing map without changing its IDs. Legacy rounding/pattern aliases resolve explicitly. Registry validation rejects duplicates, missing references, and prerequisite cycles.

Foundation items carry grade, skill, standards, schema/card identity, representation, generator version, seed, tagged answer, and original-content provenance. IDs reconstruct a v1 generator; skill identity in planning/evidence comes from the item metadata. Each skill has six forms (model, symbolic, explanation, check, transfer, held-out verification) and three bands, giving 18 stable schema cards. Concrete seeds vary without creating extra FSRS cards. Verification families are withheld from ordinary manual/new-learning pools and reserved for lesson exit checks.

The supported interactions are numeric input and single choice, with keyboard and touch alternatives. Explanation/justification is selected from mathematical statements. Visuals include factor rectangles, labeled equal-jump excerpts, number/shape patterns, scalable place-value charts, bounding number lines, partial recordings, and aligned arithmetic columns. Worked examples expose a solution explicitly; normal models hide the answer label. Hint/retry support is recorded independently from first-attempt success. Questions and visuals are original MathFan content; no third-party curriculum text was copied.

## Evidence and scheduling

Canonical `mathAnswerEvents` remain authoritative. Learning, review, and recommendation states are separate; a due card does not replace a mastered learning state. Recent independent accuracy determines current proficiency, while successful historical variety and delayed gates remain available during routine review. Lifetime accuracy remains reporting data.

Evidence profile v1 requires at least eight recent independent attempts, six successful distinct instances, two representations, three schemas, three sessions, and successful independent checks on two later local dates at least 24 hours after initial learning. Explanation, check, transfer, and held-out verification are required. Procedures additionally need all three bands; applications need transfer in two context families. Hints, retries, relearning steps, diagnostic/goal-evaluation observations, and related evidence cannot satisfy independent mastery gates. A confirmed unresolved misconception blocks mastery.

One misconception-derived error is a suspicion. A different item and schema must repeat that contrast to confirm it. Resolution requires appropriate independent successes in two sessions on two later dates after a 24-hour delay. This is derived from events across cards rather than a first-error cache flag.

FSRS retention, configuration, atomic-fact fluency, and same-presentation retry/relearning behavior are unchanged. Telemetry records the actual FSRS configuration version. Grade 4 conceptual/procedural work is untimed; latency cannot penalize a correct answer.

## Learner flows

The readiness check has 20 entry probes (seven reused Grade 3 prerequisite probes and thirteen Grade 4 probes), plus at most two adaptive contrasts. It resumes from durable observation events. Grade 4 readiness explicitly creates neither template nor atomic-fact schedules; Grade 3's existing diagnostic initialization policy remains intact. Results show “Start here” and “Quick refreshes,” with provisional placement rather than a grade-equivalent score.

Every skill is manually accessible. Skill details include activate/model/notation/guided/reflection prompts, a worked example, practice, optional 1–3-item refreshes, and return to the original skill. Goals, goal evaluation, Daily New, Learn Extra, manual practice, the Math Map, and Today's Lesson use registered skills.

The canonical daily planner budgets genuine due retrieval, focus, and transfer toward 25%/50%/25%, adapting to the available cards and learner performance. It never fabricates reviews to fill a quota. Initial lessons can be shorter while a learner builds the introductory schemas; later bands expand available work. Normal Grade 4 lessons contain one item per card, reserve transfer/verification forms, and exclude due cards from focus/new work. Every fifth focus day mixes application of introduced skills without introducing another skill. Saved plans retain curriculum/version metadata and create a preserved replacement revision if a profile changes grade.

## Validation

`grade4Foundation.test.tsx` checks 1,000 seeds for each of the 13 generator families (13,000 instances), reconstruction, independent answer oracles, bounds, distractors/registration, choice uniqueness, visuals, evidence exclusions, delayed gates, misconception transitions, workloads, stretch learning, mixed practice, and fresh-card review.

`grade4Persistence.test.ts` uses IndexedDB to check duplicate-write protection, readiness replay without cards, snapshot validation, idempotent sync/rebuild equivalence, lesson metadata, grade changes, and shared Grade 4 goal evaluation. Existing Grade 3 regression tests remain in the full suite.

The built-app browser suite covers phone readiness/resumption → bridge/return → lesson → fresh later review, all thirteen skills on iPad/desktop, Grade 4 goal evaluation, offline reload and profile switching, and the existing Grade 3 journeys. The PWA update suite remains required. Run `npm run ci`, `npm run test:e2e`, and `python tools/generate_code_maps.py` before delivery.

## Main new files

- `src/features/curriculum/curriculumRegistry.ts`: curriculum and evidence configuration.
- `src/features/curriculum/foundationTypes.ts` and `foundationItems.ts`: tagged content/answer contracts and generators.
- `src/features/visuals/FoundationModel.tsx`: accessible scalable representations.
- `src/features/mastery/curriculumEvidence.ts`: independent mastery and misconception replay.
- `src/features/diagnosis/readinessPlanner.ts`: bounded adaptive readiness.
- `src/tests/grade4Foundation.test.tsx` and `grade4Persistence.test.ts`: invariants and persistence regressions.
- `scripts/grade4-e2e-fixtures.mjs`: test-only answers for built-app journeys; never shipped in the browser bundle.
