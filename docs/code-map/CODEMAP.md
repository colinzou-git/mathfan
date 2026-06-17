# Code Map Overview

Generated: 2026-06-17 07:32:31 UTC

Repo root: `C:\Users\colin\Documents\mathFan`
Output folder: `C:\Users\colin\Documents\mathFan\docs\code-map`

## What this is for

This folder is a compact repo memory for Claude Code / Codex. Start AI coding sessions by asking the model to read `CLAUDE_START_HERE.md`, then `CODEMAP.md`, then `SYMBOLS.md` before scanning source files.

## Project summary

- Package name: `mathfan`
- Version: `1.2.0`
- Module type: `module`
- Scanned files: **194**
- Scanned lines: **35,570**
- Scanned bytes: **1,402,301**

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
| ci | npm run lint && npm test && npm run build |

## Dependencies

| Package | Version | Kind |
| --- | --- | --- |
| @dnd-kit/core | ^6.3.1 | runtime |
| @dnd-kit/sortable | ^10.0.0 | runtime |
| dexie | ^4.4.3 | runtime |
| fraction.js | ^5.3.4 | runtime |
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
| src/App.tsx | 280 | Top-level React app shell: routes/screens, global state, and feature wiring. | App, handleQuizDone, handleSessionDone, pickOperation, startPractice, updateProfile, updateSettings |
| src/features/sync/SyncWidget.tsx | 156 | Cloud sync/auth/data transfer logic. | GoogleIcon, SyncWidget, friendlyError, GoogleIcon, initials, SyncWidget, timeSince |
| src/features/sync/snapshot.ts | 210 | Local persistence/database layer. | AppSnapshot, validateSnapshot, buildSnapshot, mergeSnapshot, remoteHasNewerUpdatedAt, validateSnapshot, validTimeMs |
| vite.config.ts | 82 | Vite build/PWA configuration. | buildInfoPlugin |
| package.json | 48 | Project package metadata, scripts, dependencies, and dev tooling. |  |
| src/main.tsx | 21 | React entry point that mounts the app. |  |
| src/features/sync/driveSync.ts | 151 | Cloud sync/auth/data transfer logic. | DriveFileInfo, SyncResult, SyncStatus, authFetch, downloadSnapshot, findSyncFile, getDriveFileInfo, pullAndMerge |
| src/features/sync/useSync.ts | 99 | Cloud sync/auth/data transfer logic. | useSync, initAuth, SyncState, useSync, recordSync, useSync |
| src/features/multiplication/MultiplicationQuizPage.tsx | 845 | Local persistence/database layer. | FactChip, SetupScreen, StatBox, SummaryScreen, MultiplicationQuizPage, FactChip, MultiplicationQuizPage, recommendedPracticeConfig |
| src/features/practice/PracticeScreen.tsx | 552 | Local persistence/database layer. | KbChip, PracticeScreen, KbChip, onKey, PracticeScreen, run, submitChoice |
| src/features/settings/SettingsPage.tsx | 516 | Student/app settings UI or persistence. | Section, SyncRow, ToggleRow, SettingsPage, applyUpdate, buildId, buildLabel, checkForUpdates |
| src/features/stats/FactStatsTable.tsx | 402 | Local persistence/database layer. | SortBtn, SummaryStat, FactStatsTable, bucketOf, FactStatsTable, SortBtn, startPractice, SummaryStat |
| src/features/mastery/Grade3MasteryMapPage.tsx | 365 | Grade 3 mastery map UI: skill display, detail panels, and parent action cards. | LegendItem, Grade3MasteryMapPage, buildCompleteSummaries, computeUnmetPrereqNames, Grade3MasteryMapPage, LegendItem |
| src/features/dashboard/StudentDashboard.tsx | 330 | Dashboard/profile setup/student navigation feature. | Chip, PracticeOp, StudentDashboard, Chip, handleStartReview, StudentDashboard |
| src/features/stats/StatsPage.tsx | 246 | Progress/statistics screens or calculations. | SummaryPill, StatsPage, buildRange, daysBetween, StatsPage, SummaryPill, toYMD |
| src/features/stats/DrillHistory.tsx | 238 | Progress/statistics screens or calculations. | AttemptDetail, MetricChip, Pill, DrillHistory, AttemptDetail, dateLabel, DrillHistory, durationLabel |
| src/features/visuals/DraggableEqualGroups.tsx | 230 | Reusable SVG visual model components (area grids, shape diagrams, fraction bars, arrays). | DraggableObject, DropZone, DraggableEqualGroups, checkEqualGroups, DraggableEqualGroups, DraggableObject, DropZone, handleDragEnd |
| src/features/stats/TodayAchievementDetail.tsx | 181 | Progress/statistics screens or calculations. | QuestionRow, TodayAchievementDetail, fmtSec, normalizeGroup, QuestionRow, TodayAchievementDetail |
| src/features/stats/GrowthView.tsx | 179 | Progress/statistics screens or calculations. | Counter, FactChip, GrowthGroup, GrowthView, chipTitle, Counter, FactChip, GrowthGroup |
| src/features/visuals/ShapeModel.tsx | 137 | Reusable SVG visual model components (area grids, shape diagrams, fraction bars, arrays). | SVGWrap, ShapeModel, ShapeName, pts, regularPoly, rightAnglePath, ShapeModel, SVGWrap |
| src/features/stats/QuizStatsView.tsx | 135 | Progress/statistics screens or calculations. | FactGroup, QuizStatsView, avgSecStr, FactGroup, fmt, QuizStatsView |
| src/features/stats/TodayAchievementSection.tsx | 125 | Progress/statistics screens or calculations. | AchievementTile, TodayAchievementSection, AchievementTile, TodayAchievementSection |
| src/features/mastery/skillPracticePlanner.ts | 702 | Grade 3 skill practice planner: maps skill IDs to SessionConfig for the mastery map. | PlanOptions, planPracticeForSkill, add2DigitRegroupingItemIds, add3DigitRegroupingItemIds, arithmeticPatternItemIds, divisionWordItemIds, divItemIds, elapsedTimeItemIds |
| src/features/diagnosis/DiagnosticSession.tsx | 558 | Exports reusable code: DiagnosticSession. | DiagnosticSession, complete, DiagnosticSession, onKey |
| src/features/practice/usePracticeSession.ts | 552 | Local persistence/database layer. | usePracticeSession, CorrectResult, LastSessionSummary, SessionState, usePracticeSession, getStaticItem, usePracticeSession |
| src/features/goals/goalEngine.ts | 524 | Exports reusable code: applyGoalTargetEdits, buildGoalSkillTarget, calculateGoalProgress, calculateTargetProgress, captureGoalBaseline. | applyGoalTargetEdits, buildGoalSkillTarget, calculateGoalProgress, calculateTargetProgress, captureGoalBaseline, defaultSkillIdForItem, evaluateGoalLifecycle, GoalEvidenceInput |
| src/features/stats/statsEngine.ts | 395 | Progress/statistics screens or calculations. | addDays, computeDailyHistory, computeDayStats, computeFactGrowth, computePeriodComparison, computePeriodStats, computePerTableStats, computeStreak |
| src/features/practice/hintEngine.ts | 373 | Practice session UI and/or quiz interaction logic. | getHint, HintResult, addHint, areaRectHint, areaSquaresHint, divHint, fracCmpHint, fracEquivHint |
| src/features/curriculum/areaItems.ts | 303 | Practice item definitions and ID generators for a math curriculum topic. | areaPerimCmpId, areaPerimCompareItemIds, AreaPerimVariant, areaRectangleItemIds, areaRectId, areaSquaresId, areaSquaresItemIds, makeAreaPerimCompareItem |
| src/features/mastery/SkillDetailPanel.tsx | 291 | Grade 3 mastery map UI: skill display, detail panels, and parent action cards. | SkillDetailPanel, formatPattern, SkillDetailPanel |

## Repository tree, filtered

```text
â”œâ”€â”€ docs
â”‚   â”œâ”€â”€ arch
â”‚   â”‚   â”œâ”€â”€ data.html
â”‚   â”‚   â”œâ”€â”€ decisions.html
â”‚   â”‚   â”œâ”€â”€ features.html
â”‚   â”‚   â””â”€â”€ index.html
â”‚   â”œâ”€â”€ CLOUD_DEVELOPMENT.md
â”‚   â”œâ”€â”€ grade3-mastery-map-roadmap.md
â”‚   â””â”€â”€ PRD.md
â”œâ”€â”€ scripts
â”‚   â”œâ”€â”€ build-icons.py
â”‚   â”œâ”€â”€ bump-version.mjs
â”‚   â”œâ”€â”€ bump_version.py
â”‚   â”œâ”€â”€ generate_code_map.py
â”‚   â”œâ”€â”€ serve-https.py
â”‚   â”œâ”€â”€ smoke-google-auth.py
â”‚   â”œâ”€â”€ smoke-https-headers.py
â”‚   â”œâ”€â”€ smoke-template.py
â”‚   â””â”€â”€ smoke-update-flow.py
â”œâ”€â”€ src
â”‚   â”œâ”€â”€ components
â”‚   â”‚   â”œâ”€â”€ MasteryGrid.tsx
â”‚   â”‚   â”œâ”€â”€ MiniCalendar.tsx
â”‚   â”‚   â”œâ”€â”€ NumPad.tsx
â”‚   â”‚   â”œâ”€â”€ opSpecs.ts
â”‚   â”‚   â”œâ”€â”€ RangeSetup.tsx
â”‚   â”‚   â”œâ”€â”€ SessionSetup.tsx
â”‚   â”‚   â”œâ”€â”€ SessionSummary.tsx
â”‚   â”‚   â”œâ”€â”€ SettingsOverlay.tsx
â”‚   â”‚   â””â”€â”€ StatsGraph.tsx
â”‚   â”œâ”€â”€ db
â”‚   â”‚   â”œâ”€â”€ dexie.ts
â”‚   â”‚   â””â”€â”€ repositories.ts
â”‚   â”œâ”€â”€ features
â”‚   â”‚   â”œâ”€â”€ adaptive
â”‚   â”‚   â”‚   â”œâ”€â”€ adaptiveItemSelector.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ candidatePools.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ relatedEvidence.ts
â”‚   â”‚   â”‚   â””â”€â”€ relatedItemMapping.ts
â”‚   â”‚   â”œâ”€â”€ ai
â”‚   â”‚   â”‚   â”œâ”€â”€ aiConfig.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ gemini.ts
â”‚   â”‚   â”‚   â””â”€â”€ TutorChat.tsx
â”‚   â”‚   â”œâ”€â”€ audio
â”‚   â”‚   â”‚   â”œâ”€â”€ mathSpeech.ts
â”‚   â”‚   â”‚   â””â”€â”€ speech.ts
â”‚   â”‚   â”œâ”€â”€ auth
â”‚   â”‚   â”‚   â””â”€â”€ googleAuth.ts
â”‚   â”‚   â”œâ”€â”€ curriculum
â”‚   â”‚   â”‚   â”œâ”€â”€ areaItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ arithmeticItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ decimalItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ describeItem.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ fractionItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ geometryItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ makeItemFromId.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ measurementItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ mulPropertiesItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ multiplicationItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ numberTheoryItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ patternItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ roundingItems.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ twoStepItems.ts
â”‚   â”‚   â”‚   â””â”€â”€ wordProblemItems.ts
â”‚   â”‚   â”œâ”€â”€ dashboard
â”‚   â”‚   â”‚   â”œâ”€â”€ ProfileSetup.tsx
â”‚   â”‚   â”‚   â””â”€â”€ StudentDashboard.tsx
â”‚   â”‚   â”œâ”€â”€ diagnosis
â”‚   â”‚   â”‚   â”œâ”€â”€ diagnosticCompletion.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ diagnosticPersistence.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ diagnosticPlanner.ts
â”‚   â”‚   â”‚   â””â”€â”€ DiagnosticSession.tsx
â”‚   â”‚   â”œâ”€â”€ goals
â”‚   â”‚   â”‚   â”œâ”€â”€ goalEngine.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ goalLifecycleService.ts
â”‚   â”‚   â”‚   â””â”€â”€ types.ts
â”‚   â”‚   â”œâ”€â”€ learning
â”‚   â”‚   â”‚   â”œâ”€â”€ eventRebuild.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ learningEvents.ts
â”‚   â”‚   â”‚   â””â”€â”€ recordAnswer.ts
â”‚   â”‚   â”œâ”€â”€ mastery
â”‚   â”‚   â”‚   â”œâ”€â”€ grade3MasteryMap.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ Grade3MasteryMapPage.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ misconceptionEngine.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ ParentNextActionCard.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ SkillDetailPanel.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ skillMapping.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ skillMasteryEngine.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ skillPracticePlanner.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ SkillTile.tsx
â”‚   â”‚   â”‚   â””â”€â”€ todayPlanEngine.ts
â”‚   â”‚   â”œâ”€â”€ multiplication
â”‚   â”‚   â”‚   â”œâ”€â”€ masteryEngine.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ multiplicationFacts.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ MultiplicationMasteryGrid.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ MultiplicationQuizPage.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ practiceRecommendation.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ quizQuestionSelector.ts
â”‚   â”‚   â”‚   â””â”€â”€ types.ts
â”‚   â”‚   â”œâ”€â”€ practice
â”‚   â”‚   â”‚   â”œâ”€â”€ answerChecker.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ hintEngine.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ metrics.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ practiceNavigation.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ PracticeScreen.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ QuestionRenderer.tsx
â”‚   â”‚   â”‚   â””â”€â”€ usePracticeSession.ts
â”‚   â”‚   â”œâ”€â”€ scheduler
â”‚   â”‚   â”‚   â”œâ”€â”€ fsrsAdapter.ts
â”‚   â”‚   â”‚   â””â”€â”€ scheduler.ts
â”‚   â”‚   â”œâ”€â”€ settings
â”‚   â”‚   â”‚   â”œâ”€â”€ SettingsPage.tsx
â”‚   â”‚   â”‚   â””â”€â”€ updateCheck.ts
â”‚   â”‚   â”œâ”€â”€ stats
â”‚   â”‚   â”‚   â”œâ”€â”€ DrillHistory.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ FactStatsTable.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ GrowthView.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ QuizStatsView.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ statsEngine.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ StatsPage.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ todayAchievement.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ TodayAchievementDetail.tsx
â”‚   â”‚   â”‚   â””â”€â”€ TodayAchievementSection.tsx
â”‚   â”‚   â”œâ”€â”€ sync
â”‚   â”‚   â”‚   â”œâ”€â”€ driveSync.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ snapshot.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ SyncWidget.tsx
â”‚   â”‚   â”‚   â””â”€â”€ useSync.ts
â”‚   â”‚   â”œâ”€â”€ theme
â”‚   â”‚   â”‚   â””â”€â”€ themes.ts
â”‚   â”‚   â”œâ”€â”€ time
â”‚   â”‚   â”‚   â””â”€â”€ clock.ts
â”‚   â”‚   â””â”€â”€ visuals
â”‚   â”‚       â”œâ”€â”€ AreaGrid.tsx
â”‚   â”‚       â”œâ”€â”€ ArrayModel.tsx
â”‚   â”‚       â”œâ”€â”€ ClockModel.tsx
â”‚   â”‚       â”œâ”€â”€ DraggableEqualGroups.tsx
â”‚   â”‚       â”œâ”€â”€ EqualGroupsModel.tsx
â”‚   â”‚       â”œâ”€â”€ equalGroupsUtils.ts
â”‚   â”‚       â”œâ”€â”€ FractionBar.tsx
â”‚   â”‚       â”œâ”€â”€ FractionNumberLine.tsx
â”‚   â”‚       â”œâ”€â”€ FractionText.tsx
â”‚   â”‚       â”œâ”€â”€ MathPrompt.tsx
â”‚   â”‚       â”œâ”€â”€ RectilinearAreaModel.tsx
â”‚   â”‚       â”œâ”€â”€ ShapeModel.tsx
â”‚   â”‚       â”œâ”€â”€ VisualModel.tsx
â”‚   â”‚       â””â”€â”€ visualModelUtils.ts
â”‚   â”œâ”€â”€ tests
â”‚   â”‚   â”œâ”€â”€ adaptiveRelatedItemSelection.test.ts
â”‚   â”‚   â”œâ”€â”€ ai.test.ts
â”‚   â”‚   â”œâ”€â”€ answerChecker.test.ts
â”‚   â”‚   â”œâ”€â”€ appDiagnosticCompletion.test.ts
â”‚   â”‚   â”œâ”€â”€ arithmeticItems.test.ts
â”‚   â”‚   â”œâ”€â”€ clock.test.ts
â”‚   â”‚   â”œâ”€â”€ components.test.tsx
â”‚   â”‚   â”œâ”€â”€ describeItem.test.ts
â”‚   â”‚   â”œâ”€â”€ diagnosticPlanner.test.ts
â”‚   â”‚   â”œâ”€â”€ diagnosticSession.test.tsx
â”‚   â”‚   â”œâ”€â”€ eventRebuild.test.ts
â”‚   â”‚   â”œâ”€â”€ fractionItems.test.ts
â”‚   â”‚   â”œâ”€â”€ goalDexieSchema.test.ts
â”‚   â”‚   â”œâ”€â”€ goalEngine.test.ts
â”‚   â”‚   â”œâ”€â”€ goalRepositories.test.ts
â”‚   â”‚   â”œâ”€â”€ goalSnapshot.test.ts
â”‚   â”‚   â”œâ”€â”€ grade3AddSubRegrouping.test.ts
â”‚   â”‚   â”œâ”€â”€ grade3AreaPerimeter.test.ts
â”‚   â”‚   â”œâ”€â”€ grade3MasteryMap.test.ts
â”‚   â”‚   â”œâ”€â”€ grade3MasteryMapRegression.test.ts
â”‚   â”‚   â”œâ”€â”€ grade3MulProperties.test.ts
â”‚   â”‚   â”œâ”€â”€ grade3NewSkills.test.ts
â”‚   â”‚   â”œâ”€â”€ grade3TwoStepAndPatterns.test.ts
â”‚   â”‚   â”œâ”€â”€ growth.test.ts
â”‚   â”‚   â”œâ”€â”€ hintEngine.test.ts
â”‚   â”‚   â”œâ”€â”€ learningEvents.test.ts
â”‚   â”‚   â”œâ”€â”€ makeItemFromId.test.ts
â”‚   â”‚   â”œâ”€â”€ mathPrompt.test.tsx
â”‚   â”‚   â”œâ”€â”€ misconceptionEngine.test.ts
â”‚   â”‚   â”œâ”€â”€ multiplicationQuiz.test.ts
â”‚   â”‚   â”œâ”€â”€ newCurriculum.test.ts
â”‚   â”‚   â”œâ”€â”€ practiceMetrics.test.ts
â”‚   â”‚   â”œâ”€â”€ practiceNavigation.test.ts
â”‚   â”‚   â”œâ”€â”€ practiceSession.test.ts
â”‚   â”‚   â”œâ”€â”€ questionGenerator.test.ts
â”‚   â”‚   â”œâ”€â”€ quizAutoAdvance.test.tsx
â”‚   â”‚   â”œâ”€â”€ rangeSelection.test.ts
â”‚   â”‚   â”œâ”€â”€ relatedEvidence.test.ts
â”‚   â”‚   â”œâ”€â”€ rng.test.ts
â”‚   â”‚   â”œâ”€â”€ scheduler.test.ts
â”‚   â”‚   â”œâ”€â”€ setup.ts
â”‚   â”‚   â”œâ”€â”€ skillMapping.test.ts
â”‚   â”‚   â”œâ”€â”€ skillMasteryEngine.test.ts
â”‚   â”‚   â”œâ”€â”€ skillPracticePlanner.test.ts
â”‚   â”‚   â”œâ”€â”€ snapshotValidation.test.ts
â”‚   â”‚   â”œâ”€â”€ speech.test.ts
â”‚   â”‚   â”œâ”€â”€ statsEngine.test.ts
â”‚   â”‚   â”œâ”€â”€ todayAchievement.test.ts
â”‚   â”‚   â”œâ”€â”€ todayPlanEngine.test.ts
â”‚   â”‚   â”œâ”€â”€ updateCheck.test.ts
â”‚   â”‚   â””â”€â”€ visualModel.test.ts
â”‚   â”œâ”€â”€ types
â”‚   â”‚   â”œâ”€â”€ google.d.ts
â”‚   â”‚   â””â”€â”€ math.ts
â”‚   â”œâ”€â”€ utils
â”‚   â”‚   â”œâ”€â”€ id.ts
â”‚   â”‚   â”œâ”€â”€ masteryColors.ts
â”‚   â”‚   â””â”€â”€ rng.ts
â”‚   â”œâ”€â”€ App.tsx
â”‚   â”œâ”€â”€ env.d.ts
â”‚   â”œâ”€â”€ index.css
â”‚   â””â”€â”€ main.tsx
â”œâ”€â”€ tools
â”‚   â””â”€â”€ generate_code_maps.py
â”œâ”€â”€ AGENTS.md
â”œâ”€â”€ CLAUDE.md
â”œâ”€â”€ eslint.config.js
â”œâ”€â”€ index.html
â”œâ”€â”€ mathladder_prd_and_implementation_guide.md
â”œâ”€â”€ package.json
â”œâ”€â”€ README.md
â”œâ”€â”€ tsconfig.app.json
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ tsconfig.node.json
â”œâ”€â”€ vite.config.ts
â””â”€â”€ vitest.config.ts
```

## Important-file snippets

These snippets are intentionally short. They help Claude know where to look without reading every file.

### `src/App.tsx`

Purpose: Top-level React app shell: routes/screens, global state, and feature wiring.

```text
   1: import { useEffect, useRef, useState } from 'react';
   2: import type { StudentProfile, SessionConfig, StudentSettings } from './types/math';
   3: import { studentRepo, sessionRepo, mathAnswerEventRepo } from './db/repositories';
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
  17: import { preloadVoices } from './features/audio/speech';
  18: import { useSync, initAuth } from './features/sync/useSync';
  19: import { pushLocal } from './features/sync/driveSync';
  20: import { currentState as authState } from './features/auth/googleAuth';
  21: import { applyTheme } from './features/theme/themes';
  22: import { syncDiagnosticCompletionIfSignedIn } from './features/diagnosis/diagnosticCompletion';
  23: import { resolvePracticeDoneDestination } from './features/practice/practiceNavigation';
  24:
  25: type Screen =
  26:   | 'loading' | 'setup' | 'dashboard'
  27:   | 'daily-setup' | 'range-setup' | 'practice'
  28:   | 'stats' | 'settings' | 'quiz' | 'today-detail' | 'mastery-map' | 'diagnostic';
  29:
  30: export default function App() {
  31:   const [screen, setScreen] = useState<Screen>('loading');
  32:   const [profile, setProfile] = useState<StudentProfile | null>(null);
  33:   const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  34:   const [selectedOp, setSelectedOp] = useState<PracticeOp>('multiplication');
  35:   const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('total');
  36:   const [achievementData, setAchievementData] = useState<TodayAchievementData | null>(null);
  37:   const { auth, syncStatus, lastSyncedAt, syncError, handleSignIn, handleSignOut, manualSync } = useSync();
  38:   const [practiceReturn, setPracticeReturn] = useState<Screen>('dashboard');
  39:
  40:   // After a successful sync, refresh the profile from DB.
  41:   // This handles the case where Drive data was merged back onto a fresh install:
  42:   // the local empty student and the Drive student have different IDs, so we pick
  43:   // the student with the most events (i.e. the restored Drive profile).
  44:   const syncRefreshGuard = useRef(true);
  45:   useEffect(() => {
  46:     if (syncRefreshGuard.current) { syncRefreshGuard.current = false; return; }
  47:     if (!lastSyncedAt) return;
  48:     studentRepo.getAll().then(async all => {
  49:       if (all.length === 0) return;
  50:       let best = all[0];
  51:       if (all.length > 1) {
  52:         const counts = await Promise.all(all.map(s => mathAnswerEventRepo.getAll(s.id).then(ev => ev.length)));
  53:         best = all[counts.indexOf(Math.max(...counts))];
  54:       }
  55:       setProfile(best);
  56:       applyTheme(best.settings.theme ?? 'indigo');
  57:       setScreen(s => (s === 'setup' || s === 'loading') ? 'dashboard' : s);
  58:     });
  59:   // eslint-disable-next-line react-hooks/exhaustive-deps
  60:   }, [lastSyncedAt]);
... (219 more lines)
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
  19:   // â”€â”€ Not configured â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  20:   if (!HAS_GOOGLE_CONFIG) {
  21:     return (
  22:       <div style={{ ...s.box, borderColor: '#fcd34d', background: '#fffbeb' }}>
  23:         <p style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', margin: '0 0 4px' }}>
  24:           âš  Google sync not configured
  25:         </p>
  26:         <p style={{ fontSize: '12px', color: '#78350f', margin: 0, lineHeight: 1.5 }}>
  27:           Create a <code style={s.code}>.env</code> file in the project root with{' '}
  28:           <code style={s.code}>VITE_GOOGLE_CLIENT_ID=â€¦</code>, then restart the dev server.
  29:         </p>
  30:       </div>
  31:     );
  32:   }
  33:
  34:   // â”€â”€ Signed out â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  49:               <span style={s.spinner}>â³</span>
  50:             ) : (
  51:               <GoogleIcon />
  52:             )}
  53:             {isSyncing ? 'Signing inâ€¦' : 'Sign in'}
  54:           </button>
  55:         </div>
  56:
  57:         {/* Show errors even before sign-in completes */}
  58:         {syncStatus === 'error' && syncError && (
  59:           <p style={s.errorMsg}>âš  {friendlyError(syncError)}</p>
  60:         )}
... (95 more lines)
```

### `src/features/sync/snapshot.ts`

Purpose: Local persistence/database layer.

```text
   1: import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../../types/math';
   2: import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
   3: import type { MathAnswerEvent } from '../learning/learningEvents';
   4: import { rebuildMultFactStatsFromEvents, rebuildItemStatesFromEvents } from '../learning/eventRebuild';
   5: import { db } from '../../db/dexie';
   6: import type { GoalEvaluation, GoalEvent, LearningGoal } from '../goals/types';
   7:
   8: export interface AppSnapshot {
   9:   appId: 'mathfan';
  10:   snapshotVersion: 1 | 2;
  11:   snapshotAt: string;
  12:   students: StudentProfile[];
  13:   itemStates: StudentItemState[];
  14:   attempts: AttemptLog[];
  15:   sessions: PracticeSession[];
  16:   // Added in quiz feature â€” absent in older snapshots; treat missing as []
  17:   multFactStats?: MultiplicationFactStats[];
  18:   quizSessions?: QuizSession[];
  19:   // Added with canonical event log â€” absent in older snapshots; treat missing as []
  20:   mathAnswerEvents?: MathAnswerEvent[];
  21:   learningGoals?: LearningGoal[];
  22:   goalEvents?: GoalEvent[];
  23:   goalEvaluations?: GoalEvaluation[];
  24: }
  25:
  26: // â”€â”€ Build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  27:
  28: export async function buildSnapshot(): Promise<AppSnapshot> {
  29:   const [
  30:     students,
  31:     itemStates,
  32:     attempts,
  33:     sessions,
  34:     multFactStats,
  35:     quizSessions,
  36:     mathAnswerEvents,
  37:     learningGoals,
  38:     goalEvents,
  39:     goalEvaluations,
  40:   ] = await Promise.all([
  41:     db.students.toArray(),
  42:     db.itemStates.toArray(),
  43:     db.attempts.toArray(),
  44:     db.sessions.toArray(),
  45:     db.multFactStats.toArray(),
  46:     db.quizSessions.toArray(),
  47:     db.mathAnswerEvents.toArray(),
  48:     db.learningGoals.toArray(),
  49:     db.goalEvents.toArray(),
  50:     db.goalEvaluations.toArray(),
  51:   ]);
  52:   return {
  53:     appId: 'mathfan',
  54:     snapshotVersion: 2,
  55:     snapshotAt: new Date().toISOString(),
  56:     students,
  57:     itemStates,
  58:     attempts,
  59:     sessions,
  60:     multFactStats,
... (149 more lines)
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
  21: // service worker never serves a stale copy â€” the fetch always hits the network.
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
  59:         description: 'Adaptive math practice for grades 3â€“5',
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
  14:     "ci": "npm run lint && npm test && npm run build"
  15:   },
  16:   "dependencies": {
  17:     "@dnd-kit/core": "^6.3.1",
  18:     "@dnd-kit/sortable": "^10.0.0",
  19:     "dexie": "^4.4.3",
  20:     "fraction.js": "^5.3.4",
  21:     "mafs": "^0.21.0",
  22:     "react": "^19.2.6",
  23:     "react-dom": "^19.2.6",
  24:     "react-router-dom": "^7.16.0",
  25:     "ts-fsrs": "^5.4.1"
  26:   },
  27:   "devDependencies": {
  28:     "@eslint/js": "^10.0.1",
  29:     "@testing-library/jest-dom": "^6.9.1",
  30:     "@testing-library/react": "^16.3.2",
  31:     "@types/node": "^24.12.3",
  32:     "@types/react": "^19.2.14",
  33:     "@types/react-dom": "^19.2.3",
  34:     "@vitejs/plugin-react": "^6.0.1",
  35:     "@vitest/coverage-v8": "^4.1.7",
  36:     "eslint": "^10.3.0",
  37:     "eslint-plugin-react-hooks": "^7.1.1",
  38:     "eslint-plugin-react-refresh": "^0.5.2",
  39:     "globals": "^17.6.0",
  40:     "jsdom": "^29.1.1",
  41:     "typescript": "~6.0.2",
  42:     "typescript-eslint": "^8.59.2",
  43:     "vite": "^8.0.12",
  44:     "vite-plugin-pwa": "^1.3.0",
  45:     "vitest": "^4.1.7"
  46:   }
  47: }
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
   1: import type { AppSnapshot } from './snapshot';
   2: import { buildSnapshot, mergeSnapshot, validateSnapshot } from './snapshot';
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
  18: async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  19:   const token = await getToken();
  20:   if (!token) throw new Error('Not signed in');
  21:   return fetch(url, {
  22:     ...options,
  23:     headers: {
  24:       Authorization: `Bearer ${token}`,
  25:       ...(options.headers as Record<string, string> ?? {}),
  26:     },
  27:   });
  28: }
  29:
  30: async function findSyncFile(): Promise<string | null> {
  31:   const res = await authFetch(LIST_URL);
  32:   if (!res.ok) return null;
  33:   const data = await res.json();
  34:   return (data.files as { id: string }[])?.[0]?.id ?? null;
  35: }
  36:
  37: async function uploadSnapshot(snapshot: AppSnapshot, existingId?: string): Promise<void> {
  38:   const body = JSON.stringify(snapshot);
  39:
  40:   if (existingId) {
  41:     // Update existing file (media-only PATCH)
  42:     const res = await authFetch(
  43:       `${UPLOAD_URL}/${existingId}?uploadType=media`,
  44:       { method: 'PATCH', body, headers: { 'Content-Type': 'application/json' } }
  45:     );
  46:     if (!res.ok) throw new Error(`Drive PATCH failed: ${res.status}`);
  47:   } else {
  48:     // Create new file in appDataFolder (multipart POST)
  49:     const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
  50:     const boundary = 'mathfan_boundary';
  51:     const multipart = [
  52:       `--${boundary}`,
  53:       'Content-Type: application/json; charset=UTF-8',
  54:       '',
  55:       metadata,
  56:       `--${boundary}`,
  57:       'Content-Type: application/json',
  58:       '',
  59:       body,
  60:       `--${boundary}--`,
... (90 more lines)
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

### `src/features/multiplication/MultiplicationQuizPage.tsx`

Purpose: Local persistence/database layer.

```text
   1: import { useEffect, useRef, useState, useCallback } from 'react';
   2: import type {
   3:   MultiplicationFactStats,
   4:   MultiplicationFactKey,
   5:   QuizAnswerLog,
   6:   QuizSession,
   7:   QuizQuestion,
   8: } from './types';
   9: import type { SessionConfig, StudentSettings } from '../../types/math';
  10: import { speakProblem, speakFeedback, stopSpeech } from '../audio/speech';
  11: import { parseFactKey, createInitialFactStats } from './multiplicationFacts';
  12: import { MultiplicationMasteryGrid } from './MultiplicationMasteryGrid';
  13: import { applyAnswerToStats, SLOW_MS } from './masteryEngine';
  14: import { selectQuizQuestions } from './quizQuestionSelector';
  15: import { generateRecommendations } from './practiceRecommendation';
  16: import { db } from '../../db/dexie';
  17: import { generateId } from '../../utils/id';
  18: import { recordQuizFirstAttempt, recordQuizRetry, finalizeQuizSession } from '../learning/recordAnswer';
  19: import { appNow } from '../time/clock';
  20:
  21: interface Props {
  22:   studentId: string;
  23:   settings: StudentSettings;
  24:   onDone: () => void;
  25:   onStartPractice?: (config: SessionConfig) => void;
  26: }
  27:
  28: type Phase = 'setup' | 'loading' | 'active' | 'feedback' | 'retry' | 'saving' | 'summary';
  29:
  30: const QUIZ_LENGTHS = [10, 20, 30, 50];
  31: const DEFAULT_LENGTH = 20;
  32: const FEEDBACK_PAUSE_MS = 600; // visual pause after the answer speech finishes
  33:
  34:
  35: // â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  36:
  37: function FactChip({ label, bg, text }: { label: string; bg: string; text: string }) {
  38:   return (
  39:     <span style={{ background: bg, color: text, borderRadius: '8px', padding: '4px 10px', fontSize: '14px', fontWeight: '600', display: 'inline-block', margin: '3px' }}>
  40:       {label}
  41:     </span>
  42:   );
  43: }
  44:
  45: function StatBox({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  46:   return (
  47:     <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px', textAlign: 'center', flex: 1 }}>
  48:       <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>{value}</div>
  49:       <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{label}</div>
  50:     </div>
  51:   );
  52: }
  53:
  54: // â”€â”€ Setup screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  55:
  56: function SetupScreen({
  57:   quizLength, onSelectLength, onStart, onBack,
  58: }: {
  59:   quizLength: number;
  60:   onSelectLength: (n: number) => void;
... (784 more lines)
```

### `src/features/practice/PracticeScreen.tsx`

Purpose: Local persistence/database layer.

```text
   1: import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
   2: import type { CSSProperties } from 'react';
   3: import type { SessionConfig, StudentSettings } from '../../types/math';
   4: import { db } from '../../db/dexie';
   5: import { usePracticeSession } from './usePracticeSession';
   6: import { NumPad } from '../../components/NumPad';
   7: import { SessionSummary } from '../../components/SessionSummary';
   8: import { SettingsOverlay } from '../../components/SettingsOverlay';
   9: import { TutorChat } from '../ai/TutorChat';
  10: import { speakProblem, speakFeedback, stopSpeech } from '../audio/speech';
  11: import { VisualModel } from '../visuals/VisualModel';
  12: import { MathPrompt } from '../visuals/MathPrompt';
  13: import { hasVisualModel } from '../visuals/visualModelUtils';
  14: import { getHint } from './hintEngine';
  15:
  16: const AUTO_ADVANCE_MS = 700;     // visual-only pause when audio is off
  17: const POST_SPEECH_PAUSE_MS = 200; // short pause after answer speech finishes
  18:
  19: interface Props {
  20:   studentId: string;
  21:   config: SessionConfig;
  22:   settings: StudentSettings;
  23:   onUpdateSettings: (s: StudentSettings) => void;
  24:   onDone: () => void;
  25:   onOpenSettings?: () => void;
  26:   onPlayAgain?: () => void;
  27:   onBack?: () => void;
  28: }
  29:
  30: export function PracticeScreen({
  31:   studentId, config, settings, onUpdateSettings, onDone, onOpenSettings, onPlayAgain, onBack,
  32: }: Props) {
  33:   const { state, startSession, submitAnswer, nextQuestion } = usePracticeSession(studentId);
  34:   const [input, setInput] = useState('');
  35:   const [showSettings, setShowSettings] = useState(false);
  36:   const [showTutor, setShowTutor] = useState(false);
  37:   const [showQuit, setShowQuit] = useState(false);
  38:   const [quitting, setQuitting] = useState(false); // show summary with partial data
  39:   const [showExplanation, setShowExplanation] = useState(false);
  40:   const inputRef = useRef<HTMLInputElement>(null);
  41:   const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  42:   // Always-current shadow of `input` state â€” kept in sync via useLayoutEffect
  43:   // (runs synchronously after every commit) so the keyboard handler registered
  44:   // via useEffect (a macro-task) never reads a stale partial value when the
  45:   // user types the last digit and immediately presses Enter in the same frame.
  46:   const inputLatestRef = useRef<string>('');
  47:   useLayoutEffect(() => { inputLatestRef.current = input; });
  48:
  49:   // â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  50:
  51:   useEffect(() => {
  52:     startSession(config);
  53:     return () => {
  54:       stopSpeech();
  55:       if (autoTimer.current) clearTimeout(autoTimer.current);
  56:     };
  57:   // eslint-disable-next-line react-hooks/exhaustive-deps
  58:   }, []);
  59:
  60:   // â”€â”€ Focus helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
... (491 more lines)
```

### `src/features/settings/SettingsPage.tsx`

Purpose: Student/app settings UI or persistence.

```text
   1: import { useState, useEffect } from 'react';
   2: import type { StudentProfile, StudentSettings, GradeLevel, SessionLength, ThemeName } from '../../types/math';
   3: import { THEMES, applyTheme } from '../theme/themes';
   4: import { getDriveFileInfo } from '../sync/driveSync';
   5: import type { SyncStatus } from '../sync/driveSync';
   6: import type { AuthState } from '../auth/googleAuth';
   7: import { attemptRepo } from '../../db/repositories';
   8: import { studentRepo } from '../../db/repositories';
   9: import { isDebugSpeed, enableDebugSpeed, disableDebugSpeed } from '../time/clock';
  10: import { getAiConfig, setAiKey, setAiModel, clearAiKey, DEFAULT_MODEL } from '../ai/aiConfig';
  11: import { askTutor, explainAiError, aiErrorDetail } from '../ai/gemini';
  12: import { checkForUpdate, type BuildInfo } from './updateCheck';
  13:
  14: interface Props {
  15:   profile: StudentProfile;
  16:   onUpdateProfile: (p: StudentProfile) => void;
  17:   onBack: () => void;
  18:   onSwitchStudent: () => void;
  19:   auth: AuthState;
  20:   syncStatus: SyncStatus;
  21:   lastSyncedAt: string | null;
  22:   syncError: string | null;
  23:   onSignIn: () => void;
  24:   onSignOut: () => void;
  25:   onManualSync: () => void;
  26: }
  27:
  28: /** Known Gemini models with a free tier. Each has its own daily quota. */
  29: const AI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  30:
  31: function Section({ title, children }: { title: string; children: React.ReactNode }) {
  32:   return (
  33:     <div style={s.section}>
  34:       <h3 style={s.sectionTitle}>{title}</h3>
  35:       <div style={s.sectionBody}>{children}</div>
  36:     </div>
  37:   );
  38: }
  39:
  40: function ToggleRow({ label, desc, checked, onChange }: {
  41:   label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
  42: }) {
  43:   return (
  44:     <label style={s.row}>
  45:       <div>
  46:         <p style={s.rowLabel}>{label}</p>
  47:         {desc && <p style={s.rowDesc}>{desc}</p>}
  48:       </div>
  49:       <button
  50:         role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
  51:         style={{ ...s.toggle, background: checked ? 'var(--primary)' : '#d1d5db' }}
  52:       >
  53:         <span style={{ ...s.knob, transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} />
  54:       </button>
  55:     </label>
  56:   );
  57: }
  58:
  59: export function SettingsPage({ profile, onUpdateProfile, onBack, onSwitchStudent, auth, syncStatus, lastSyncedAt, syncError, onSignIn, onSignOut, onManualSync }: Props) {
  60:   const settings = profile.settings;
... (455 more lines)
```

### `src/features/stats/FactStatsTable.tsx`

Purpose: Local persistence/database layer.

```text
   1: import { useEffect, useState, useMemo } from 'react';
   2: import type { StudentItemState, SessionConfig } from '../../types/math';
   3: import type { MathFactStatus } from '../learning/learningEvents';
   4: import { itemStateRepo } from '../../db/repositories';
   5: import { db } from '../../db/dexie';
   6: import { TABLE_MIN, TABLE_MAX, tableFromItemId } from '../curriculum/multiplicationItems';
   7: import { describeItem } from '../curriculum/describeItem';
   8: import { FACT_STATUS_COLORS } from '../../utils/masteryColors';
   9:
  10: interface Props {
  11:   studentId: string;
  12:   onStartPractice?: (config: SessionConfig) => void;
  13: }
  14:
  15: type SortKey = 'accuracy' | 'wrong' | 'attempts' | 'avgSpeed' | 'bestSpeed';
  16: type TypeFilter = 'all' | 'mul' | 'div' | 'add' | 'sub' | 'frac' | 'word' | 'round' | 'factors' | 'dec' | 'area' | 'geometry' | 'measurement' | 'data' | 'pattern';
  17:
  18: const ALL_FACT_STATUSES: MathFactStatus[] = ['new', 'forgotten', 'weak', 'learning', 'developing', 'strong', 'mastered'];
  19:
  20: const OPERATION_TABS: { key: TypeFilter; label: string; icon: string }[] = [
  21:   { key: 'all',         label: 'All',        icon: 'âˆ‘' },
  22:   { key: 'mul',         label: 'Multiply',   icon: 'âœ–ï¸' },
  23:   { key: 'div',         label: 'Divide',     icon: 'âž—' },
  24:   { key: 'add',         label: 'Add',        icon: 'âž•' },
  25:   { key: 'sub',         label: 'Subtract',   icon: 'âž–' },
  26:   { key: 'frac',        label: 'Fractions',  icon: 'ðŸ•' },
  27:   { key: 'word',        label: 'Word',       icon: 'ðŸ“–' },
  28:   { key: 'round',       label: 'Rounding',   icon: 'ðŸ”µ' },
  29:   { key: 'factors',     label: 'Primes',     icon: 'ðŸ”¢' },
  30:   { key: 'dec',         label: 'Decimals',   icon: 'ðŸ”Ÿ' },
  31:   { key: 'area',        label: 'Area',       icon: 'ðŸ“' },
  32:   { key: 'geometry',    label: 'Geometry',   icon: 'ðŸ”·' },
  33:   { key: 'measurement', label: 'Measure',    icon: 'â°' },
  34:   { key: 'data',        label: 'Data',       icon: 'ðŸ“Š' },
  35:   { key: 'pattern',     label: 'Patterns',   icon: 'ðŸ”' },
  36: ];
  37:
  38: /** Bucket an itemId's describe-group into a TypeFilter (unknown-factor counts as multiply). */
  39: function bucketOf(itemId: string): Exclude<TypeFilter, 'all'> | 'other' {
  40:   const g = describeItem(itemId).group;
  41:   if (g === 'mul' || g === 'unk') return 'mul';
  42:   if (g === 'div') return 'div';
  43:   if (g === 'add') return 'add';
  44:   if (g === 'sub') return 'sub';
  45:   if (g === 'frac') return 'frac';
  46:   if (g === 'word') return 'word';
  47:   if (g === 'round') return 'round';
  48:   if (g === 'factors') return 'factors';
  49:   if (g === 'dec') return 'dec';
  50:   if (g === 'area') return 'area';
  51:   if (g === 'geometry') return 'geometry';
  52:   if (g === 'measurement') return 'measurement';
  53:   if (g === 'data') return 'data';
  54:   if (g === 'pattern') return 'pattern';
  55:   return 'other';
  56: }
  57:
  58: export function FactStatsTable({ studentId, onStartPractice }: Props) {
  59:   const [states, setStates] = useState<StudentItemState[]>([]);
  60:   // Quiz-system status map: itemId â†’ MathFactStatus (covers weak/forgotten from quiz events).
... (341 more lines)
```
