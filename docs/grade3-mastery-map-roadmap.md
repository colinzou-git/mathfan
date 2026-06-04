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

Status: TODO

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
Not started.

---

### Phase 12 — Scaffolded QuestionRenderer

Status: TODO

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
Not started.

---

### Phase 13 — Diagnostic session

Status: TODO

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
Not started.

---

### Phase 14 — Parent Next Action card

Status: TODO

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
Not started.

---

### Phase 15 — dnd-kit equal-groups manipulative

Status: TODO

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
Not started.

---

### Phase 16 — Mafs fraction number-line task

Status: TODO

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
Not started.

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
