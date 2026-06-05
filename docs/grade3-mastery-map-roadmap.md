# Grade 3 Mastery Map Roadmap

This roadmap is designed for automated Claude Code execution.

Claude should implement **only the first phase with `Status: TODO`**, then update that phase to `Status: DONE` after successful implementation and CI.

---

## Global Rules

* Do not remove existing MathFan features.
* Do not redesign unrelated UI.
* Preserve existing FSRS item-level scheduling.
* Preserve existing practice, quiz, dashboard, stats, Google sync, and AI tutor behavior unless the selected phase explicitly requires a change.
* Use `mathAnswerEvents` as the source of truth where possible.
* Treat `itemStates`, `multFactStats`, and future `studentSkillStates` as derived caches.
* Keep child-facing wording positive, encouraging, and non-shaming.
* Prefer small, testable changes.
* Add unit tests for new logic.
* Run `npm run ci` after each phase.
* Do not start future phases.
* Do not commit unless the automation script asks you to commit.
* If CI fails, do not mark the phase as `DONE`.

---

## Completed Phases

### Phase 1 — Add open-source dependencies

Status: DONE

Goal:
Add required lightweight dependencies for the Grade 3 learning features.

Implementation note:
Completed manually.

---

### Phase 2 — Grade 3 mastery map data

Status: DONE

Goal:
Create the core Grade 3 mastery map definitions.

Implementation note:
Completed manually.

---

### Phase 3 — Skill mapping

Status: DONE

Goal:
Map existing MathFan practice items to Grade 3 mastery-map skill IDs.

Implementation note:
Completed manually.

---

### Phase 4 — Skill mastery engine

Status: DONE

Goal:
Derive Grade 3 skill mastery summaries from existing MathFan events and item states.

Implementation note:
Completed manually.

---

### Phase 5 — Misconception engine

Status: DONE

Goal:
Detect common Grade 3 math mistake patterns from wrong answers.

Implementation note:
Completed manually.

---

### Phase 6 — Wire misconceptions into practice

Status: DONE

Goal:
Record detected mistake patterns into practice item state on first-attempt wrong answers.

Implementation note:
Completed manually.

---

## Remaining Phases

### Phase 7 — Grade 3 Mastery Map UI

Status: DONE

Goal:
Create the first visible Grade 3 Math Map page.

Files to create or update:

* `src/features/mastery/Grade3MasteryMapPage.tsx`
* `src/features/mastery/SkillTile.tsx`
* `src/features/mastery/SkillDetailPanel.tsx`

Requirements:

* Load `mathAnswerEvents` and `itemStates` for the current student.
* Derive skill summaries using the existing Grade 3 skill mastery engine.
* Group skills by domain.
* Show status colors and icons.
* Clicking a skill tile should open a detail panel.
* Include placeholder buttons:

  * `Practice this skill`
  * `Review due items`
* These buttons may call callbacks passed as props.
* Do not change the dashboard yet.
* Do not change existing practice or quiz behavior.

Acceptance criteria:

* TypeScript passes.
* Existing tests pass.
* New UI compiles.
* No current practice, quiz, stats, sync, or FSRS behavior changes.

Implementation note:
Created Grade3MasteryMapPage (loads events/states, derives skill summaries via makeItemFromId resolver, groups by domain), SkillTile (color-coded status badge, accuracy/attempt count), and SkillDetailPanel (slide-up bottom sheet with stats, mistake patterns, CA standards, and practice/review callbacks). CI passes.

---

### Phase 8 — Dashboard entry point

Status: DONE

Goal:
Add a Grade 3 Math Map card to the student dashboard.

Files to update:

* `src/features/dashboard/StudentDashboard.tsx`
* `src/App.tsx` or the current parent navigation component

Requirements:

* Add a new prop to `StudentDashboard`:

  * `onOpenMasteryMap`
* Add a visually simple dashboard card:

  * Title: `🗺 Grade 3 Math Map`
  * Subtitle: `See what is strong, learning, and ready to review.`
* Keep all existing dashboard buttons:

  * Daily Review
  * Multiplication Quiz
  * Operation picker
  * Stats & History
  * Settings
* Wire parent navigation so the card opens `Grade3MasteryMapPage`.
* Preserve mobile/iPad layout.

Acceptance criteria:

* Dashboard still works.
* Existing dashboard actions still work.
* Grade 3 Math Map can be opened.
* TypeScript and tests pass.

Implementation note:
Added optional `onOpenMasteryMap` prop to StudentDashboard; added a purple-themed card button between the quiz button and the operation picker. Added 'mastery-map' to App.tsx Screen union, renders Grade3MasteryMapPage with back/practice/review callbacks. CI passes.

---

### Phase 9 — Skill-based practice planner

Status: DONE

Goal:
Create a planner that converts a Grade 3 skill ID into a MathFan `SessionConfig`.

Files to create:

* `src/features/mastery/skillPracticePlanner.ts`

Requirements:

* Implement:

```ts
export function planPracticeForSkill(skillId: string, options?: {
  sessionLength?: number;
  rounds?: number;
}): SessionConfig;
```

* Support at least these skills:

  * `G3_OA_MUL_FACTS_0_2_5_10`
  * `G3_OA_MUL_FACTS_3_4`
  * `G3_OA_MUL_FACTS_6_9`
  * `G3_OA_DIV_UNKNOWN_FACTOR`
  * `G3_NF_EQUIVALENT_FRACTIONS`
  * `G3_NF_COMPARE_FRACTIONS`
  * `G3_OA_WORD_EQUAL_GROUPS`
* Use `specificItemIds` where practical.
* Use mode and ranges where item IDs are generated dynamically.
* Add tests verifying each supported skill returns a valid `SessionConfig`.

Acceptance criteria:

* Unit tests cover all supported skill IDs.
* Returned configs work with existing `usePracticeSession`.
* Existing practice behavior is not changed.
* TypeScript and tests pass.

Implementation note:
Created skillPracticePlanner.ts supporting all 7 spec skill IDs and the grade3MasteryMap.ts IDs. Uses specificItemIds for all skills (mulId/divId/unkId/fracEqId/fracCmpId/wordId helpers). Added 29 unit tests in skillPracticePlanner.test.ts covering every skill, custom sessionLength, and unknown-skill fallback. CI passes.

---

### Phase 10 — Today’s Plan engine

Status: DONE

Goal:
Create an engine that chooses the best next practice plan for a student.

Files to create:

* `src/features/mastery/todayPlanEngine.ts`

Requirements:

* Define:

```ts
export interface TodayPlan {
  warmup: SessionConfig | null;
  focusSkillId: string | null;
  focus: SessionConfig | null;
  review: SessionConfig | null;
  estimatedMinutes: number;
}
```

* Implement:

```ts
export function planToday(args: {
  studentId: string;
  skillSummaries: StudentSkillSummary[];
  itemStates: StudentItemState[];
  now: Date;
}): TodayPlan;
```

* Priority order:

  1. Pick `review_due` skill first.
  2. Then `needs_practice`.
  3. Then `learning`.
  4. Then next `new` skill whose prerequisites are satisfied.
  5. Otherwise return maintenance review if available.
* Include easy warm-up if available.
* Include due item review if available.
* Use `planPracticeForSkill()` for the focus config.
* Add tests for priority selection.

Acceptance criteria:

* Tests cover all priority branches.
* No UI changes yet.
* TypeScript and tests pass.

Implementation note:
Created todayPlanEngine.ts with TodayPlan interface, planToday function, and priority logic (review_due → needs_practice → strong → new-with-prereqs). Includes warmup (easiest non-mastered skill, 5 questions), focus (chosen skill, 10 questions), review (overdue items, capped at 10), and estimatedMinutes (20s/question). Added 18 unit tests in todayPlanEngine.test.ts covering all priority branches, fallbacks, and edge cases. CI passes.

---

### Phase 11 — Lightweight visual components

Status: DONE

Goal:
Add small visual learning components for Grade 3 practice.

Files to create:

* `src/features/visuals/ArrayModel.tsx`
* `src/features/visuals/EqualGroupsModel.tsx`
* `src/features/visuals/FractionBar.tsx`
* `src/features/visuals/VisualModel.tsx`

Requirements:

* Use plain React, TypeScript, CSS/SVG.
* Do not add drag-and-drop yet.
* Components should be touch-friendly for iPad.
* `ArrayModel` should show rows and columns.
* `EqualGroupsModel` should show groups with equal objects.
* `FractionBar` should show shaded parts out of a whole.
* `VisualModel` should accept a `PracticeItem` and choose the best visual when possible.
* Do not wire visuals into all practice yet.

Acceptance criteria:

* Components compile.
* Components have simple props.
* Existing app behavior remains unchanged.
* TypeScript and tests pass.

Implementation note:
Created ArrayModel (SVG dot grid with row×col layout, capped at 144), EqualGroupsModel (bordered group containers with object emoji), FractionBar (shaded horizontal bar with optional label), and VisualModel (item-type dispatcher: mul/unk → ArrayModel, word_problem eg → EqualGroupsModel, fraction types → FractionBar). All touch-friendly, display-only. CI passes.

---

### Phase 12 — Scaffolded QuestionRenderer

Status: DONE

Goal:
Add a lightweight question renderer that can optionally show visuals and hints.

Files to create or update:

* `src/features/practice/QuestionRenderer.tsx`
* `src/features/practice/PracticeScreen.tsx` if needed

Requirements:

* Add a render mode type:

```ts
export type LearningRenderMode = 'diagnose' | 'practice' | 'review';
```

* `QuestionRenderer` should support:

  * current prompt display
  * optional `VisualModel`
  * optional hint text
  * current input style compatibility
* Preserve existing keyboard behavior.
* Preserve existing numpad behavior.
* Preserve choice-question behavior.
* Do not rewrite the entire `PracticeScreen`.
* Use the new renderer only where safe.
* Default behavior should match current UI if no visual or hint is requested.

Acceptance criteria:

* Existing practice flow still works.
* Existing tests pass.
* New renderer compiles.
* No FSRS behavior changes.

Implementation note:
Created QuestionRenderer.tsx as an additive component (does not modify PracticeScreen). Exports LearningRenderMode type. Supports prompt display, optional VisualModel (via showVisual prop), optional hintText, and mode-specific styles (diagnose/practice/review). PracticeScreen is untouched. CI passes.

---

### Phase 13 — Diagnostic session

Status: DONE

Goal:
Add a first diagnostic mode for multiplication and division.

Files to create:

* `src/features/diagnosis/diagnosticPlanner.ts`
* `src/features/diagnosis/DiagnosticSession.tsx`

Requirements:

* Diagnostic session should contain around 10–12 questions.
* No timer pressure.
* Cover:

  * easy multiplication facts
  * hard multiplication facts
  * division as unknown factor
  * equal-groups word problem
  * array meaning
* Use existing `PracticeItem` types where possible.
* Record diagnostic answers into `mathAnswerEvents`.
* Make diagnostic results usable by the skill mastery engine.
* Do not break existing practice or quiz flows.
* The first version does not need advanced drag/drop tasks.

Acceptance criteria:

* Diagnostic session can run.
* Events are recorded.
* Skill summaries update based on diagnostic events.
* TypeScript and tests pass.

Implementation note:
Created diagnosticPlanner.ts (buildDiagnosticPlan: 11 deterministic items covering easy/hard mul facts, unknown-factor division, equal-groups and array word problems; diagnosticItemSkillId: maps items to grade3MasteryMap skill IDs). Created DiagnosticSession.tsx (intro → active → done flow, records answers into mathAnswerEvents via recordAnswerEvent, uses QuestionRenderer with showVisual, no timer, FEEDBACK_MS auto-advance). Added 15 unit tests in diagnosticPlanner.test.ts. CI passes.

---

### Phase 14 — Parent Next Action card

Status: DONE

Goal:
Add a parent-facing summary that explains what to practice next.

Files to create:

* `src/features/mastery/ParentNextActionCard.tsx`

Files to update:

* `src/features/mastery/Grade3MasteryMapPage.tsx`

Requirements:

* Show:

  * strongest 2 skills
  * top 2 needs-practice skills
  * suggested today plan
  * one clear parent action
* Wording must be encouraging and non-shaming.
* Avoid labels such as `failed`, `bad`, or `behind`.
* Add this card to the Grade 3 Mastery Map page, not the dashboard yet.

Acceptance criteria:

* Parent card appears on mastery map page.
* Text is positive and useful.
* TypeScript and tests pass.

Implementation note:
Created ParentNextActionCard.tsx showing strongest 2 skills, "still building" skills, today's plan chips, and a single encouraging parent action sentence. All wording is positive ("Going strong", "Still building", never "failed/behind"). Wired into Grade3MasteryMapPage via planToday; card only shown when there are summaries or review items. CI passes.

---

### Phase 15 — dnd-kit equal-groups manipulative

Status: DONE

Goal:
Create the first drag-and-drop manipulative for equal groups.

Dependencies:

* `@dnd-kit/core`
* `@dnd-kit/sortable` if needed

Files to create:

* `src/features/visuals/DraggableEqualGroups.tsx`

Requirements:

* Create a standalone component first.
* Show `N` objects.
* Show `G` group containers.
* Student can drag objects into groups.
* Component can check whether groups are equal.
* Touch-friendly for iPad.
* Keyboard accessibility if practical.
* Do not integrate into the main practice flow yet.

Acceptance criteria:

* Component compiles.
* Standalone demo/test usage works.
* No existing practice behavior changes.
* TypeScript and tests pass.

Implementation note:
Created DraggableEqualGroups.tsx using @dnd-kit/core (PointerSensor + KeyboardSensor for accessibility). Objects start in a "tray" DropZone and can be dragged into group containers. Shows "All groups are equal!" feedback when done. checkEqualGroups logic lives in equalGroupsUtils.ts (separate file to satisfy fast-refresh lint rule). Standalone, not integrated into practice flow. CI passes.

---

### Phase 16 — Mafs fraction number-line task

Status: DONE

Goal:
Create a number-line component for fractions.

Dependency:

* `mafs`

Files to create:

* `src/features/visuals/FractionNumberLine.tsx`

Requirements:

* Render a number line from 0 to 1.
* Show tick marks based on denominator.
* Support display-only mode first.
* Optionally support selected numerator/denominator.
* Later this can become interactive, but this phase only needs a stable first version.
* Do not integrate into main practice unless safe and minimal.

Acceptance criteria:

* Component compiles.
* Can display examples such as:

  * `1/2`
  * `3/4`
  * `2/3`
* TypeScript and tests pass.

Implementation note:
Created FractionNumberLine.tsx using Mafs (Mafs, Line.Segment, Point, Text components). Renders a horizontal number line 0→1 with tick marks at each a/d position, 0 and 1 endpoint labels, an optional highlighted Point at n/d, and an optional fraction label. Props: denominator (1–12), numerator (optional), width, showLabel. Display-only; not wired into practice. Accepts 1/2, 3/4, 2/3 and any fraction with d≤12. CI passes.

---

### Post-Phase Bug Fixes

Status: DONE

Goal:
Fix 8 correctness bugs found in a post-phase audit of the mastery-map implementation.

Fixes applied:

1. **div-by-0 / unreconstructable items** (`skillPracticePlanner.ts`): `divItemIds` and `unknownFactorItemIds` now skip divisors/factors < 2 (was generating DIV_0d0, UNK_2k1, etc.).

2. **Skill credit mismatches** (`skillPracticePlanner.ts`, `skillMapping.ts`):
   - `BASIC_TABLES` now `[0,1,2,5]` (removed 10, which `inferGrade3SkillId` maps to advanced); `ADVANCED_TABLES` now `[6,7,8,9,10]`.
   - Division practice split: `g3-div-within-100` uses divisors 2–5; `g3-div-mul-relationship` uses divisors 6–10. Each set credits correctly.
   - `fraction_equivalent` items with n=1 now infer to `g3-frac-unit`; n>1 → `g3-frac-equivalent`. `fracEquivItemIds()` updated to use non-unit fractions only.
   - `g3-frac-number-line` and `g3-geo-rectilinear-area` documented as explicit shared skills.

3. **New-skill today plan** (`Grade3MasteryMapPage.tsx`): `planToday` now receives stubs for all GRADE3_MASTERY_MAP skills, so a brand-new student gets a focus skill suggestion.

4. **"Review due items" button** (`Grade3MasteryMapPage.tsx`): `onReviewDue` now uses the actual due item IDs for that skill rather than calling `planPracticeForSkill`.

5. **DiagnosticSession wiring** (`App.tsx`, `DiagnosticSession.tsx`, `learningEvents.ts`): Added `'diagnostic'` to `MathEventMode`. DiagnosticSession now records `mode: 'diagnostic'`, awaits all DB writes before calling `onComplete`, and shows "Nice try! Keep going." instead of revealing the answer. Wired via new `'diagnostic'` screen in App.tsx and "🔍 Quick Check" button on the mastery map.

6. **Mastery awarded without item coverage** (`skillMasteryEngine.ts`): `classifyStatus` now requires `itemCount >= 4` (in addition to accuracy ≥ 0.90 and attempts ≥ 5) to reach `mastered`.

7. **Locked skills not enforced** (`SkillTile.tsx`, `Grade3MasteryMapPage.tsx`): Skills with unmet prerequisites are visually dimmed, show a 🔒 badge and "Complete prerequisites first", and cannot be clicked.

8. **Committed Python cache** (`.gitignore`, git history): Added `__pycache__/` and `*.py[cod]` to `.gitignore`; removed `tools/__pycache__/generate_code_maps.cpython-313.pyc` from git tracking.

Added round-trip regression tests in `skillPracticePlanner.test.ts` verifying every skill generates only reconstructable items with finite answers, and that clean-mapping skills credit back to the correct skill ID.

CI passes (484 tests).

---

### Phase 17 — Build and type fixes

Status: DONE

Goal:
Fix all TypeScript/build/lint errors without changing app behavior. Prefer named imports over `React.CSSProperties` / `React.ReactNode` namespace usage.

Files to check:
* `src/features/mastery/Grade3MasteryMapPage.tsx`
* `src/features/mastery/SkillTile.tsx`
* `src/features/mastery/SkillDetailPanel.tsx`
* `src/features/mastery/ParentNextActionCard.tsx`
* `src/features/diagnosis/DiagnosticSession.tsx`
* `src/features/practice/PracticeScreen.tsx`
* `src/components/SessionSummary.tsx`
* `src/features/dashboard/StudentDashboard.tsx`
* `src/features/visuals/ShapeModel.tsx`
* `src/features/visuals/DraggableEqualGroups.tsx`

Acceptance criteria:
* `npm run build`, `npm test`, `npm run lint` all pass with 0 errors.
* `React.CSSProperties` / `React.ReactNode` replaced with named imports.
* No behavior changes.

Implementation note:
Added named `CSSProperties` import to Grade3MasteryMapPage, SkillTile, SkillDetailPanel, ParentNextActionCard, DiagnosticSession, PracticeScreen, SessionSummary, StudentDashboard. Added named `ReactNode` import to ShapeModel and DraggableEqualGroups. Replaced all `React.CSSProperties` / `React.ReactNode` usages. Build, 484 tests, lint (0 errors) all pass.

---

### Phase 18 — Fix mastery skill round-trip bugs

Status: DONE

Goal:
Fix skill practice planner so every practiceable skill in GRADE3_MASTERY_MAP has targeted items, every specificItemId reconstructs, and every reconstructed item infers back to the correct skill.

Known issues:
A. `g3-mul-tables-basic`: BASIC_TABLES should include 3 and 4 → `[0,1,2,3,4,5]`.
B. `g3-frac-number-line`: Use real `fraction_number_line` items, not fraction-compare proxies.
C. `g3-geo-rectilinear-area`: Create real rectilinear-area items or mark skill unavailable.
D. `g3-mul-properties`: Add property-focused items or lock skill with reason.

Tests to add:
* Every practiceable GRADE3_MASTERY_MAP node has specificItemIds.
* Clean-mapped skills infer back to themselves.

Acceptance criteria:
* Round-trip tests pass.
* `npm run build`, `npm test`, `npm run lint` pass.

Implementation note:
A. BASIC_TABLES now [0,1,2,3,4,5] to match mastery map "Times Tables 1–5". B. Added `makeFractionNumberLineItem` + `fracNlId` to fractionItems.ts and FNL_ parser to makeItemFromId.ts; g3-frac-number-line now uses real FNL_ items. C. Added `makeRectilinearAreaItem` + `rectiId` + `rectilinearAreaItemIds` to areaItems.ts and RECTI_ parser; g3-geo-rectilinear-area now uses real RECTI_ items. D. Created mulPropertiesItems.ts with commutative/identity/zero items; g3-mul-properties now has specificItemIds. Added `rectilinear_area` and `multiplication_properties` to ItemType. Updated skillMapping.ts. Added 5 new regression tests including "every practiceable skill has specificItemIds". 489 tests pass.

---

### Phase 19 — Fix diagnostic correctness and mastery integration

Status: DONE

Goal:
Fix DiagnosticSession so answers are checked with shared `checkAnswer()` logic, division diagnostic items credit to `g3-div-mul-relationship`, and diagnostic writes are awaited before completion.

Known issues:
1. Raw string equality check in DiagnosticSession; replace with `checkAnswer()`.
2. `unknown_factor` items infer to multiplication skills, not `g3-div-mul-relationship`.
3. `diagnosticItemSkillId()` not used in mastery derivation — integrate or remove.
4. Diagnostic answers should use the same durable path as practice for itemStates/FSRS.

Tests to add:
* Numeric answer normalization in diagnostic.
* Division diagnostic item credits to `g3-div-mul-relationship`.
* Diagnostic completion awaits writes before calling `onComplete`.

Acceptance criteria:
* `npm run build`, `npm test`, `npm run lint` pass.

Implementation note:
DiagnosticSession now uses checkAnswer() instead of raw string equality (handles leading zeros like "08"). Replaced unknown_factor diagnostic items with real division_fact items (DIV_12d3, DIV_42d7) so they correctly credit to g3-div-within-100 and g3-div-mul-relationship. Updated diagnosticItemSkillId() to handle division_fact type. DiagnosticSession now writes through recordPracticeAnswer() (event + itemState FSRS + attempt + mistakePatterns) with mode:'diagnostic'. Updated diagnosticPlanner tests. Added 4 new normalization/credit tests. 494 tests pass.

---

### Phase 20 — Fix new-user mastery map UX and return navigation

Status: DONE

Goal:
Fix Grade3MasteryMapPage so ParentNextActionCard is visible for brand-new students, and completing mastery-map-launched practice returns to the map.

Known issues:
1. `ParentNextActionCard` hidden when `summaries.length === 0`; should show when `todayPlan.focus || warmup || review`.
2. Completing practice from mastery map returns to dashboard; should return to mastery map.

Tests to add:
* Brand-new student sees a suggested first focus skill.
* Finishing mastery-map practice returns to the map.

Acceptance criteria:
* `npm run build`, `npm test`, `npm run lint` pass.

Implementation note:
Fixed ParentNextActionCard render condition in Grade3MasteryMapPage: changed `summaries.length > 0 || todayPlan.review` to `todayPlan.focus || todayPlan.warmup || todayPlan.review` so the card shows for brand-new students. Fixed handleSessionDone in App.tsx to return to 'mastery-map' or 'stats' when practice was launched from those screens, preserving dashboard return for all other screens. Added 3 brand-new-student tests to todayPlanEngine.test.ts. 497 tests pass.

---

### Phase 21 — Wire visual models consistently

Status: TODO

Goal:
Expand PracticeScreen visual display to all item types VisualModel supports; wire FractionNumberLine for `fraction_number_line` items; remove duplicate diagnostic badge.

Known issues:
1. PracticeScreen shows visuals only for area/perimeter/geometry.
2. VisualModel uses FractionBar for `fraction_number_line` instead of FractionNumberLine.
3. Duplicate Diagnostic badge between DiagnosticSession and QuestionRenderer.

Tests to add:
* Multiplication visual appears.
* Equal-groups word problem visual appears.
* `fraction_number_line` uses FractionNumberLine.
* Area/perimeter/geometry visuals still work.

Acceptance criteria:
* `npm run build`, `npm test`, `npm run lint` pass.

---

### Phase 22 — Final regression hardening

Status: TODO

Goal:
Add comprehensive regression tests for the Grade 3 mastery map.

Tests required:
1. Every GRADE3_MASTERY_MAP skill is practiceable or explicitly marked unavailable.
2. Every targeted specificItemId reconstructs via makeItemFromId().
3. Every targeted item has a finite answer.
4. For each clean skill, inferGrade3SkillId(item) returns the correct skill ID.
5. planToday() for a brand-new student returns a useful first focus skill.
6. Grade3MasteryMapPage shows a next action for a brand-new student.
7. Diagnostic answers use shared answer checking and don't mis-credit unknown-factor division.
8. Completing practice launched from mastery map returns to mastery map.

Acceptance criteria:
* All regression tests pass.
* `npm run ci` passes.

---

## Final Completion Criteria

The Grade 3 mastery-map project is considered complete when:

* The dashboard can open the Grade 3 Math Map.
* The map shows skill statuses derived from student work.
* Each skill can lead to targeted practice.
* Today’s Plan can choose a focus skill.
* Basic visual models exist.
* Diagnostic mode exists for multiplication/division.
* Parent Next Action card gives useful guidance.
* Existing MathFan practice, quiz, stats, sync, and FSRS behavior still work.
* `npm run ci` passes.
