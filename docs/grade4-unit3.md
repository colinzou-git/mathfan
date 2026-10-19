# Grade 4 Unit 3: comparison and multistep reasoning

## Purpose and scope

Extend the shared Grade 4 curriculum from 13 to 19 skills. Unit 3 teaches multiplicative comparison (4.OA.1–2) and whole-number multistep modeling/solving (partial 4.OA.3). Remainder interpretation remains for Unit 5; neither Unit 3 nor its map claims complete 4.OA.3 coverage. Computation supports reasoning rather than prematurely requiring multi-digit multiplication/division procedures.

The learner can open any skill, inspect a worked example, use a short advisory prerequisite refresh and return, practice independently, receive targeted hints, complete transfer and reserved verification, and later review a fresh variant of the same FSRS card. Goals, evaluation, Daily New, Today's Lesson, history and offline/sync use the existing canonical paths.

## Delivery gates

1. Bound readiness, preserving the published v1 sequence and durable observations.
2. Implement `g4-oa-mult-compare-meaning` through instruction, visuals, practice, misconception/evidence derivation, lesson planning, saved events and fresh delayed review. Pass seeded, persistence and built-app checks before adding the other five skills.
3. Expand the validated content contract to all six skills; run the full regression and browser suites.

## Readiness

Maximum 22 questions: seven Grade 3 prerequisite probes, thirteen explicitly selected Grade 4 entry probes, and at most two contrasts. The new v2 blueprint samples comparison, additive-versus-multiplicative comparison and multistep modeling alongside foundation topics. Adding registry skills cannot enlarge the check. Unobserved skills are unknown, not failures; prioritize observed difficulty when suggesting a start.

Existing v1 session IDs and their original item/form/seed ordering remain readable. Resolve the learner's existing session before resuming; never combine v1 and v2 observations. Both versions resume from canonical observation events and create no FSRS schedules or independent mastery evidence. New curricula require an explicit new readiness blueprint rather than silently mutating a published one.

## Skills and pedagogy

| ID | Focus and prerequisite | Assessment distinctions |
|---|---|---|
| `g4-oa-mult-compare-meaning` | Times-as-many meaning; Grade 3 multiplication meaning and multiplication/division relationship | Equal-length tape units, quantity table, equation, selected explanation, additive-error contrast, reverse equation-to-language verification |
| `g4-oa-mult-compare-equations` | Match language, diagrams and equations; comparison meaning | Compared quantity, reference quantity and multiplier positions; letter represents the asked quantity |
| `g4-oa-mult-compare-unknowns` | Solve all three unknown positions; equation skill | Multiply for compared quantity, divide for reference or multiplier; reject keyword-only multiplication |
| `g4-oa-add-vs-mult-compare` | Contrast “more than” and “times as many”; comparison meaning | Extra segment versus equal units, paired situations, operation selection and error explanation |
| `g4-oa-multistep-model` | Model two connected steps; Grade 3 two-step work and comparison unknowns | Select equation with unknown result, starting quantity or change; identify useful quantities and intermediate units |
| `g4-oa-multistep-solve` | Solve and check; multistep modeling and estimate/check | Ordered calculation, inverse reasoning for unknown start/change, estimate versus exact result, irrelevant information in advanced situations |

Use original library, garden, craft-club and sports contexts. Structural bands vary support and unknown position; increasing operand size alone is insufficient. All quantities are nonnegative whole numbers, comparison factors exceed one, division is exact, and results remain within 1,000. Reasoning work is untimed. General quotient/remainder, rational and geometry response types will be introduced with the units that need them.

## Content and compatibility

Reuse the tagged numeric/single-choice answer contract and foundation item reconstruction. Add mathematical comparison tape/table payloads, never parse mathematics from prose. Model labels hide the requested quantity during ordinary practice and reveal it in the explicit worked example. Small-screen visuals wrap or scale and include a text description; choices and numeric entry retain touch and keyboard paths.

Preserve all published Unit 1–2 IDs, generator streams, card keys and event interpretation. New content uses six forms (model, symbolic, explain, check, transfer, verify), three bands and stable per-schema cards. Reserved verification remains outside ordinary manual/Daily New pools. FSRS configuration, due dates, retention and retry/relearning rules are unchanged. Record exact shown prompts/answers and mathematical metadata through canonical events so sync/rebuild derives the same evidence.

## Evidence and integration

Reuse independent first-attempt and later-day gates. Hints, retries, relearning, diagnostics and goal evaluation do not establish mastery. Mastery and due-review states remain separate. New application profiles additionally require successful transfer across context families and the relevant unknown positions. Different numbers alone do not demonstrate transfer.

Misconceptions include additive interpretation of “times,” reversed quantities, wrong operation for the unknown, lost intermediate quantity, incorrect step order, treating an estimate as exact, and using irrelevant information. A first diagnostic pattern is a suspicion; confirmation requires a different item/schema. Resolution requires later independent evidence, following the shared engine.

## Validation plan

- At least 1,000 seeds per new family, across all forms/bands: independent answer oracles, bounds, unique choices, distractor codes, reconstruction and visual payload consistency.
- Readiness size invariance under curriculum growth, every answered prefix preserved, v1/v2 session isolation and resume, no diagnostic schedules.
- First-skill complete flow: evidence exclusions, delayed mastery, due-state independence, misconception confirmation/resolution, fresh same-card review, daily-plan attribution, IndexedDB persistence and snapshot/rebuild equivalence.
- All-skill coverage: unknown positions/context variety, standards/prerequisite graph, goals/evaluation, new-versus-due card exclusion, curriculum version compatibility.
- Real production-build browser journeys on phone, iPad and desktop; instruction/hints, readiness resume, Unit 3 practice, daily lesson, later review and offline reload; retain Grade 3 and PWA-update regressions.
- Run `npm run ci`, `npm run test:e2e`, `python tools/generate_code_maps.py`, and `git diff --check`.

## Validation checkpoints

Before expansion beyond the first comparison skill:

- Bounded readiness: `npm run ci` passed 106 files / 1,681 tests and the production build. The phone readiness/resume → bridge → lesson → fresh review journey passed.
- First comparison skill: `npm run ci` passed 107 files / 1,689 tests and the production build. Seeded mathematical checks, delayed/independent mastery, misconception normalization, IndexedDB duplicate protection, snapshot merge/rebuild and fresh review passed.
- The real phone browser journey passed instruction → wrong answer/hint/relearning → independent practice → goal creation and stable daily lesson → reserved verification → reload → fresh later review. The goal is created before lesson planning; intervening voluntary practice does not replace the saved lesson.

The retry assertion follows the existing policy: one same-presentation recovery may apply a `relearning_step`; it cannot become independent mastery evidence.

## Implementation files

| Module | Responsibility |
|---|---|
| `src/features/curriculum/curriculumRegistry.ts` | Unit 3's six nodes, standards, prerequisites, version 2 identity and required transfer roles/context counts |
| `src/features/curriculum/comparisonBlueprints.ts` (new) | Seeded original comparison and multistep mathematics, solutions, hints and named misconception distractors |
| `src/features/curriculum/foundationTypes.ts`, `foundationItems.ts` | Comparison payloads and response matching, immutable reconstruction/card contracts; published foundation streams remain unchanged |
| `src/features/visuals/FoundationModel.tsx` | Accessible comparison tapes, quantity tables and connected-step models; proportional additive segments |
| `src/features/diagnosis/readinessPlanner.ts`, `DiagnosticSession.tsx` | Bounded v2 sampling and exact legacy-session resumption |
| `src/features/mastery/curriculumEvidence.ts`, `misconceptionEngine.ts` | Successful transfer roles/context gates and grading-compatible misconception normalization |
| `src/features/learningPlan/dailyLessonPlanner.ts` | Reachable reserved exit verification, preserving due/new card exclusion and existing FSRS rules |
| `src/features/mastery/Grade3MasteryMapPage.tsx`, `src/features/goals/GoalEvaluationSession.tsx` | Accurate Unit 1–3 scope and partial remainder coverage labels |
| `scripts/grade4-e2e-fixtures.mjs`, `scripts/e2e_mathfan.py` | Test-only current/legacy/contrast fixtures, first-skill learning/review, legacy resume, all-skill layouts and new-content offline use |

New test source files: `src/tests/grade4ReadinessSampling.test.ts`, `src/tests/grade4ComparisonFlow.test.tsx`, and `src/tests/grade4Unit3.test.ts`. Existing foundation, persistence and goal-evaluation curriculum tests were extended.

Each comparison unknown role is fixed by structural band. A fresh review seed changes numbers/context while retaining that role and its stable schema card. Solving skills and equation modeling require transfer with every relevant unknown position. New application skills additionally require transfer in at least three of the four context families. Existing Unit 1–2 mastery profiles remain unchanged.

Curriculum version 2 starts new goal evaluations without rewriting older evaluations. Saved same-day lesson assignments retain their existing identity and progress; later lessons use the expanded registry. No database migration or dependency change is needed.

## Sources and content provenance

Scope follows the California Grade 4 standards, especially 4.OA.1–3: https://www.cde.ca.gov/be/st/ss/documents/ccssmathstandardaug2013.pdf . Representation/progression reference: https://im.kendallhunt.com/k5/teachers/grade-4/course-guide/scope-and-sequence.html . All MathFan questions, hints, diagrams and explanations are original; no curriculum lesson text was copied.

## Final validation

- `npm run ci`: 108 test files / 1,721 tests passed, with lint, TypeScript and production build successful. Existing lint/bundle-size advisories remain.
- Every registered Grade 4 family passed 1,000 seeded invariant checks. The new comparison/multistep tests independently checked arithmetic and equation choices, fixed card roles, four available contexts and required transfer evidence.
- All six Unit 3 skills passed canonical save/duplicate-write protection, snapshot merge and replay-equivalence checks. Planned and extra goal learning exclude due cards and reserved verification; whole-grade goal evaluation can select every new skill.
- `npm run test:e2e`: all 34 production-build browser journeys passed, followed by the PWA update smoke suite. Coverage includes phone/iPad/desktop, legacy readiness resume, first-skill complete learning/review, all 19 skills, new-content offline reload, profile switching and existing Grade 3 regressions.
- The final wording explicitly names the direction of multiplier comparisons. The full code and browser suites were rerun after that change.
- Code maps regenerated; `git diff --check` passed. No required validation remains incomplete.
