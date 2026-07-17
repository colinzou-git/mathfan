# Code Map Overview

Generated: 2026-07-17 07:41:26 UTC

Repo root: `/home/ubuntu/mathfan`
Output folder: `/home/ubuntu/mathfan/docs/code-map`

## What this is for

This folder is a compact repo memory for Claude Code / Codex. Start AI coding sessions by asking the model to read `CLAUDE_START_HERE.md`, then `CODEMAP.md`, then `SYMBOLS.md` before scanning source files.

## Project summary

- Package name: `mathfan`
- Version: `1.2.0`
- Module type: `module`
- Scanned files: **299**
- Scanned lines: **56,485**
- Scanned bytes: **2,437,125**

## NPM scripts

| Script | Command |
| --- | --- |
| dev | vite |
| build | tsc -b && vite build |
| lint | eslint . |
| preview | vite preview |
| test | vitest run |
| test:watch | vitest |
| test:coverage | vitest run --coverage |
| test:e2e:journey | python scripts/e2e_mathfan.py |
| test:e2e:update | python scripts/smoke-update-flow.py |
| test:e2e | npm run test:e2e:journey && npm run test:e2e:update |
| ci | npm run lint && npm test && npm run build |

## Dependencies

| Package | Version | Kind |
| --- | --- | --- |
| @dnd-kit/core | ^6.3.1 | runtime |
| @dnd-kit/sortable | ^10.0.0 | runtime |
| dexie | ^4.4.3 | runtime |
| fraction.js | ^5.3.4 | runtime |
| jszip | ^3.10.1 | runtime |
| mafs | ^0.21.0 | runtime |
| react | ^19.2.6 | runtime |
| react-dom | ^19.2.6 | runtime |
| react-router-dom | ^7.16.0 | runtime |
| ts-fsrs | ^5.4.1 | runtime |
| @eslint/js | ^10.0.1 | dev |
| @testing-library/jest-dom | ^6.9.1 | dev |
| @testing-library/react | ^16.3.2 | dev |
| @types/node | ^24.12.3 | dev |
| @types/react | ^19.2.14 | dev |
| @types/react-dom | ^19.2.3 | dev |
| @vitejs/plugin-react | ^6.0.1 | dev |
| @vitest/coverage-v8 | ^4.1.7 | dev |
| eslint | ^10.3.0 | dev |
| eslint-plugin-react-hooks | ^7.1.1 | dev |
| eslint-plugin-react-refresh | ^0.5.2 | dev |
| fake-indexeddb | ^6.2.5 | dev |
| globals | ^17.6.0 | dev |
| jsdom | ^29.1.1 | dev |
| typescript | ~6.0.2 | dev |
| typescript-eslint | ^8.59.2 | dev |
| vite | ^8.0.12 | dev |
| vite-plugin-pwa | ^1.3.0 | dev |
| vitest | ^4.1.7 | dev |

## Most important files

| File | Lines | Likely purpose | Key symbols |
| --- | --- | --- | --- |
| src/App.tsx | 401 | Top-level React app shell: routes/screens, global state, and feature wiring. | App, exportMigrationDiagnostics, handleQuizDone, handleSessionDone, pickOperation, retryMigration, runBootstrap, selectProfile |
| src/features/sync/SyncWidget.tsx | 156 | Cloud sync/auth/data transfer logic. | GoogleIcon, SyncWidget, friendlyError, GoogleIcon, initials, SyncWidget, timeSince |
| src/features/sync/snapshot.ts | 597 | Local persistence/database layer. | AppSnapshot, AppSnapshotV3, canonicalDailyLessonPlanId, LEARNER_OWNED_TABLES, LearnerOwnedTableName, normalizeSnapshot, OrphanReport, remoteHasNewerUpdatedAt |
| vite.config.ts | 82 | Vite build/PWA configuration. | buildInfoPlugin |
| package.json | 53 | Project package metadata, scripts, dependencies, and dev tooling. |  |
| src/main.tsx | 21 | React entry point that mounts the app. |  |
| src/features/sync/driveSync.ts | 164 | Cloud sync/auth/data transfer logic. | DriveFileInfo, SyncResult, SyncStatus, authFetch, downloadSnapshot, findSyncFile, getDriveFileInfo, newestSyncFile |
| src/features/sync/snapshotParsers.ts | 131 | Cloud sync/auth/data transfer logic. | parseAttemptLog, parseDailyLessonPlanShape, parseGoalEvaluation, parseGoalEvent, parseLearningGoal, parseMathAnswerEvent, parseMultiplicationFactStat, parsePracticeSession |
| src/features/sync/learnerKeyMerge.ts | 128 | Cloud sync/auth/data transfer logic. | compareProfileRevision, mergeProfilesByExactId, remapStudentId, resolveCanonicalStudentIds, resolveLearnerKeyDuplicate, stableProfileFingerprint, StudentIdAliasMap, compareProfileRevision |
| src/features/sync/useSync.ts | 99 | Cloud sync/auth/data transfer logic. | useSync, initAuth, SyncState, useSync, recordSync, useSync |
| src/features/sync/timeUtil.ts | 13 | Cloud sync/auth/data transfer logic. | remoteHasNewerUpdatedAt, validTimeMs, remoteHasNewerUpdatedAt, validTimeMs |
| src/features/goals/GoalsPage.tsx | 1056 | React UI component file: ConfirmDialog, EmptyState, GoalCard, GoalWizard. | ConfirmDialog, EmptyState, GoalCard, GoalWizard, ProgressBar, SummaryCard, GoalsPage, activeLearningDays |
| src/features/settings/SettingsPage.tsx | 905 | Student/app settings UI or persistence. | Section, SyncRow, ToggleRow, SettingsPage, applyUpdate, buildId, buildLabel, checkForUpdates |
| src/features/multiplication/MultiplicationQuizPage.tsx | 861 | Local persistence/database layer. | FactChip, SetupScreen, StatBox, SummaryScreen, MultiplicationQuizPage, FactChip, MultiplicationQuizPage, recommendedPracticeConfig |
| src/features/dashboard/StudentDashboard.tsx | 627 | Dashboard/profile setup/student navigation feature. | Chip, PracticeOp, StudentDashboard, Chip, completeSkillSummaries, handleStartReview, openExtra, regenerateLesson |
| src/features/practice/PracticeScreen.tsx | 580 | Local persistence/database layer. | KbChip, PracticeScreen, KbChip, onKey, PracticeScreen, run, submitChoice |
| src/features/stats/FactStatsTable.tsx | 407 | Local persistence/database layer. | SortBtn, SummaryStat, FactStatsTable, bucketOf, FactStatsTable, idOf, SortBtn, startPractice |
| src/features/mastery/Grade3MasteryMapPage.tsx | 366 | Grade 3 mastery map UI: skill display, detail panels, and parent action cards. | LegendItem, Grade3MasteryMapPage, buildCompleteSummaries, computeUnmetPrereqNames, Grade3MasteryMapPage, LegendItem |
| src/features/stats/StatsPage.tsx | 273 | Progress/statistics screens or calculations. | SchedulingDiagnostics, SummaryPill, StatsPage, buildRange, daysBetween, SchedulingDiagnostics, StatsPage, SummaryPill |
| src/features/stats/DrillHistory.tsx | 238 | Progress/statistics screens or calculations. | AttemptDetail, MetricChip, Pill, DrillHistory, AttemptDetail, dateLabel, DrillHistory, durationLabel |
| src/features/visuals/DraggableEqualGroups.tsx | 230 | Reusable SVG visual model components (area grids, shape diagrams, fraction bars, arrays). | DraggableObject, DropZone, DraggableEqualGroups, checkEqualGroups, DraggableEqualGroups, DraggableObject, DropZone, handleDragEnd |
| src/features/stats/TodayAchievementDetail.tsx | 181 | Progress/statistics screens or calculations. | QuestionRow, TodayAchievementDetail, fmtSec, normalizeGroup, QuestionRow, TodayAchievementDetail |
| src/features/stats/GrowthView.tsx | 179 | Progress/statistics screens or calculations. | Counter, FactChip, GrowthGroup, GrowthView, chipTitle, Counter, FactChip, GrowthGroup |
| src/features/visuals/ShapeModel.tsx | 137 | Reusable SVG visual model components (area grids, shape diagrams, fraction bars, arrays). | SVGWrap, ShapeModel, ShapeName, pts, regularPoly, rightAnglePath, ShapeModel, SVGWrap |
| src/features/stats/QuizStatsView.tsx | 135 | Progress/statistics screens or calculations. | FactGroup, QuizStatsView, avgSecStr, FactGroup, fmt, QuizStatsView |
| src/features/stats/TodayAchievementSection.tsx | 125 | Progress/statistics screens or calculations. | AchievementTile, TodayAchievementSection, AchievementTile, TodayAchievementSection |
| src/features/mastery/skillPracticePlanner.ts | 905 | Grade 3 skill practice planner: maps skill IDs to SessionConfig for the mastery map. | buildDivisionFocusSequence, buildFocusSequence, buildRegroupingFocusSequence, FocusSequence, FocusSequenceContext, planFractionFocusSequence, planLearningUnitsForSkill, PlanOptions |
| src/features/practice/usePracticeSession.ts | 900 | Local persistence/database layer. | usePracticeSession, CorrectResult, LastSessionSummary, SessionState, usePracticeSession, commit, getStaticItem, planned |
| src/features/goals/GoalEvaluationSession.tsx | 760 | Exports reusable code: GoalEvaluationSession. | GoalEvaluationSession, buildNewLearningCandidates, buildReviewFindings, buildUpdatedState, confirmCancel, continueNext, evaluationArgs, GoalEvaluationSession |
| src/features/diagnosis/DiagnosticSession.tsx | 612 | Exports reusable code: DiagnosticSession. | DiagnosticSession, complete, DiagnosticSession, onKey |

## Repository tree, filtered

```text
├── docs
│   ├── arch
│   │   ├── data.html
│   │   ├── decisions.html
│   │   ├── features.html
│   │   └── index.html
│   ├── BROWSER_TESTING.md
│   ├── bug-review-2026-06-18.md
│   ├── CLOUD_DEVELOPMENT.md
│   ├── goals-daily-new-for-goals.md
│   ├── grade3-mastery-map-roadmap.md
│   └── PRD.md
├── scripts
│   ├── build-icons.py
│   ├── bump-version.mjs
│   ├── bump_version.py
│   ├── e2e_mathfan.py
│   ├── generate_code_map.py
│   ├── serve-https.py
│   ├── smoke-https-headers.py
│   └── smoke-update-flow.py
├── src
│   ├── components
│   │   ├── MasteryGrid.tsx
│   │   ├── MiniCalendar.tsx
│   │   ├── NumPad.tsx
│   │   ├── opSpecs.ts
│   │   ├── RangeSetup.tsx
│   │   ├── SessionSetup.tsx
│   │   ├── SessionSummary.tsx
│   │   ├── SettingsOverlay.tsx
│   │   └── StatsGraph.tsx
│   ├── db
│   │   ├── dexie.ts
│   │   └── repositories.ts
│   ├── features
│   │   ├── adaptive
│   │   │   ├── adaptiveItemSelector.ts
│   │   │   ├── candidatePools.ts
│   │   │   ├── relatedEvidence.ts
│   │   │   ├── relatedEvidenceRepair.ts
│   │   │   └── relatedItemMapping.ts
│   │   ├── ai
│   │   │   ├── aiConfig.ts
│   │   │   ├── gemini.ts
│   │   │   └── TutorChat.tsx
│   │   ├── analytics
│   │   │   ├── learningQuality.ts
│   │   │   └── schedulingCalibration.ts
│   │   ├── audio
│   │   │   ├── mathSpeech.ts
│   │   │   └── speech.ts
│   │   ├── auth
│   │   │   └── googleAuth.ts
│   │   ├── curriculum
│   │   │   ├── areaItems.ts
│   │   │   ├── arithmeticItems.ts
│   │   │   ├── decimalItems.ts
│   │   │   ├── describeItem.ts
│   │   │   ├── divisionItems.ts
│   │   │   ├── fractionItems.ts
│   │   │   ├── geometryItems.ts
│   │   │   ├── language.ts
│   │   │   ├── makeItemFromId.ts
│   │   │   ├── measurementItems.ts
│   │   │   ├── measurementTypes.ts
│   │   │   ├── mulPropertiesItems.ts
│   │   │   ├── multiplicationItems.ts
│   │   │   ├── numberTheoryItems.ts
│   │   │   ├── patternItems.ts
│   │   │   ├── practiceContentSpec.ts
│   │   │   ├── regrouping.ts
│   │   │   ├── roundingItems.ts
│   │   │   ├── twoStepItems.ts
│   │   │   └── wordProblemItems.ts
│   │   ├── dashboard
│   │   │   ├── ProfileSetup.tsx
│   │   │   └── StudentDashboard.tsx
│   │   ├── diagnosis
│   │   │   ├── diagnosticCompletion.ts
│   │   │   ├── diagnosticPersistence.ts
│   │   │   ├── diagnosticPlanner.ts
│   │   │   └── DiagnosticSession.tsx
│   │   ├── export
│   │   │   └── userDataExport.ts
│   │   ├── fluency
│   │   │   └── fluencyEngine.ts
│   │   ├── fractions
│   │   │   └── types.ts
│   │   ├── goals
│   │   │   ├── dailyNewGoalLimits.ts
│   │   │   ├── dailyNewGoalPlanner.ts
│   │   │   ├── goalEngine.ts
│   │   │   ├── goalEvaluationEngine.ts
│   │   │   ├── goalEvaluationPersistence.ts
│   │   │   ├── GoalEvaluationSession.tsx
│   │   │   ├── goalLifecycleService.ts
│   │   │   ├── goalPortfolioEngine.ts
│   │   │   ├── goalRecommendationEngine.ts
│   │   │   ├── GoalsPage.tsx
│   │   │   └── types.ts
│   │   ├── learning
│   │   │   ├── eventOrdering.ts
│   │   │   ├── eventRebuild.ts
│   │   │   ├── eventValidation.ts
│   │   │   ├── learningEvents.ts
│   │   │   ├── learningUnitProgress.ts
│   │   │   ├── recordAnswer.ts
│   │   │   └── schedulingTelemetry.ts
│   │   ├── learningPlan
│   │   │   ├── dailyLessonPersistence.ts
│   │   │   ├── dailyLessonPlanner.ts
│   │   │   └── focusSkillSelector.ts
│   │   ├── mastery
│   │   │   ├── grade3MasteryMap.ts
│   │   │   ├── Grade3MasteryMapPage.tsx
│   │   │   ├── misconceptionEngine.ts
│   │   │   ├── ParentNextActionCard.tsx
│   │   │   ├── SkillDetailPanel.tsx
│   │   │   ├── skillMapping.ts
│   │   │   ├── skillMasteryEngine.ts
│   │   │   ├── skillPracticePlanner.ts
│   │   │   ├── SkillTile.tsx
│   │   │   └── todayPlanEngine.ts
│   │   ├── migrations
│   │   │   ├── cardStateMigration.ts
│   │   │   ├── MigrationRecoveryScreen.tsx
│   │   │   └── migrationTypes.ts
│   │   ├── multiplication
│   │   │   ├── masteryEngine.ts
│   │   │   ├── multiplicationFacts.ts
│   │   │   ├── MultiplicationMasteryGrid.tsx
│   │   │   ├── MultiplicationQuizPage.tsx
│   │   │   ├── practiceRecommendation.ts
│   │   │   ├── quizQuestionSelector.ts
│   │   │   └── types.ts
│   │   ├── practice
│   │   │   ├── answerChecker.ts
│   │   │   ├── hintEngine.ts
│   │   │   ├── metrics.ts
│   │   │   ├── practiceNavigation.ts
│   │   │   ├── PracticeScreen.tsx
│   │   │   ├── QuestionRenderer.tsx
│   │   │   └── usePracticeSession.ts
│   │   ├── profile
│   │   │   ├── learnerIdentity.ts
│   │   │   └── profileBootstrap.ts
│   │   ├── scheduler
│   │   │   ├── cardModel.ts
│   │   │   ├── dailyReviewQueue.ts
│   │   │   ├── fsrsAdapter.ts
│   │   │   ├── responsePolicy.ts
│   │   │   ├── scheduler.ts
│   │   │   └── sessionSchedulingGuard.ts
│   │   ├── settings
│   │   │   ├── SettingsPage.tsx
│   │   │   └── updateCheck.ts
│   │   ├── stats
│   │   │   ├── DrillHistory.tsx
│   │   │   ├── FactStatsTable.tsx
│   │   │   ├── GrowthView.tsx
│   │   │   ├── QuizStatsView.tsx
│   │   │   ├── statsEngine.ts
│   │   │   ├── StatsPage.tsx
│   │   │   ├── todayAchievement.ts
│   │   │   ├── TodayAchievementDetail.tsx
│   │   │   └── TodayAchievementSection.tsx
│   │   ├── sync
│   │   │   ├── driveSync.ts
│   │   │   ├── learnerKeyMerge.ts
│   │   │   ├── snapshot.ts
│   │   │   ├── snapshotParsers.ts
│   │   │   ├── SyncWidget.tsx
│   │   │   ├── timeUtil.ts
│   │   │   └── useSync.ts
│   │   ├── theme
│   │   │   └── themes.ts
│   │   ├── time
│   │   │   ├── clock.ts
│   │   │   └── localDate.ts
│   │   └── visuals
│   │       ├── AreaGrid.tsx
│   │       ├── AreaPerimeterCompareModel.tsx
│   │       ├── ArrayModel.tsx
│   │       ├── barGraphGeometry.ts
│   │       ├── ClockModel.tsx
│   │       ├── DivisionArrayModel.tsx
│   │       ├── DivisionDecompositionModel.tsx
│   │       ├── DraggableEqualGroups.tsx
│   │       ├── ElapsedTimeLineModel.tsx
│   │       ├── EqualGroupsModel.tsx
│   │       ├── equalGroupsUtils.ts
│   │       ├── FractionBar.tsx
│   │       ├── FractionComparisonModel.tsx
│   │       ├── FractionEquivalenceModel.tsx
│   │       ├── FractionNumberLine.tsx
│   │       ├── FractionText.tsx
│   │       ├── LinePlotModel.tsx
│   │       ├── MathPrompt.tsx
│   │       ├── PerimeterPathModel.tsx
│   │       ├── PlaceValueRegroupModel.tsx
│   │       ├── RectangleMeasureModel.tsx
│   │       ├── RectilinearAreaModel.tsx
│   │       ├── ScaledBarGraphModel.tsx
│   │       ├── ShapeModel.tsx
│   │       ├── SharingGroupingModel.tsx
│   │       ├── TapeDiagramModel.tsx
│   │       ├── types.ts
│   │       ├── VisualModel.tsx
│   │       └── visualModelUtils.ts
│   ├── tests
│   │   ├── fixtures
│   │   │   └── snapshots
│   │   │       ├── v1-valid-item-id-states.json
│   │   │       ├── v2-valid-goals.json
│   │   │       ├── v3-invalid-attempt-missing-student.json
│   │   │       ├── v3-invalid-event-date.json
│   │   │       ├── v3-invalid-goal-evaluation-response.json
│   │   │       ├── v3-orphaned-child.json
│   │   │       └── v3-valid-current.json
│   │   ├── adaptiveRelatedItemSelection.test.ts
│   │   ├── ai.test.ts
│   │   ├── answerChecker.test.ts
│   │   ├── appDiagnosticCompletion.test.ts
│   │   ├── appGoalEvaluationNavigation.test.tsx
│   │   ├── areaPerimeterRedesign.test.tsx
│   │   ├── arithmeticItems.test.ts
│   │   ├── barGraphGeometry.test.ts
│   │   ├── cardModel.test.ts
│   │   ├── cardStateMigration.test.ts
│   │   ├── clock.test.ts
│   │   ├── components.test.tsx
│   │   ├── dailyLessonPersistence.test.ts
│   │   ├── dailyLessonPlanner.test.ts
│   │   ├── dailyNewGoalPlanner.test.ts
│   │   ├── dailyReviewQueue.test.ts
│   │   ├── describeItem.test.ts
│   │   ├── diagnosticPersistence.test.ts
│   │   ├── diagnosticPlanner.test.ts
│   │   ├── diagnosticSession.test.tsx
│   │   ├── divisionRedesign.test.tsx
│   │   ├── driveSyncErrors.test.ts
│   │   ├── eventOrdering.test.ts
│   │   ├── eventRebuild.test.ts
│   │   ├── fluencyEngine.test.ts
│   │   ├── fluencyRepository.test.ts
│   │   ├── fractionItems.test.ts
│   │   ├── fractionRedesign.test.tsx
│   │   ├── goalDexieSchema.test.ts
│   │   ├── goalEngine.test.ts
│   │   ├── goalEvaluationConcurrency.test.ts
│   │   ├── goalEvaluationEngine.test.tsx
│   │   ├── goalEvaluationSession.test.tsx
│   │   ├── goalPortfolioEngine.test.ts
│   │   ├── goalRecommendationEngine.test.ts
│   │   ├── goalRepositories.test.ts
│   │   ├── goalSnapshot.test.ts
│   │   ├── goalsPage.test.tsx
│   │   ├── grade3AddSubRegrouping.test.ts
│   │   ├── grade3AreaPerimeter.test.ts
│   │   ├── grade3MasteryMap.test.ts
│   │   ├── grade3MasteryMapRegression.test.ts
│   │   ├── grade3MulProperties.test.ts
│   │   ├── grade3NewSkills.test.ts
│   │   ├── grade3TwoStepAndPatterns.test.ts
│   │   ├── growth.test.ts
│   │   ├── hintEngine.test.ts
│   │   ├── learnerIdentity.test.ts
│   │   ├── learnerKeyMerge.test.ts
│   │   ├── learningEvents.test.ts
│   │   ├── learningUnitProgress.test.ts
│   │   ├── mainBranchGoalFixes.test.ts
│   │   ├── makeItemFromId.test.ts
│   │   ├── mathPrompt.test.tsx
│   │   ├── measurementRedesign.test.tsx
│   │   ├── misconceptionEngine.test.ts
│   │   ├── multiplicationQuiz.test.ts
│   │   ├── newCurriculum.test.ts
│   │   ├── practiceContentSpec.test.ts
│   │   ├── practiceMetrics.test.ts
│   │   ├── practiceNavigation.test.ts
│   │   ├── practiceSession.test.ts
│   │   ├── profileBootstrap.test.ts
│   │   ├── profileSetup.test.tsx
│   │   ├── questionGenerator.test.ts
│   │   ├── quizAutoAdvance.test.tsx
│   │   ├── rangeSelection.test.ts
│   │   ├── regroupingRedesign.test.tsx
│   │   ├── relatedEvidence.test.ts
│   │   ├── relatedEvidenceRepair.test.ts
│   │   ├── responsePolicy.test.ts
│   │   ├── rng.test.ts
│   │   ├── scheduler.test.ts
│   │   ├── schedulingTelemetry.test.ts
│   │   ├── sessionSchedulingGuard.test.ts
│   │   ├── settingsDailyNewLimits.test.tsx
│   │   ├── settingsExportUserData.test.tsx
│   │   ├── setup.ts
│   │   ├── skillMapping.test.ts
│   │   ├── skillMasteryEngine.test.ts
│   │   ├── skillPracticePlanner.test.ts
│   │   ├── snapshotBuild.test.ts
│   │   ├── snapshotValidation.test.ts
│   │   ├── speech.test.ts
│   │   ├── statsEngine.test.ts
│   │   ├── todayAchievement.test.ts
│   │   ├── todayPlanEngine.test.ts
│   │   ├── updateCheck.test.ts
│   │   ├── userDataExport.test.ts
│   │   └── visualModel.test.ts
│   ├── types
│   │   ├── google.d.ts
│   │   └── math.ts
│   ├── utils
│   │   ├── grammar.ts
│   │   ├── id.ts
│   │   ├── masteryColors.ts
│   │   └── rng.ts
│   ├── App.tsx
│   ├── env.d.ts
│   ├── index.css
│   └── main.tsx
├── tools
│   └── generate_code_maps.py
├── AGENTS.md
├── CLAUDE.md
├── eslint.config.js
├── index.html
├── mathladder_prd_and_implementation_guide.md
├── package.json
├── PROGRESS.md
├── README.md
├── requirements-e2e.txt
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts
```

## Important-file snippets

These snippets are intentionally short. They help Claude know where to look without reading every file.

### `src/App.tsx`

Purpose: Top-level React app shell: routes/screens, global state, and feature wiring.

```text
   1: import { useEffect, useRef, useState } from 'react';
   2: import type { StudentProfile, SessionConfig, StudentSettings } from './types/math';
   3: import { studentRepo, sessionRepo } from './db/repositories';
   4: import { ProfileSetup } from './features/dashboard/ProfileSetup';
   5: import { StudentDashboard, type PracticeOp } from './features/dashboard/StudentDashboard';
   6: import { PracticeScreen } from './features/practice/PracticeScreen';
   7: import { SessionSetup } from './components/SessionSetup';
   8: import { RangeSetup } from './components/RangeSetup';
   9: import { specFor } from './components/opSpecs';
  10: import { StatsPage } from './features/stats/StatsPage';
  11: import { SettingsPage } from './features/settings/SettingsPage';
  12: import { MultiplicationQuizPage } from './features/multiplication/MultiplicationQuizPage';
  13: import { TodayAchievementDetail } from './features/stats/TodayAchievementDetail';
  14: import type { AchievementFilter, TodayAchievementData } from './features/stats/todayAchievement';
  15: import { Grade3MasteryMapPage } from './features/mastery/Grade3MasteryMapPage';
  16: import { DiagnosticSession } from './features/diagnosis/DiagnosticSession';
  17: import { GoalsPage } from './features/goals/GoalsPage';
  18: import { GoalEvaluationSession } from './features/goals/GoalEvaluationSession';
  19: import { preloadVoices } from './features/audio/speech';
  20: import { useSync, initAuth } from './features/sync/useSync';
  21: import { pushLocal, pullAndMerge } from './features/sync/driveSync';
  22: import { currentState as authState, hasPersistedGrant } from './features/auth/googleAuth';
  23: import { applyTheme } from './features/theme/themes';
  24: import { syncDiagnosticCompletionIfSignedIn } from './features/diagnosis/diagnosticCompletion';
  25: import { resolvePracticeDoneDestination } from './features/practice/practiceNavigation';
  26: import { bootstrapProfiles, loadActiveProfileSelection, saveActiveProfileSelection, resolveSelectedProfile } from './features/profile/profileBootstrap';
  27: import { runCardStateMigration } from './features/migrations/cardStateMigration';
  28: import type { RestoreState } from './features/dashboard/ProfileSetup';
  29: import { MigrationRecoveryScreen } from './features/migrations/MigrationRecoveryScreen';
  30: import { db } from './db/dexie';
  31:
  32: type Screen =
  33:   | 'loading' | 'setup' | 'dashboard'
  34:   | 'daily-setup' | 'range-setup' | 'practice'
  35:   | 'stats' | 'settings' | 'quiz' | 'today-detail' | 'mastery-map' | 'diagnostic' | 'goals' | 'goal-evaluation' | 'migration-error';
  36:
  37: export default function App() {
  38:   const [screen, setScreen] = useState<Screen>('loading');
  39:   const [profile, setProfile] = useState<StudentProfile | null>(null);
  40:   const [existingProfiles, setExistingProfiles] = useState<StudentProfile[]>([]);
  41:   const [restoreState, setRestoreState] = useState<RestoreState>('idle');
  42:   const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  43:   const [selectedOp, setSelectedOp] = useState<PracticeOp>('multiplication');
  44:   const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('total');
  45:   const [achievementData, setAchievementData] = useState<TodayAchievementData | null>(null);
  46:   const { auth, syncStatus, lastSyncedAt, syncError, handleSignIn, handleSignOut, manualSync } = useSync();
  47:   const [practiceReturn, setPracticeReturn] = useState<Screen>('dashboard');
  48:   const [initialGoalSkillIds, setInitialGoalSkillIds] = useState<string[] | null>(null);
  49:   const [migrationError, setMigrationError] = useState<string | null>(null);
  50:   const [migrationRetrying, setMigrationRetrying] = useState(false);
  51:
  52:   const selectProfile = (p: StudentProfile) => {
  53:     setProfile(p);
  54:     saveActiveProfileSelection(p);
  55:     applyTheme(p.settings.theme ?? 'indigo');
  56:     sessionRepo.deleteEmpty(p.id).catch(() => {});
  57:     setScreen('dashboard');
  58:   };
  59:
  60:   const runBootstrap = async () => {
... (340 more lines)
```

### `src/features/sync/SyncWidget.tsx`

Purpose: Cloud sync/auth/data transfer logic.

```text
   1: import type { SyncStatus } from './driveSync';
   2: import type { AuthState } from '../auth/googleAuth';
   3:
   4: const HAS_GOOGLE_CONFIG = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
   5:
   6: interface Props {
   7:   auth: AuthState;
   8:   syncStatus: SyncStatus;
   9:   lastSyncedAt: string | null;
  10:   syncError: string | null;
  11:   onSignIn: () => void;
  12:   onSignOut: () => void;
  13:   onSync: () => void;
  14: }
  15:
  16: export function SyncWidget({ auth, syncStatus, lastSyncedAt, syncError, onSignIn, onSignOut, onSync }: Props) {
  17:   const isSyncing = syncStatus === 'syncing';
  18:
  19:   // ── Not configured ────────────────────────────────────────────────────────
  20:   if (!HAS_GOOGLE_CONFIG) {
  21:     return (
  22:       <div style={{ ...s.box, borderColor: '#fcd34d', background: '#fffbeb' }}>
  23:         <p style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', margin: '0 0 4px' }}>
  24:           ⚠ Google sync not configured
  25:         </p>
  26:         <p style={{ fontSize: '12px', color: '#78350f', margin: 0, lineHeight: 1.5 }}>
  27:           Create a <code style={s.code}>.env</code> file in the project root with{' '}
  28:           <code style={s.code}>VITE_GOOGLE_CLIENT_ID=…</code>, then restart the dev server.
  29:         </p>
  30:       </div>
  31:     );
  32:   }
  33:
  34:   // ── Signed out ────────────────────────────────────────────────────────────
  35:   if (!auth.signedIn) {
  36:     return (
  37:       <div style={s.box}>
  38:         <div style={s.row}>
  39:           <div style={s.text}>
  40:             <p style={s.label}>Sign in to sync across devices</p>
  41:             <p style={s.sub}>Your progress follows you everywhere.</p>
  42:           </div>
  43:           <button
  44:             style={{ ...s.signInBtn, opacity: isSyncing ? 0.6 : 1 }}
  45:             onClick={onSignIn}
  46:             disabled={isSyncing}
  47:           >
  48:             {isSyncing ? (
  49:               <span style={s.spinner}>⏳</span>
  50:             ) : (
  51:               <GoogleIcon />
  52:             )}
  53:             {isSyncing ? 'Signing in…' : 'Sign in'}
  54:           </button>
  55:         </div>
  56:
  57:         {/* Show errors even before sign-in completes */}
  58:         {syncStatus === 'error' && syncError && (
  59:           <p style={s.errorMsg}>⚠ {friendlyError(syncError)}</p>
  60:         )}
... (95 more lines)
```

### `src/features/sync/snapshot.ts`

Purpose: Local persistence/database layer.

```text
   1: import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession, PersistedDailyLessonPlan } from '../../types/math';
   2: import { dailyLessonSemanticKey, hashDailyLessonContent } from '../learningPlan/dailyLessonPersistence';
   3: import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
   4: import type { MathAnswerEvent } from '../learning/learningEvents';
   5: import { rebuildMultFactStatsFromEvents, rebuildItemStatesFromEvents } from '../learning/eventRebuild';
   6: import { db } from '../../db/dexie';
   7: import type { GoalEvaluation, GoalEvent, LearningGoal } from '../goals/types';
   8: import { mergeProfilesByExactId, remapStudentId, resolveCanonicalStudentIds, resolveLearnerKeyDuplicate, type StudentIdAliasMap } from './learnerKeyMerge';
   9: import { validTimeMs, remoteHasNewerUpdatedAt } from './timeUtil';
  10: import { makeItemFromId } from '../curriculum/makeItemFromId';
  11: import { deriveCardKey } from '../scheduler/cardModel';
  12: import { CARD_MODEL_VERSION } from '../learning/schedulingTelemetry';
  13: import { assertValidPracticeItem, validatePracticeItem } from '../curriculum/practiceContentSpec';
  14: import { loadActiveProfileSelection, saveActiveProfileSelection } from '../profile/profileBootstrap';
  15: import {
  16:   parseAttemptLog, parseDailyLessonPlanShape, parseGoalEvaluation, parseGoalEvent, parseLearningGoal,
  17:   parseMathAnswerEvent, parseMultiplicationFactStat, parsePracticeSession, parseQuizSession,
  18:   parseSnapshotTable, parseStudentItemState, parseStudentProfile,
  19: } from './snapshotParsers';
  20:
  21: export interface SnapshotFormatMetadata {
  22:   appVersion: string;
  23:   gitSha: string;
  24:   buildTime: string;
  25:   schemaVersion: 3;
  26:   cardModelVersion: string;
  27:   exportedAt: string;
  28: }
  29:
  30: export interface AppSnapshot {
  31:   appId: 'mathfan';
  32:   snapshotVersion: 1 | 2 | 3;
  33:   snapshotAt: string;
  34:   metadata?: SnapshotFormatMetadata;
  35:   students: StudentProfile[];
  36:   itemStates: StudentItemState[];
  37:   attempts: AttemptLog[];
  38:   sessions: PracticeSession[];
  39:   // Added in quiz feature — absent in older snapshots; treat missing as []
  40:   multFactStats?: MultiplicationFactStats[];
  41:   quizSessions?: QuizSession[];
  42:   // Added with canonical event log — absent in older snapshots; treat missing as []
  43:   mathAnswerEvents?: MathAnswerEvent[];
  44:   learningGoals?: LearningGoal[];
  45:   goalEvents?: GoalEvent[];
  46:   goalEvaluations?: GoalEvaluation[];
  47:   dailyLessonPlans?: PersistedDailyLessonPlan[];
  48: }
  49:
  50: // ── Build ─────────────────────────────────────────────────────────────────────
  51:
  52: export async function buildSnapshot(): Promise<AppSnapshotV3> {
  53:   const tables = [
  54:     db.students,
  55:     db.itemStates,
  56:     db.attempts,
  57:     db.sessions,
  58:     db.multFactStats,
  59:     db.quizSessions,
  60:     db.mathAnswerEvents,
... (536 more lines)
```

### `vite.config.ts`

Purpose: Vite build/PWA configuration.

```text
   1: import { defineConfig, type Plugin } from 'vite'
   2: import react from '@vitejs/plugin-react'
   3: import { VitePWA } from 'vite-plugin-pwa'
   4: import { readFileSync } from 'node:fs'
   5:
   6: // VITE_BASE_PATH: set to /mathfan/ when deploying to GitHub Pages project site,
   7: // leave unset (defaults to /) for custom domain or local dev.
   8: const base = process.env.VITE_BASE_PATH ?? '/'
   9: const pkg: { version: string } = JSON.parse(readFileSync('./package.json', 'utf8'))
  10:
  11: // Computed once so the values baked into the bundle (via `define`) and the
  12: // values written to build-info.json are guaranteed to match. The update checker
  13: // in Settings compares these two to decide whether a newer build is deployed.
  14: const appVersion = pkg.version
  15: const gitSha = process.env.VITE_GIT_SHA ?? 'dev'
  16: const buildTime = new Date().toISOString()
  17:
  18: // Emits /build-info.json into dist and serves the same payload in dev, so the
  19: // "Check for Updates" button can probe the deployed build over the network.
  20: // build-info.json is intentionally NOT in the Workbox precache globs, so the
  21: // service worker never serves a stale copy — the fetch always hits the network.
  22: function buildInfoPlugin(): Plugin {
  23:   const payload = JSON.stringify({ appVersion, gitSha, buildTime }, null, 2)
  24:   return {
  25:     name: 'mathfan-build-info',
  26:     configureServer(server) {
  27:       server.middlewares.use((req, res, next) => {
  28:         if (req.url && req.url.split('?')[0].endsWith('/build-info.json')) {
  29:           res.setHeader('Content-Type', 'application/json')
  30:           res.setHeader('Cache-Control', 'no-store')
  31:           res.end(payload)
  32:           return
  33:         }
  34:         next()
  35:       })
  36:     },
  37:     generateBundle() {
  38:       this.emitFile({ type: 'asset', fileName: 'build-info.json', source: payload })
  39:     },
  40:   }
  41: }
  42:
  43: export default defineConfig({
  44:   base,
  45:   define: {
  46:     __APP_VERSION__: JSON.stringify(appVersion),
  47:     __GIT_SHA__: JSON.stringify(gitSha),
  48:     __BUILD_TIME__: JSON.stringify(buildTime),
  49:   },
  50:   plugins: [
  51:     buildInfoPlugin(),
  52:     react(),
  53:     VitePWA({
  54:       registerType: 'prompt',
  55:       includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  56:       manifest: {
  57:         name: 'MathFan',
  58:         short_name: 'MathFan',
  59:         description: 'Adaptive math practice for grades 3–5',
  60:         theme_color: '#4f46e5',
... (21 more lines)
```

### `package.json`

Purpose: Project package metadata, scripts, dependencies, and dev tooling.

```text
   1: {
   2:   "name": "mathfan",
   3:   "private": true,
   4:   "version": "1.2.0",
   5:   "type": "module",
   6:   "scripts": {
   7:     "dev": "vite",
   8:     "build": "tsc -b && vite build",
   9:     "lint": "eslint .",
  10:     "preview": "vite preview",
  11:     "test": "vitest run",
  12:     "test:watch": "vitest",
  13:     "test:coverage": "vitest run --coverage",
  14:     "test:e2e:journey": "python scripts/e2e_mathfan.py",
  15:     "test:e2e:update": "python scripts/smoke-update-flow.py",
  16:     "test:e2e": "npm run test:e2e:journey && npm run test:e2e:update",
  17:     "ci": "npm run lint && npm test && npm run build"
  18:   },
  19:   "dependencies": {
  20:     "@dnd-kit/core": "^6.3.1",
  21:     "@dnd-kit/sortable": "^10.0.0",
  22:     "dexie": "^4.4.3",
  23:     "fraction.js": "^5.3.4",
  24:     "jszip": "^3.10.1",
  25:     "mafs": "^0.21.0",
  26:     "react": "^19.2.6",
  27:     "react-dom": "^19.2.6",
  28:     "react-router-dom": "^7.16.0",
  29:     "ts-fsrs": "^5.4.1"
  30:   },
  31:   "devDependencies": {
  32:     "@eslint/js": "^10.0.1",
  33:     "@testing-library/jest-dom": "^6.9.1",
  34:     "@testing-library/react": "^16.3.2",
  35:     "@types/node": "^24.12.3",
  36:     "@types/react": "^19.2.14",
  37:     "@types/react-dom": "^19.2.3",
  38:     "@vitejs/plugin-react": "^6.0.1",
  39:     "@vitest/coverage-v8": "^4.1.7",
  40:     "eslint": "^10.3.0",
  41:     "eslint-plugin-react-hooks": "^7.1.1",
  42:     "eslint-plugin-react-refresh": "^0.5.2",
  43:     "fake-indexeddb": "^6.2.5",
  44:     "globals": "^17.6.0",
  45:     "jsdom": "^29.1.1",
  46:     "typescript": "~6.0.2",
  47:     "typescript-eslint": "^8.59.2",
  48:     "vite": "^8.0.12",
  49:     "vite-plugin-pwa": "^1.3.0",
  50:     "vitest": "^4.1.7"
  51:   }
  52: }
```

### `src/main.tsx`

Purpose: React entry point that mounts the app.

```text
   1: import { StrictMode } from 'react'
   2: import { createRoot } from 'react-dom/client'
   3: import './index.css'
   4: import App from './App.tsx'
   5:
   6: // When a new service worker activates (skipWaiting fires), reload so the fresh
   7: // bundle is served. Guard with hadController so the very first SW install on a
   8: // brand-new visit doesn't trigger a spurious reload.
   9: if ('serviceWorker' in navigator) {
  10:   const hadController = !!navigator.serviceWorker.controller;
  11:   navigator.serviceWorker.addEventListener('controllerchange', () => {
  12:     if (hadController) window.location.reload();
  13:   });
  14: }
  15:
  16: createRoot(document.getElementById('root')!).render(
  17:   <StrictMode>
  18:     <App />
  19:   </StrictMode>,
  20: )
```

### `src/features/sync/driveSync.ts`

Purpose: Cloud sync/auth/data transfer logic.

```text
   1: import type { AppSnapshotV3 } from './snapshot';
   2: import { buildSnapshot, mergeNormalizedSnapshot, normalizeSnapshot } from './snapshot';
   3: import { getToken } from '../auth/googleAuth';
   4:
   5: const FILE_NAME = 'mathfan-data.json';
   6: const LIST_URL = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,size,modifiedTime)&q=name='${FILE_NAME}'`;
   7: const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
   8: const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
   9:
  10: export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
  11:
  12: export interface SyncResult {
  13:   ok: boolean;
  14:   error?: string;
  15:   syncedAt?: string;
  16: }
  17:
  18: interface DriveListFile {
  19:   id: string;
  20:   size?: string;
  21:   modifiedTime?: string;
  22: }
  23:
  24: function newestSyncFile(files: DriveListFile[] | undefined): DriveListFile | null {
  25:   if (!files?.length) return null;
  26:   return [...files].sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))[0];
  27: }
  28:
  29: async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  30:   const token = await getToken();
  31:   if (!token) throw new Error('Not signed in');
  32:   return fetch(url, {
  33:     ...options,
  34:     headers: {
  35:       Authorization: `Bearer ${token}`,
  36:       ...(options.headers as Record<string, string> ?? {}),
  37:     },
  38:   });
  39: }
  40:
  41: async function findSyncFile(): Promise<string | null> {
  42:   const res = await authFetch(LIST_URL);
  43:   if (!res.ok) throw new Error(`Drive LIST failed: ${res.status}`);
  44:   const data = await res.json();
  45:   return newestSyncFile(data.files as DriveListFile[] | undefined)?.id ?? null;
  46: }
  47:
  48: async function uploadSnapshot(snapshot: AppSnapshotV3, existingId?: string): Promise<void> {
  49:   const body = JSON.stringify(snapshot);
  50:
  51:   if (existingId) {
  52:     // Update existing file (media-only PATCH)
  53:     const res = await authFetch(
  54:       `${UPLOAD_URL}/${existingId}?uploadType=media`,
  55:       { method: 'PATCH', body, headers: { 'Content-Type': 'application/json' } }
  56:     );
  57:     if (!res.ok) throw new Error(`Drive PATCH failed: ${res.status}`);
  58:   } else {
  59:     // Create new file in appDataFolder (multipart POST)
  60:     const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
... (103 more lines)
```

### `src/features/sync/snapshotParsers.ts`

Purpose: Cloud sync/auth/data transfer logic.

```text
   1: import type { AttemptLog, PersistedDailyLessonPlan, PracticeSession, StudentItemState, StudentProfile } from '../../types/math';
   2: import type { MathAnswerEvent } from '../learning/learningEvents';
   3: import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
   4: import type { GoalEvaluation, GoalEvent, LearningGoal } from '../goals/types';
   5: import type { SnapshotNormalizationProblem } from './snapshot';
   6:
   7: export type ParseResult<T> =
   8:   | { ok: true; value: T; warnings: SnapshotNormalizationProblem[] }
   9:   | { ok: false; problems: SnapshotNormalizationProblem[] };
  10:
  11: type Row = Record<string, unknown>;
  12:
  13: const record = (value: unknown): Row | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : undefined;
  14: const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  15: const finiteNonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  16: const validDate = (value: unknown): value is string => nonempty(value) && Number.isFinite(Date.parse(value));
  17:
  18: function parseRow<T>(table: string, value: unknown, index: number, validate: (row: Row, add: (code: string, message: string) => void) => void): ParseResult<T> {
  19:   const row = record(value);
  20:   if (!row) return { ok: false, problems: [{ table, recordId: String(index), code: 'not_object', message: 'Record must be an object.' }] };
  21:   const problems: SnapshotNormalizationProblem[] = [];
  22:   const recordId = nonempty(row.id) ? row.id : String(index);
  23:   const add = (code: string, message: string) => problems.push({ table, recordId, code, message });
  24:   validate(row, add);
  25:   return problems.length ? { ok: false, problems } : { ok: true, value: row as T, warnings: [] };
  26: }
  27:
  28: const identity = (row: Row, add: (code: string, message: string) => void) => {
  29:   if (!nonempty(row.id)) add('missing_id', 'Record is missing a nonempty id.');
  30:   if (!nonempty(row.studentId)) add('missing_owner', 'Record is missing a nonempty studentId.');
  31: };
  32: const dateField = (row: Row, key: string, add: (code: string, message: string) => void, optional = false) => {
  33:   if (optional && row[key] === undefined) return;
  34:   if (!validDate(row[key])) add('invalid_timestamp', `${key} must be a valid timestamp.`);
  35: };
  36: const stringField = (row: Row, key: string, add: (code: string, message: string) => void) => {
  37:   if (!nonempty(row[key])) add('missing_field', `${key} must be a nonempty string.`);
  38: };
  39: const numberField = (row: Row, key: string, add: (code: string, message: string) => void) => {
  40:   if (!finiteNonnegative(row[key])) add('invalid_number', `${key} must be a finite nonnegative number.`);
  41: };
  42: const arrayField = (row: Row, key: string, add: (code: string, message: string) => void) => {
  43:   if (!Array.isArray(row[key])) add('invalid_array', `${key} must be an array.`);
  44: };
  45: const enumField = (row: Row, key: string, values: readonly string[], add: (code: string, message: string) => void) => {
  46:   if (!nonempty(row[key]) || !values.includes(row[key])) add('invalid_enum', `${key} is not a supported value.`);
  47: };
  48:
  49: export const parseStudentProfile = (value: unknown, index: number): ParseResult<StudentProfile> => parseRow('students', value, index, (row, add) => {
  50:   if (!nonempty(row.id)) add('missing_id', 'Profile is missing a nonempty id.');
  51:   stringField(row, 'displayName', add);
  52:   dateField(row, 'createdAt', add, true);
  53:   if (row.settings !== undefined && !record(row.settings)) add('invalid_settings', 'settings must be an object.');
  54: });
  55:
  56: export const parseAttemptLog = (value: unknown, index: number): ParseResult<AttemptLog> => parseRow('attempts', value, index, (row, add) => {
  57:   identity(row, add); ['itemId', 'skillId', 'sessionId', 'promptShown'].forEach(key => stringField(row, key, add));
  58:   numberField(row, 'latencyMs', add); dateField(row, 'createdAt', add);
  59:   enumField(row, 'reviewGrade', ['again', 'hard', 'good', 'easy'], add);
  60:   if (typeof row.isCorrect !== 'boolean') add('invalid_boolean', 'isCorrect must be a boolean.');
... (70 more lines)
```

### `src/features/sync/learnerKeyMerge.ts`

Purpose: Cloud sync/auth/data transfer logic.

```text
   1: import type { StudentProfile } from '../../types/math';
   2: import { validTimeMs } from './timeUtil';
   3:
   4: function stableValue(value: unknown): unknown {
   5:   if (Array.isArray(value)) return value.map(stableValue);
   6:   if (!value || typeof value !== 'object') return value;
   7:   return Object.fromEntries(Object.entries(value as Record<string, unknown>)
   8:     .sort(([left], [right]) => left.localeCompare(right))
   9:     .map(([key, child]) => [key, stableValue(child)]));
  10: }
  11:
  12: /** Stable metadata-only tie breaker for two revisions of the same profile row. */
  13: export function stableProfileFingerprint(profile: StudentProfile): string {
  14:   const metadata = Object.fromEntries(Object.entries(profile)
  15:     .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key)));
  16:   return JSON.stringify(stableValue(metadata));
  17: }
  18:
  19: export function compareProfileRevision(a: StudentProfile, b: StudentProfile): number {
  20:   const aUpdated = validTimeMs(a.updatedAt);
  21:   const bUpdated = validTimeMs(b.updatedAt);
  22:   if (aUpdated !== null || bUpdated !== null) {
  23:     if (aUpdated === null) return -1;
  24:     if (bUpdated === null) return 1;
  25:     if (aUpdated !== bUpdated) return aUpdated - bUpdated;
  26:   } else {
  27:     const createdDifference = (validTimeMs(a.createdAt) ?? 0) - (validTimeMs(b.createdAt) ?? 0);
  28:     if (createdDifference) return createdDifference;
  29:   }
  30:   return stableProfileFingerprint(a).localeCompare(stableProfileFingerprint(b));
  31: }
  32:
  33: function mergeSameIdProfile(older: StudentProfile, newer: StudentProfile): StudentProfile {
  34:   return {
  35:     ...older,
  36:     ...newer,
  37:     id: older.id,
  38:     learnerKey: newer.learnerKey ?? older.learnerKey,
  39:     settings: newer.settings ?? older.settings,
  40:     createdAt: [older.createdAt, newer.createdAt].filter(Boolean).sort()[0],
  41:     updatedAt: newer.updatedAt ?? older.updatedAt,
  42:   };
  43: }
  44:
  45: /** Collapses exact IDs by revision before learner-key aliasing is considered. */
  46: export function mergeProfilesByExactId(
  47:   localProfiles: StudentProfile[],
  48:   remoteProfiles: StudentProfile[],
  49: ): StudentProfile[] {
  50:   const byId = new Map<string, StudentProfile>();
  51:   for (const profile of [...localProfiles, ...remoteProfiles]) {
  52:     const existing = byId.get(profile.id);
  53:     if (!existing) { byId.set(profile.id, profile); continue; }
  54:     const comparison = compareProfileRevision(existing, profile);
  55:     byId.set(profile.id, comparison <= 0
  56:       ? mergeSameIdProfile(existing, profile)
  57:       : mergeSameIdProfile(profile, existing));
  58:   }
  59:   return [...byId.values()];
  60: }
... (67 more lines)
```

### `src/features/sync/useSync.ts`

Purpose: Cloud sync/auth/data transfer logic.

```text
   1: import { useState, useEffect, useCallback } from 'react';
   2: import { currentState, onChange, signIn, signOut, preload } from '../auth/googleAuth';
   3: import { pullAndMerge, pushLocal, syncBothWays } from './driveSync';
   4: import type { AuthState } from '../auth/googleAuth';
   5: import type { SyncStatus } from './driveSync';
   6:
   7: export interface SyncState {
   8:   auth: AuthState;
   9:   syncStatus: SyncStatus;
  10:   lastSyncedAt: string | null;
  11:   syncError: string | null;
  12: }
  13:
  14: const SYNC_AT_KEY = 'mathfan_last_synced';
  15:
  16: export function useSync() {
  17:   const [auth, setAuth] = useState<AuthState>(currentState);
  18:   const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  19:   const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
  20:     () => localStorage.getItem(SYNC_AT_KEY)
  21:   );
  22:   const [syncError, setSyncError] = useState<string | null>(null);
  23:
  24:   // Subscribe to auth changes
  25:   useEffect(() => {
  26:     return onChange(setAuth);
  27:   }, []);
  28:
  29:   const recordSync = (at: string) => {
  30:     setLastSyncedAt(at);
  31:     localStorage.setItem(SYNC_AT_KEY, at);
  32:   };
  33:
  34:   const handleSignIn = useCallback(async () => {
  35:     setSyncStatus('syncing');
  36:     setSyncError(null);
  37:     try {
  38:       await signIn();
  39:       // After sign-in: pull first (get their data from other devices), then push local
  40:       const result = await syncBothWays();
  41:       if (result.ok && result.syncedAt) recordSync(result.syncedAt);
  42:       setSyncStatus(result.ok ? 'synced' : 'error');
  43:       if (!result.ok) setSyncError(result.error ?? 'Sync failed');
  44:     } catch (err) {
  45:       setSyncStatus('error');
  46:       setSyncError(err instanceof Error ? err.message : 'Sign-in failed');
  47:     }
  48:   }, []);
  49:
  50:   const handleSignOut = useCallback(() => {
  51:     signOut();
  52:     setSyncStatus('idle');
  53:     setSyncError(null);
  54:   }, []);
  55:
  56:   /** Push local data to Drive. Call after a session completes. */
  57:   const pushAfterSession = useCallback(async () => {
  58:     if (!currentState().signedIn) return;
  59:     const result = await pushLocal();
  60:     if (result.ok && result.syncedAt) recordSync(result.syncedAt);
... (38 more lines)
```

### `src/features/sync/timeUtil.ts`

Purpose: Cloud sync/auth/data transfer logic.

```text
   1: export function validTimeMs(value: string | undefined): number | null {
   2:   if (!value) return null;
   3:   const ms = Date.parse(value);
   4:   return Number.isFinite(ms) ? ms : null;
   5: }
   6:
   7: export function remoteHasNewerUpdatedAt(remoteUpdatedAt: string, localUpdatedAt: string | undefined): boolean {
   8:   const remoteMs = validTimeMs(remoteUpdatedAt);
   9:   if (remoteMs === null) return false;
  10:   const localMs = validTimeMs(localUpdatedAt);
  11:   return localMs === null || remoteMs >= localMs;
  12: }
```

### `src/features/goals/GoalsPage.tsx`

Purpose: React UI component file: ConfirmDialog, EmptyState, GoalCard, GoalWizard.

```text
   1: import { useEffect, useMemo, useRef, useState } from 'react';
   2: import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
   3: import type { StudentProfile, StudentItemState } from '../../types/math';
   4: import type { MathAnswerEvent } from '../learning/learningEvents';
   5: import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
   6: import type { GoalRecommendation } from './goalRecommendationEngine';
   7: import type { GoalSkillTarget, GoalTargetReason, LearningGoal } from './types';
   8: import {
   9:   goalEventRepo,
  10:   itemStateRepo,
  11:   learningGoalRepo,
  12:   mathAnswerEventRepo,
  13: } from '../../db/repositories';
  14: import { generateId } from '../../utils/id';
  15: import { makeItemFromId } from '../curriculum/makeItemFromId';
  16: import { GRADE3_MASTERY_MAP, getGrade3Skill } from '../mastery/grade3MasteryMap';
  17: import { deriveGrade3SkillSummaries } from '../mastery/skillMasteryEngine';
  18: import { appNow } from '../time/clock';
  19: import {
  20:   applyGoalTargetEdits,
  21:   buildGoalSkillTarget,
  22:   calculateGoalProgress,
  23:   captureGoalBaseline,
  24:   localDateInTimeZone,
  25:   suggestedTargetDefaults,
  26:   type GoalEvidenceInput,
  27:   type GoalProgress,
  28:   type GoalTargetEditDraft,
  29: } from './goalEngine';
  30: import {
  31:   estimateGoalWorkload,
  32:   recommendLearningGoals,
  33: } from './goalRecommendationEngine';
  34: import {
  35:   cancelGoal,
  36:   completeGoal,
  37:   endGoal,
  38:   evaluateGoalLifecycleAndPersist,
  39:   pauseGoal,
  40:   resumeGoal,
  41:   updateGoal,
  42: } from './goalLifecycleService';
  43: import { analyzeGoalPortfolio } from './goalPortfolioEngine';
  44: import { normalizeDailyNewGoalLimits, validateDailyNewGoalLimits } from './dailyNewGoalLimits';
  45: import { planDailyNewForGoals } from './dailyNewGoalPlanner';
  46:
  47: interface Props {
  48:   profile: StudentProfile;
  49:   lastSyncedAt?: string | null;
  50:   initialGoalSkillIds?: string[] | null;
  51:   onInitialGoalSkillsHandled?: () => void;
  52:   onBack: () => void;
  53:   onStartEvaluation: () => void;
  54:   onUpdateProfile?: (profile: StudentProfile) => void | Promise<void>;
  55: }
  56:
  57: type PageState =
  58:   | { status: 'loading' }
  59:   | { status: 'error'; message: string }
  60:   | { status: 'ready'; data: GoalsData };
... (995 more lines)
```
