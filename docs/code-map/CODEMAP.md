# Code Map Overview

Generated: 2026-06-01 08:28:55 UTC

Repo root: `C:\Users\colin\Documents\mathFan`  
Output folder: `C:\Users\colin\Documents\mathFan\docs\code-map`

## What this is for

This folder is a compact repo memory for Claude Code / Codex. Start AI coding sessions by asking the model to read `CLAUDE_START_HERE.md`, then `CODEMAP.md`, then `SYMBOLS.md` before scanning source files.

## Project summary

- Package name: `mathfan`
- Version: `1.2.0`
- Module type: `module`
- Scanned files: **95**
- Scanned lines: **14,967**
- Scanned bytes: **560,123**

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
| dexie | ^4.4.3 | runtime |
| react | ^19.2.6 | runtime |
| react-dom | ^19.2.6 | runtime |
| react-router-dom | ^7.16.0 | runtime |
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
| src/App.tsx | 182 | Top-level React app shell: routes/screens, global state, and feature wiring. | App, handleSessionDone, pickOperation, updateProfile, updateSettings |
| src/features/sync/SyncWidget.tsx | 156 | Cloud sync/auth/data transfer logic. | GoogleIcon, SyncWidget, friendlyError, GoogleIcon, initials, SyncWidget, timeSince |
| vite.config.ts | 45 | Vite build/PWA configuration. |  |
| package.json | 43 | Project package metadata, scripts, dependencies, and dev tooling. |  |
| src/main.tsx | 11 | React entry point that mounts the app. |  |
| src/features/sync/driveSync.ts | 151 | Cloud sync/auth/data transfer logic. | DriveFileInfo, SyncResult, SyncStatus, authFetch, downloadSnapshot, findSyncFile, getDriveFileInfo, pullAndMerge |
| src/features/sync/snapshot.ts | 106 | Local persistence/database layer. | AppSnapshot, validateSnapshot, buildSnapshot, mergeSnapshot, validateSnapshot |
| src/features/sync/useSync.ts | 99 | Cloud sync/auth/data transfer logic. | useSync, initAuth, SyncState, useSync, recordSync, useSync |
| src/features/multiplication/MultiplicationQuizPage.tsx | 757 | Local persistence/database layer. | FactChip, SetupScreen, StatBox, SummaryScreen, MultiplicationQuizPage, FactChip, MultiplicationQuizPage, recommendedPracticeConfig |
| src/features/practice/PracticeScreen.tsx | 475 | Local persistence/database layer. | KbChip, PracticeScreen, KbChip, onKey, PracticeScreen, submitChoice |
| src/features/settings/SettingsPage.tsx | 474 | Student/app settings UI or persistence. | Section, SyncRow, ToggleRow, SettingsPage, applyUpdate, checkForUpdates, fmt, fmtBuildTime |
| src/features/stats/FactStatsTable.tsx | 305 | Progress/statistics screens or calculations. | SortBtn, SummaryStat, FactStatsTable, bucketOf, FactStatsTable, SortBtn, SummaryStat, toggleSort |
| src/features/stats/StatsPage.tsx | 243 | Progress/statistics screens or calculations. | SummaryPill, StatsPage, buildRange, daysBetween, StatsPage, SummaryPill, toYMD |
| src/features/stats/DrillHistory.tsx | 235 | Progress/statistics screens or calculations. | AttemptDetail, MetricChip, Pill, DrillHistory, AttemptDetail, dateLabel, DrillHistory, durationLabel |
| src/features/stats/GrowthView.tsx | 178 | Progress/statistics screens or calculations. | Counter, FactChip, GrowthGroup, GrowthView, chipTitle, Counter, FactChip, GrowthGroup |
| src/features/dashboard/StudentDashboard.tsx | 153 | Dashboard/profile setup/student navigation feature. | Chip, PracticeOp, StudentDashboard, Chip, StudentDashboard |
| src/features/stats/QuizStatsView.tsx | 136 | Local persistence/database layer. | FactGroup, QuizStatsView, avgSecStr, FactGroup, fmt, QuizStatsView |
| src/features/practice/usePracticeSession.ts | 372 | Local persistence/database layer. | usePracticeSession, CorrectResult, LastSessionSummary, SessionState, usePracticeSession, getStaticItem, usePracticeSession |
| src/features/stats/statsEngine.ts | 370 | Progress/statistics screens or calculations. | addDays, computeDailyHistory, computeDayStats, computeFactGrowth, computePeriodComparison, computePeriodStats, computePerTableStats, computeStreak |
| src/features/scheduler/scheduler.ts | 264 | Exports reusable code: applyReview, createInitialState, FSRS_W, fsrsInterval, fsrsRetrievability. | applyReview, createInitialState, FSRS_W, fsrsInterval, fsrsRetrievability, planSession, planTableSession, SessionPlan |
| src/features/auth/googleAuth.ts | 240 | Authentication integration. | AuthState, currentState, GoogleProfile, onChange, signOut, clearPersisted, currentState, fetchProfile |
| src/features/curriculum/multiplicationItems.ts | 210 | Exports reusable code: ALL_ITEMS, divId, generateDivisionItems, generateMultipleTablesItems, generateMultiplicationItems. | ALL_ITEMS, divId, generateDivisionItems, generateMultipleTablesItems, generateMultiplicationItems, generateMultiplicationRangeItems, generateSingleTableItems, generateUnknownFactorItems |
| src/types/math.ts | 253 | Exports reusable code: AnswerInput, AttemptLog, DayStats, FactGrowth, FactWindowStats. | AnswerInput, AttemptLog, DayStats, FactGrowth, FactWindowStats, FractionMode, GradeLevel, GrowthDirection |
| src/features/curriculum/arithmeticItems.ts | 176 | Exports reusable code: addId, divIdStd, generateAdditionItems, generateDivisionItemsRange, generateSubtractionItems. | addId, divIdStd, generateAdditionItems, generateDivisionItemsRange, generateSubtractionItems, makeAdditionItem, makeDivisionItem, makeSubtractionItem |
| src/features/dashboard/ProfileSetup.tsx | 147 | Dashboard/profile setup/student navigation feature. | ProfileSetup, handleSubmit, ProfileSetup |
| src/features/ai/gemini.ts | 135 | Exports reusable code: AiError, aiErrorDetail, ChatMessage, explainAiError, ProblemContext. | AiError, aiErrorDetail, ChatMessage, explainAiError, ProblemContext, aiErrorDetail, askTutor, explainAiError |
| src/features/ai/TutorChat.tsx | 128 | Exports reusable code: TutorChat. | TutorChat, onKeyDown, TutorChat |
| src/features/multiplication/quizQuestionSelector.ts | 124 | Exports reusable code: selectQuizQuestions. | selectQuizQuestions, balancedSample, daysSince, isDueForReview, isMaintenance, isStaleOrNew, isWeak, selectQuizQuestions |
| src/features/curriculum/fractionItems.ts | 117 | Exports reusable code: fracCmpId, fracEqId, generateFractionCompareItems, generateFractionEquivalentItems, generateFractionItems. | fracCmpId, fracEqId, generateFractionCompareItems, generateFractionEquivalentItems, generateFractionItems, makeFractionCompareItem, makeFractionEquivalentItem, fracCmpId |
| src/features/time/clock.ts | 92 | Exports reusable code: _resetClock, appNow, appNowMs, DEBUG_SCALE, disableDebugSpeed. | _resetClock, appNow, appNowMs, DEBUG_SCALE, disableDebugSpeed, enableDebugSpeed, getScale, isDebugSpeed |

## Repository tree, filtered

```text
├── docs
│   └── PRD.md
├── scripts
│   ├── build-icons.py
│   ├── bump-version.mjs
│   ├── bump_version.py
│   ├── serve-https.py
│   ├── smoke-google-auth.py
│   ├── smoke-https-headers.py
│   ├── smoke-template.py
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
│   │   ├── ai
│   │   │   ├── aiConfig.ts
│   │   │   ├── gemini.ts
│   │   │   └── TutorChat.tsx
│   │   ├── audio
│   │   │   └── speech.ts
│   │   ├── auth
│   │   │   └── googleAuth.ts
│   │   ├── curriculum
│   │   │   ├── arithmeticItems.ts
│   │   │   ├── decimalItems.ts
│   │   │   ├── describeItem.ts
│   │   │   ├── fractionItems.ts
│   │   │   ├── multiplicationItems.ts
│   │   │   ├── numberTheoryItems.ts
│   │   │   ├── roundingItems.ts
│   │   │   └── wordProblemItems.ts
│   │   ├── dashboard
│   │   │   ├── ProfileSetup.tsx
│   │   │   └── StudentDashboard.tsx
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
│   │   │   ├── metrics.ts
│   │   │   ├── PracticeScreen.tsx
│   │   │   └── usePracticeSession.ts
│   │   ├── scheduler
│   │   │   └── scheduler.ts
│   │   ├── settings
│   │   │   └── SettingsPage.tsx
│   │   ├── stats
│   │   │   ├── DrillHistory.tsx
│   │   │   ├── FactStatsTable.tsx
│   │   │   ├── GrowthView.tsx
│   │   │   ├── QuizStatsView.tsx
│   │   │   ├── statsEngine.ts
│   │   │   └── StatsPage.tsx
│   │   ├── sync
│   │   │   ├── driveSync.ts
│   │   │   ├── snapshot.ts
│   │   │   ├── SyncWidget.tsx
│   │   │   └── useSync.ts
│   │   ├── theme
│   │   │   └── themes.ts
│   │   └── time
│   │       └── clock.ts
│   ├── tests
│   │   ├── ai.test.ts
│   │   ├── answerChecker.test.ts
│   │   ├── arithmeticItems.test.ts
│   │   ├── clock.test.ts
│   │   ├── components.test.tsx
│   │   ├── describeItem.test.ts
│   │   ├── fractionItems.test.ts
│   │   ├── growth.test.ts
│   │   ├── multiplicationQuiz.test.ts
│   │   ├── newCurriculum.test.ts
│   │   ├── practiceMetrics.test.ts
│   │   ├── questionGenerator.test.ts
│   │   ├── rangeSelection.test.ts
│   │   ├── scheduler.test.ts
│   │   ├── setup.ts
│   │   └── statsEngine.test.ts
│   ├── types
│   │   ├── google.d.ts
│   │   └── math.ts
│   ├── utils
│   │   ├── id.ts
│   │   └── masteryColors.ts
│   ├── App.tsx
│   ├── env.d.ts
│   ├── index.css
│   └── main.tsx
├── tools
│   └── generate_code_maps.py
├── eslint.config.js
├── index.html
├── mathladder_prd_and_implementation_guide.md
├── package.json
├── README.md
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
   1: import { useEffect, useState } from 'react';
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
  13: import { preloadVoices } from './features/audio/speech';
  14: import { useSync, initAuth } from './features/sync/useSync';
  15: import { pushLocal } from './features/sync/driveSync';
  16: import { currentState as authState } from './features/auth/googleAuth';
  17: import { applyTheme } from './features/theme/themes';
  18: 
  19: type Screen =
  20:   | 'loading' | 'setup' | 'dashboard'
  21:   | 'daily-setup' | 'range-setup' | 'practice'
  22:   | 'stats' | 'settings' | 'quiz';
  23: 
  24: export default function App() {
  25:   const [screen, setScreen] = useState<Screen>('loading');
  26:   const [profile, setProfile] = useState<StudentProfile | null>(null);
  27:   const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  28:   const [selectedOp, setSelectedOp] = useState<PracticeOp>('multiplication');
  29:   const { auth, syncStatus, lastSyncedAt, syncError, handleSignIn, handleSignOut, manualSync } = useSync();
  30: 
  31:   const pickOperation = (op: PracticeOp) => {
  32:     setSelectedOp(op);
  33:     setScreen('range-setup');
  34:   };
  35: 
  36:   useEffect(() => {
  37:     preloadVoices();
  38:     initAuth();
  39:     studentRepo.getAll().then(all => {
  40:       if (all.length === 0) {
  41:         setScreen('setup');
  42:       } else {
  43:         const p = all[0];
  44:         setProfile(p);
  45:         // Apply saved theme immediately
  46:         applyTheme(p.settings.theme ?? 'indigo');
  47:         // Clean up any leftover empty sessions from earlier versions / abandoned starts
  48:         sessionRepo.deleteEmpty(p.id).catch(() => {});
  49:         setScreen('dashboard');
  50:       }
  51:     });
  52:   }, []);
  53: 
  54:   const updateProfile = async (updated: StudentProfile) => {
  55:     setProfile(updated);
  56:     await studentRepo.save(updated);
  57:   };
  58: 
  59:   const updateSettings = async (settings: StudentSettings) => {
  60:     if (!profile) return;
... (121 more lines)
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

### `vite.config.ts`

Purpose: Vite build/PWA configuration.

```text
   1: import { defineConfig } from 'vite'
   2: import react from '@vitejs/plugin-react'
   3: import { VitePWA } from 'vite-plugin-pwa'
   4: import { readFileSync } from 'node:fs'
   5: 
   6: // VITE_BASE_PATH: set to /mathfan/ when deploying to GitHub Pages project site,
   7: // leave unset (defaults to /) for custom domain or local dev.
   8: const base = process.env.VITE_BASE_PATH ?? '/'
   9: const pkg: { version: string } = JSON.parse(readFileSync('./package.json', 'utf8'))
  10: 
  11: export default defineConfig({
  12:   base,
  13:   define: {
  14:     __APP_VERSION__: JSON.stringify(pkg.version),
  15:     __GIT_SHA__: JSON.stringify(process.env.VITE_GIT_SHA ?? 'dev'),
  16:     __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  17:   },
  18:   plugins: [
  19:     react(),
  20:     VitePWA({
  21:       registerType: 'prompt',
  22:       includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  23:       manifest: {
  24:         name: 'MathFan',
  25:         short_name: 'MathFan',
  26:         description: 'Adaptive math practice for grades 3–5',
  27:         theme_color: '#4f46e5',
  28:         background_color: '#ffffff',
  29:         display: 'standalone',
  30:         orientation: 'portrait',
  31:         icons: [
  32:           { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
  33:           { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
  34:           { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  35:         ],
  36:       },
  37:       workbox: {
  38:         globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  39:         // Ensure navigateFallback works under the base path
  40:         navigateFallback: `${base}index.html`,
  41:       },
  42:     }),
  43:   ],
  44: })
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
  17:     "dexie": "^4.4.3",
  18:     "react": "^19.2.6",
  19:     "react-dom": "^19.2.6",
  20:     "react-router-dom": "^7.16.0"
  21:   },
  22:   "devDependencies": {
  23:     "@eslint/js": "^10.0.1",
  24:     "@testing-library/jest-dom": "^6.9.1",
  25:     "@testing-library/react": "^16.3.2",
  26:     "@types/node": "^24.12.3",
  27:     "@types/react": "^19.2.14",
  28:     "@types/react-dom": "^19.2.3",
  29:     "@vitejs/plugin-react": "^6.0.1",
  30:     "@vitest/coverage-v8": "^4.1.7",
  31:     "eslint": "^10.3.0",
  32:     "eslint-plugin-react-hooks": "^7.1.1",
  33:     "eslint-plugin-react-refresh": "^0.5.2",
  34:     "globals": "^17.6.0",
  35:     "jsdom": "^29.1.1",
  36:     "typescript": "~6.0.2",
  37:     "typescript-eslint": "^8.59.2",
  38:     "vite": "^8.0.12",
  39:     "vite-plugin-pwa": "^1.3.0",
  40:     "vitest": "^4.1.7"
  41:   }
  42: }
```

### `src/main.tsx`

Purpose: React entry point that mounts the app.

```text
   1: import { StrictMode } from 'react'
   2: import { createRoot } from 'react-dom/client'
   3: import './index.css'
   4: import App from './App.tsx'
   5: 
   6: createRoot(document.getElementById('root')!).render(
   7:   <StrictMode>
   8:     <App />
   9:   </StrictMode>,
  10: )
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

### `src/features/sync/snapshot.ts`

Purpose: Local persistence/database layer.

```text
   1: import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../../types/math';
   2: import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
   3: import { db } from '../../db/dexie';
   4: 
   5: export interface AppSnapshot {
   6:   appId: 'mathfan';
   7:   snapshotVersion: 1;
   8:   snapshotAt: string;
   9:   students: StudentProfile[];
  10:   itemStates: StudentItemState[];
  11:   attempts: AttemptLog[];
  12:   sessions: PracticeSession[];
  13:   // Added in quiz feature — absent in older snapshots; treat missing as []
  14:   multFactStats?: MultiplicationFactStats[];
  15:   quizSessions?: QuizSession[];
  16: }
  17: 
  18: // ── Build ─────────────────────────────────────────────────────────────────────
  19: 
  20: export async function buildSnapshot(): Promise<AppSnapshot> {
  21:   const [students, itemStates, attempts, sessions, multFactStats, quizSessions] = await Promise.all([
  22:     db.students.toArray(),
  23:     db.itemStates.toArray(),
  24:     db.attempts.toArray(),
  25:     db.sessions.toArray(),
  26:     db.multFactStats.toArray(),
  27:     db.quizSessions.toArray(),
  28:   ]);
  29:   return {
  30:     appId: 'mathfan',
  31:     snapshotVersion: 1,
  32:     snapshotAt: new Date().toISOString(),
  33:     students,
  34:     itemStates,
  35:     attempts,
  36:     sessions,
  37:     multFactStats,
  38:     quizSessions,
  39:   };
  40: }
  41: 
  42: // ── Apply (merge remote into local) ──────────────────────────────────────────
  43: 
  44: /**
  45:  * Merge a remote snapshot into the local DB.
  46:  * Strategy: union by ID — remote wins for students and itemStates when the remote
  47:  * has more attempts; local wins for everything already present locally.
  48:  * Attempts and sessions are unioned (deduped by ID).
  49:  * MultFactStats: take the one with more totalAttempts (further along).
  50:  * QuizSessions: union by ID.
  51:  */
  52: export async function mergeSnapshot(remote: AppSnapshot): Promise<void> {
  53:   await db.transaction(
  54:     'rw',
  55:     [db.students, db.itemStates, db.attempts, db.sessions, db.multFactStats, db.quizSessions],
  56:     async () => {
  57: 
  58:       // Students: upsert all remote students (don't delete local-only ones)
  59:       for (const s of remote.students) {
  60:         await db.students.put(s);
... (45 more lines)
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
   9: import type { SessionConfig } from '../../types/math';
  10: import { parseFactKey, createInitialFactStats } from './multiplicationFacts';
  11: import { MultiplicationMasteryGrid } from './MultiplicationMasteryGrid';
  12: import { applyAnswerToStats, SLOW_MS } from './masteryEngine';
  13: import { selectQuizQuestions } from './quizQuestionSelector';
  14: import { generateRecommendations } from './practiceRecommendation';
  15: import { db } from '../../db/dexie';
  16: import { generateId } from '../../utils/id';
  17: 
  18: interface Props {
  19:   studentId: string;
  20:   onDone: () => void;
  21:   onStartPractice?: (config: SessionConfig) => void;
  22: }
  23: 
  24: type Phase = 'setup' | 'loading' | 'active' | 'feedback' | 'retry' | 'summary';
  25: 
  26: const QUIZ_LENGTHS = [10, 20, 30, 50];
  27: const DEFAULT_LENGTH = 20;
  28: const FEEDBACK_MS = 800;
  29: 
  30: 
  31: // ── Sub-components ─────────────────────────────────────────────────────────────
  32: 
  33: function FactChip({ label, bg, text }: { label: string; bg: string; text: string }) {
  34:   return (
  35:     <span style={{ background: bg, color: text, borderRadius: '8px', padding: '4px 10px', fontSize: '14px', fontWeight: '600', display: 'inline-block', margin: '3px' }}>
  36:       {label}
  37:     </span>
  38:   );
  39: }
  40: 
  41: function StatBox({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  42:   return (
  43:     <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px', textAlign: 'center', flex: 1 }}>
  44:       <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>{value}</div>
  45:       <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{label}</div>
  46:     </div>
  47:   );
  48: }
  49: 
  50: // ── Setup screen ───────────────────────────────────────────────────────────────
  51: 
  52: function SetupScreen({
  53:   quizLength, onSelectLength, onStart, onBack,
  54: }: {
  55:   quizLength: number;
  56:   onSelectLength: (n: number) => void;
  57:   onStart: () => void;
  58:   onBack: () => void;
  59: }) {
  60:   return (
... (696 more lines)
```

### `src/features/practice/PracticeScreen.tsx`

Purpose: Local persistence/database layer.

```text
   1: import { useEffect, useRef, useState, useCallback } from 'react';
   2: import type { SessionConfig, StudentSettings } from '../../types/math';
   3: import { db } from '../../db/dexie';
   4: import { usePracticeSession } from './usePracticeSession';
   5: import { NumPad } from '../../components/NumPad';
   6: import { SessionSummary } from '../../components/SessionSummary';
   7: import { SettingsOverlay } from '../../components/SettingsOverlay';
   8: import { TutorChat } from '../ai/TutorChat';
   9: import { speakProblem, speakFeedback, stopSpeech } from '../audio/speech';
  10: 
  11: const AUTO_ADVANCE_MS = 700;
  12: 
  13: interface Props {
  14:   studentId: string;
  15:   config: SessionConfig;
  16:   settings: StudentSettings;
  17:   onUpdateSettings: (s: StudentSettings) => void;
  18:   onDone: () => void;
  19:   onOpenSettings?: () => void;
  20:   onPlayAgain?: () => void;
  21: }
  22: 
  23: export function PracticeScreen({
  24:   studentId, config, settings, onUpdateSettings, onDone, onOpenSettings, onPlayAgain,
  25: }: Props) {
  26:   const { state, startSession, submitAnswer, nextQuestion } = usePracticeSession(studentId);
  27:   const [input, setInput] = useState('');
  28:   const [showSettings, setShowSettings] = useState(false);
  29:   const [showTutor, setShowTutor] = useState(false);
  30:   const [showQuit, setShowQuit] = useState(false);
  31:   const [quitting, setQuitting] = useState(false); // show summary with partial data
  32:   const inputRef = useRef<HTMLInputElement>(null);
  33:   const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  34: 
  35:   // ── Start ─────────────────────────────────────────────────────────────────
  36: 
  37:   useEffect(() => {
  38:     startSession(config);
  39:     return () => {
  40:       stopSpeech();
  41:       if (autoTimer.current) clearTimeout(autoTimer.current);
  42:     };
  43:   // eslint-disable-next-line react-hooks/exhaustive-deps
  44:   }, []);
  45: 
  46:   // ── Focus helpers ─────────────────────────────────────────────────────────
  47: 
  48:   const focusInput = useCallback(() => {
  49:     requestAnimationFrame(() => inputRef.current?.focus());
  50:   }, []);
  51: 
  52:   // New question or retry → clear input (update during render, not in effect)
  53:   const [lastItemKey, setLastItemKey] = useState<string | null>(null);
  54:   const currentItemKey = state.phase === 'active'
  55:     ? `${state.currentItem?.id ?? ''}-${state.retryKey ?? 0}`
  56:     : null;
  57:   if (state.phase === 'active' && currentItemKey !== lastItemKey) {
  58:     setLastItemKey(currentItemKey);
  59:     setInput('');
  60:   }
... (414 more lines)
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
  12: 
  13: interface Props {
  14:   profile: StudentProfile;
  15:   onUpdateProfile: (p: StudentProfile) => void;
  16:   onBack: () => void;
  17:   onSwitchStudent: () => void;
  18:   auth: AuthState;
  19:   syncStatus: SyncStatus;
  20:   lastSyncedAt: string | null;
  21:   syncError: string | null;
  22:   onSignIn: () => void;
  23:   onSignOut: () => void;
  24:   onManualSync: () => void;
  25: }
  26: 
  27: /** Known Gemini models with a free tier. Each has its own daily quota. */
  28: const AI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  29: 
  30: function Section({ title, children }: { title: string; children: React.ReactNode }) {
  31:   return (
  32:     <div style={s.section}>
  33:       <h3 style={s.sectionTitle}>{title}</h3>
  34:       <div style={s.sectionBody}>{children}</div>
  35:     </div>
  36:   );
  37: }
  38: 
  39: function ToggleRow({ label, desc, checked, onChange }: {
  40:   label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
  41: }) {
  42:   return (
  43:     <label style={s.row}>
  44:       <div>
  45:         <p style={s.rowLabel}>{label}</p>
  46:         {desc && <p style={s.rowDesc}>{desc}</p>}
  47:       </div>
  48:       <button
  49:         role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
  50:         style={{ ...s.toggle, background: checked ? 'var(--primary)' : '#d1d5db' }}
  51:       >
  52:         <span style={{ ...s.knob, transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} />
  53:       </button>
  54:     </label>
  55:   );
  56: }
  57: 
  58: export function SettingsPage({ profile, onUpdateProfile, onBack, onSwitchStudent, auth, syncStatus, lastSyncedAt, syncError, onSignIn, onSignOut, onManualSync }: Props) {
  59:   const settings = profile.settings;
  60:   const [driveInfo, setDriveInfo] = useState<{ sizeBytes: number | null; modifiedAt: string | null } | null>(null);
... (413 more lines)
```

### `src/features/stats/FactStatsTable.tsx`

Purpose: Progress/statistics screens or calculations.

```text
   1: import { useEffect, useState, useMemo } from 'react';
   2: import type { StudentItemState } from '../../types/math';
   3: import { itemStateRepo } from '../../db/repositories';
   4: import { TABLE_MIN, TABLE_MAX, tableFromItemId } from '../curriculum/multiplicationItems';
   5: import { describeItem } from '../curriculum/describeItem';
   6: import { MASTERY_COLORS } from '../../utils/masteryColors';
   7: 
   8: interface Props { studentId: string }
   9: 
  10: type SortKey = 'accuracy' | 'wrong' | 'attempts' | 'avgSpeed' | 'bestSpeed';
  11: type TypeFilter = 'all' | 'mul' | 'div' | 'add' | 'sub' | 'frac' | 'word' | 'round' | 'factors' | 'dec';
  12: type StatusFilter = 'all' | 'weak' | 'strong' | 'new';
  13: 
  14: const OPERATION_TABS: { key: TypeFilter; label: string; icon: string }[] = [
  15:   { key: 'all',     label: 'All',       icon: '∑' },
  16:   { key: 'mul',     label: 'Multiply',  icon: '✖️' },
  17:   { key: 'div',     label: 'Divide',    icon: '➗' },
  18:   { key: 'add',     label: 'Add',       icon: '➕' },
  19:   { key: 'sub',     label: 'Subtract',  icon: '➖' },
  20:   { key: 'frac',    label: 'Fractions', icon: '🍕' },
  21:   { key: 'word',    label: 'Word',      icon: '📖' },
  22:   { key: 'round',   label: 'Rounding',  icon: '🔵' },
  23:   { key: 'factors', label: 'Primes',    icon: '🔢' },
  24:   { key: 'dec',     label: 'Decimals',  icon: '🔟' },
  25: ];
  26: 
  27: /** Bucket an itemId's describe-group into a TypeFilter (unknown-factor counts as multiply). */
  28: function bucketOf(itemId: string): Exclude<TypeFilter, 'all'> | 'other' {
  29:   const g = describeItem(itemId).group;
  30:   if (g === 'mul' || g === 'unk') return 'mul';
  31:   if (g === 'div') return 'div';
  32:   if (g === 'add') return 'add';
  33:   if (g === 'sub') return 'sub';
  34:   if (g === 'frac') return 'frac';
  35:   if (g === 'word') return 'word';
  36:   if (g === 'round') return 'round';
  37:   if (g === 'factors') return 'factors';
  38:   if (g === 'dec') return 'dec';
  39:   return 'other';
  40: }
  41: 
  42: export function FactStatsTable({ studentId }: Props) {
  43:   const [states, setStates] = useState<StudentItemState[]>([]);
  44:   const [sort, setSort] = useState<SortKey>('accuracy');
  45:   const [sortAsc, setSortAsc] = useState(true);
  46:   const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  47:   const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  48:   const [tableFilter, setTableFilter] = useState<number | 'all'>('all');
  49: 
  50:   useEffect(() => {
  51:     itemStateRepo.getForStudent(studentId).then(s =>
  52:       setStates(s.filter(st => st.attemptCount > 0))
  53:     );
  54:   }, [studentId]);
  55: 
  56:   // Count of practiced facts per operation, for the tab badges
  57:   const groupCounts = useMemo(() => {
  58:     const c: Record<string, number> = { all: states.length };
  59:     for (const s of states) {
  60:       const b = bucketOf(s.itemId);
... (244 more lines)
```
