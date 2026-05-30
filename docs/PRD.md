# MathFan — Product Requirements Document

**App:** MathFan  
**Target users:** Grade 3–5 students (primary), parents (secondary)  
**Primary device:** iPad (PWA)  
**Last updated:** 2026-05-30

---

## How to read this document

| Field | Values |
|---|---|
| **ID** | Unique, never reused. Format: `MF-NNN` |
| **Priority** | P0 = MVP must-have · P1 = important, ship soon · P2 = nice to have |
| **Status** | `Not Started` · `In Progress` · `Done` · `Deferred` |

---

## Section 1 — Multiplication Practice

This section covers the dedicated multiplication drill mode: table selection, session configuration, and in-session experience.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-001 | P0 | Done | **Multiplication practice section.** Home screen has a 5-operation picker; "Multiply" opens the table selector. Code: `StudentDashboard.tsx` (OPERATIONS), `TableSelector.tsx`. |
| MF-002 | P0 | Done | **Times table selector — single table.** Pick one multiplier 2–13; `mode: 'single_table'`. Code: `TableSelector.tsx`, `generateSingleTableItems`. |
| MF-003 | P0 | Done | **Times table selector — multiple tables.** Select 2+ tables → `mode: 'multi_table'`, interleaved. Code: `generateMultipleTablesItems`. |
| MF-004 | P0 | Done | **Table range 2–13.** `TABLE_MIN=2`, `TABLE_MAX=13`; 0/1 excluded. Code: `multiplicationItems.ts`. |
| MF-005 | P0 | Done (changed) | **Session length control.** Superseded by a **free-form count (1–200, default 10)** with ±/preset controls, not the original 10/20/25. The default persists via `settings.sessionLength`. Code: `TableSelector.tsx`, `SessionSetup.tsx`. |
| MF-006 | P1 | Done | **Random fact ordering.** `planTableSession` shuffles items. Code: `scheduler.ts`. |
| MF-007 | P1 | Not Started | **Question format variety within a table drill.** A single/multi-table drill currently presents only standard `a × b` items. Unknown-factor and inverse-division items exist but are only injected into the **adaptive daily review** (`ALL_ITEMS`), not table drills. No 70/20/10 mix is implemented. |
| MF-008 | P1 | Done | **Per-fact result feedback.** Immediate correct/wrong, the answer, and response time in seconds. Code: `PracticeScreen.tsx` feedback block. |
| MF-009 | P1 | Done | **Session summary screen.** Shows total, correct, accuracy %, avg speed, fastest answer, **and the missed-facts list** ("Practice these next time"). Code: `SessionSummary.tsx`, `usePracticeSession.ts` (`missedFacts`). |
| MF-010 | P2 | Not Started | **Highlight weak facts in table selector.** No weak-fact marking in `TableSelector.tsx`. |
| MF-011 | P2 | Not Started | **"Surprise me" mode.** Not implemented. |

---

## Section 2 — Adaptive Daily Review

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-020 | P0 | Done | **Adaptive session planner.** 60% due / 20% weak / 20% new split. Code: `planSession` in `scheduler.ts`. |
| MF-021 | P0 | Done | **Spaced review scheduler — FSRS-4.5.** Real FSRS with default weights: per-card stability S + difficulty D + retrievability R; recall-gain scales with (11−D)/low-R/Hard-Easy modifiers; lapses shrink S; next interval = `fsrsInterval(S)` at 0.9 retention. Wrong answers re-queue in-session. See §23. Code: `scheduler.ts`. |
| MF-022 | P0 | Done | **Mastery model per fact.** Tracks attempt/correct counts, median latency, stability days, personal best, mastery level. Code: `StudentItemState`, `updateMasteryLevel`. |

---

## Section 3 — Mastery Grid

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-030 | P1 | Done (changed) | **13×13 mastery grid.** Color-coded grid with a **color-blind-safe palette + letter labels** (blue/M = mastered, green/S = strong, yellow/D = developing, orange/L = learning, gray = new) — superseding the original green/red scheme. Code: `MasteryGrid.tsx`, `masteryColors.ts`. |
| MF-031 | P1 | Partial | **Cell detail on tap.** Shows fact, accuracy %, attempts, avg speed, personal best speed. **Missing:** last-seen date and next-review date in the cell detail. Code: `MasteryGrid.tsx`. |

---

## Section 4 — Audio

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-040 | P1 | Done | **Audio question reading.** `speakProblem` via Web Speech API; ×→"times", ÷→"divided by". Code: `speech.ts`, `PracticeScreen.tsx`. |
| MF-041 | P1 | Done | **Audio answer feedback.** `speakFeedback` speaks the result on correct. Code: `speech.ts`. |
| MF-042 | P1 | Done | **Repeat button.** 🔊 button (title "Repeat") on the question card re-reads the prompt. Code: `PracticeScreen.tsx`. |
| MF-043 | P1 | Done | **Audio on/off toggle.** `settings.audioEnabled` toggled in Settings + the in-drill settings overlay; persists per profile. Code: `SettingsPage.tsx`, `SettingsOverlay.tsx`. |

---

## Section 5 — Student Profile & Settings

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-050 | P0 | Done | **Create student profile.** Name + grade (3/4/5), stored in IndexedDB. Code: `ProfileSetup.tsx`. |
| MF-051 | P0 | Partial | **Multiple profiles.** The DB and `studentRepo` support multiple profiles, and "Switch / Add Profile" exists — but it opens **ProfileSetup (create-new)**, and the app always loads `students[0]` at startup. **Missing:** a real picker to choose among existing profiles. Code: `App.tsx` (`all[0]`), `SettingsPage.tsx`. |
| MF-052 | P1 | Done | **Edit profile.** Name (inline, Enter to save) and grade are editable post-creation. Code: `SettingsPage.tsx` Profile section. |
| MF-053 | P2 | Not Started | **Export / import progress (JSON file).** Not implemented as a file. (Note: Google Drive sync, §16, covers cross-device continuity instead.) |

---

## Section 6 — Parent Dashboard

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-060 | P1 | Partial | **Weekly summary.** The Stats page Week/Month views show days active, total questions, and accuracy for the period (`StatsPage.tsx`), but there is **no parent-specific view**. A `StatsPanel.tsx` weekly-summary component exists but is **dead code (never imported)**. |
| MF-061 | P2 | Partial | **Accuracy trend chart.** `StatsGraph.tsx` overlays an accuracy line on the daily bars for the selected period; not a dedicated fixed 30-day accuracy chart. |
| MF-062 | P2 | Not Started | **Suggested focus.** No parent recommendation feature. (The Growth tab surfaces weak facts but is student-facing.) |

---

## Section 7 — Non-Functional Requirements

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-070 | P0 | Done (config) | **PWA — installable on iPad.** `vite-plugin-pwa` with `display: standalone`, manifest, icons; service worker generated at build. Installability itself is **device-verified only** (untested on a real iPad in this repo). Code: `vite.config.ts`. |
| MF-071 | P0 | Done (config) | **Offline-capable.** Workbox precaches the app shell (`globPatterns`, `navigateFallback`). Real offline behavior is device-verified only. Code: `vite.config.ts`. |
| MF-072 | P0 | Done | **Local-first storage.** Profiles, attempts, item states, sessions in IndexedDB via Dexie. No backend required. Code: `dexie.ts`, `repositories.ts`. |
| MF-073 | P0 | Done | **Unit tests for core logic.** 121 tests across scheduler, answer checker, generators, stats, growth, fractions, describeItem. Code: `src/tests/`. |
| MF-074 | P1 | Partial | **Mobile-friendly layout.** Layouts are responsive with large tap targets and `touchAction: manipulation`; however some wide tables/tab strips use `overflowX: auto` (intentional horizontal scroll), and nothing is device-verified on iPad. |
| MF-075 | P1 | Done | **Child-safe design.** No leaderboard, ads, or chat; all comparison is self-referential. One external integration exists — optional Google sign-in/Drive sync (§16) — which is parent-initiated and off by default. |

---

## Section 8 — Speed & Performance Tracking

The app tracks speed at three levels: individual fact, per-table session, and overall session. "Speed" means correct response time only — wrong answers are not counted toward personal bests.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-080 | P0 | Done | **Record response time for every attempt.** `latencyMs` stored on every `AttemptLog`. Code: `usePracticeSession.ts`. |
| MF-081 | P0 | Done | **Personal best per individual fact.** `personalBestMs` updated on correct answers; shown on the feedback screen ("⚡ New personal best!") and in grid cell detail. Code: `scheduler.ts` (`applyReview`), `MasteryGrid.tsx`. |
| MF-082 | P1 | Not Started | **Personal best per times table (best session avg speed).** Not stored/shown. (`computePerTableStats` exists but is unused.) |
| MF-083 | P1 | Not Started | **Personal best per session type.** Not tracked. |
| MF-084 | P1 | Done (changed) | **Average speed per fact.** `medianLatencyMs` maintained as a 0.7/0.3 exponential moving average (not literally "last 5"), used to classify speed and color the facts table. Code: `scheduler.ts`. |
| MF-085 | P1 | Done | **Speed classification thresholds.** Fast ≤1500 ms, Normal ≤4000 ms, Slow >4000, timeout ≥10000 → feeds again/hard/good/easy. Code: `answerChecker.ts`. |
| MF-086 | P2 | Done | **"New personal best" moment.** "⚡ New personal best!" shown inline on the feedback step when a fact's best is beaten. Code: `PracticeScreen.tsx`. |

---

## Section 9 — Progress History: Day / Week / Month Views

The student (and parent) can look back at practice history across three time windows. All counts and stats are calculated from the stored attempt log and session records.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-090 | P0 | Done | **Today's stats bar.** Dashboard shows today's questions, accuracy, minutes practiced, streak, and due count. Code: `StudentDashboard.tsx`, `computeTodayStats`. |
| MF-091 | P1 | Done | **Day view.** Stats "Sessions" tab lists each session (time, mode, questions, accuracy, avg speed, duration) and expands to per-question detail; the mini-calendar lets you select any single day to filter. Code: `DrillHistory.tsx`, `MiniCalendar.tsx`. |
| MF-092 | P1 | Done | **Week view.** "This Week" preset + daily bar chart + summary pills (questions, accuracy, days active). Code: `StatsPage.tsx`, `StatsGraph.tsx`. |
| MF-093 | P1 | Done | **Month view.** "This Month" preset + chart + summary pills. Code: `StatsPage.tsx`. |
| MF-094 | P1 | Not Started | **Period comparison — questions (this vs last).** The live `StatsPage` shows period totals but **not** a "vs last week/month" delta. (The dead `StatsPanel.tsx` had this; it is not wired.) |
| MF-095 | P1 | Not Started | **Period comparison — accuracy (this vs last).** Same gap as MF-094. |
| MF-096 | P1 | Not Started | **Per-table history panel.** `computePerTableStats` exists but no UI consumes it. |
| MF-097 | P2 | Not Started | **Yesterday's stats on home.** Not shown. |

---

## Section 10 — Motivation & Growth

The app's goal is to make the student feel good about their own improvement. All comparison is against the student's own past — never against other students.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-100 | P0 | Done | **Practice streak.** Consecutive-day streak shown on the dashboard; resets quietly. Code: `computeStreak`, `StudentDashboard.tsx`. |
| MF-101 | P1 | Partial | **Fact improvement indicator.** Delivered as the **Growth tab** (facts grouped stronger / needs-attention / new for today vs yesterday, week vs last week, month vs last month) rather than ↑/→/↓ arrows inside the grid. Code: `GrowthView.tsx`, `computeFactGrowth`. (`factTrend` arrow helper exists but is unused.) |
| MF-102 | P1 | Not Started | **Per-table improvement indicator in the selector.** No trend shown in `TableSelector.tsx`. |
| MF-103 | P1 | Done | **Session-over-session improvement.** Summary compares this session's accuracy and speed to the most recent prior session of the same mode (captured at start via `getLastByMode`). Code: `usePracticeSession.ts`, `SessionSummary.tsx`. |
| MF-104 | P1 | Not Started | **Growth chart — speed over time.** The stats chart plots questions (bars) + accuracy (line); there is no average-speed-over-time line. |
| MF-105 | P1 | Partial | **Growth chart — accuracy over time.** `StatsGraph` overlays an accuracy line over the selected period (today/week/month/custom), satisfying the spirit but not a fixed 30-day window. |
| MF-106 | P1 | Not Started | **Milestone badges.** No badge system. |
| MF-107 | P2 | Not Started | **"Best week" highlight.** Not implemented. |
| MF-108 | P2 | Partial | **Encouraging message after session.** Summary shows a positive tier emoji (🌟/👍/💪) and a gentle "nice work" line on early quit, but not the tailored, varied per-result messages described. Code: `SessionSummary.tsx`. |

---

## Section 11 — Addition & Subtraction Practice

Dedicated mental-math fluency modes (guide §5.1 Tier 1). Operand ranges are
chosen by the student/parent before each drill.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-110 | P0 | Done | **Addition mode.** A standalone Add drill. Each question is `a + b = ?`; the student types the sum. |
| MF-111 | P0 | Done | **Subtraction mode.** A standalone Subtract drill. Each question is `a − b = ?`. Generated problems never have a negative answer (the larger operand is always the minuend). |
| MF-112 | P0 | Done | **Custom operand range.** Before an add/subtract drill, the student/parent sets the smallest and largest operand (0–10000). Quick presets: to 10, to 20, to 100, 10–1000. |
| MF-113 | P0 | Done | **Question count per drill.** Add/subtract drills use the same free-form count control as every other mode (1–200, default 10). |
| MF-114 | P1 | Done | **Add/subtract attempts feed the same engine.** Every attempt is logged, scheduled, and counted in stats, growth, and the facts table exactly like multiplication. |
| MF-115 | P2 | Not Started | **Add/subtract within-N timed challenge.** An optional beat-the-clock variant (e.g. "how many sums within 20 in 60 seconds"). |
| MF-116 | P2 | Not Started | **Missing-addend problems.** `7 + ? = 12` style, mirroring the unknown-factor format in multiplication. |

---

## Section 12 — Division Practice (standalone)

A dedicated division mode separate from the inverse-of-multiplication option
(guide §4.1, §5.1).

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-120 | P0 | Done | **Division mode.** A standalone Divide drill. Each question is `dividend ÷ divisor = ?` with a whole-number quotient (no remainders in this mode). |
| MF-121 | P0 | Done | **Custom divisor/quotient range.** The student sets the range (min 2, avoiding ÷1 and ÷0); dividends are produced as divisor × quotient so every problem divides evenly. Presets: 2–5, 2–10, 2–12, 5–20. |
| MF-122 | P1 | Done | **Shared engine.** Division attempts log, schedule, and appear in stats/growth/facts like all other items. |
| MF-123 | P2 | Not Started | **Division with remainders.** A separate mode that accepts a quotient-and-remainder answer (e.g. `17 ÷ 5 = 3 r 2`). |
| MF-124 | P2 | Not Started | **Long-division step-by-step.** Interactive multi-digit long division (guide §5.2). |

---

## Section 13 — Fractions

Basic fraction reasoning (guide §4.2, §5.2). Uses a mixed input model: a numeric
blank for equivalence and a `‹ = ›` choice for comparison.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-130 | P1 | Done | **Equivalent fractions.** `2/3 = ?/6` — the student types the missing numerator. Problems start from a reduced fraction scaled by 2–6. |
| MF-131 | P1 | Done | **Compare fractions.** `2/3 ▢ 3/4` — the student picks `<`, `=`, or `>` (tap a button or press the matching key). |
| MF-132 | P1 | Done | **Choice-style answer input.** The drill engine, answer checker, and keyboard handler support non-numeric (choice) answers so comparison questions work end to end. |
| MF-133 | P2 | Not Started | **Fractions on a number line.** Drag a point to the correct location (guide §5.2). |
| MF-134 | P2 | Not Started | **Simplify a fraction.** Reduce `6/8` to lowest terms. |
| MF-135 | P2 | Not Started | **Add/subtract fractions — like denominators** (Grade 4, guide §4.2). |
| MF-136 | P2 | Not Started | **Add/subtract fractions — unlike denominators** (Grade 5, guide §4.3). |
| MF-137 | P2 | Not Started | **Fraction of a quantity.** `3/4 of 20 = ?` (guide §7.9). |
| MF-138 | P2 | Not Started | **Fraction × whole number / fraction × fraction** (guide §4.2–4.3). |

---

## Section 14 — Future Curriculum (Grade 3–5 roadmap, not yet built)

Captured from the implementation guide §4, §5, §11 so nothing is lost. All
Not Started; promote to a numbered section when scheduled.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-140 | P2 | Not Started | **Decimals — place value to thousandths** (guide §4.3). |
| MF-141 | P2 | Partial | **Decimals — add/subtract** to tenths (G3–4) / hundredths (G5), non-negative, grade-scaled. NumPad has a decimal key. **Missing:** compare, round, multiply, divide. Code: `decimalItems.ts`. |
| MF-142 | P2 | Not Started | **Decimal ↔ fraction ↔ percent conversions** (e.g. `0.25 = 1/4 = 25%`, guide §5.1). |
| MF-143 | P2 | Done | **Rounding** to nearest 10/100/1000, grade-scaled; already-round numbers skipped. Code: `roundingItems.ts`. |
| MF-144 | P2 | Partial | **Prime/composite + factor check** (choice input), grade-scaled. **Missing:** list factors, multiples, GCF/LCM. Code: `numberTheoryItems.ts`. |
| MF-145 | P2 | Done | **Word-problem schema trainer** — equal groups, array, compare, sharing/division; grade-scaled, numeric answers. Code: `wordProblemItems.ts`. |
| MF-146 | P2 | Not Started | **Multi-digit multiplication** (area model → standard algorithm, guide §4.2–4.3). |
| MF-147 | P2 | Not Started | **Geometry vocabulary** — acute/obtuse, parallel/perpendicular, symmetry (guide §5.1–5.2). |
| MF-148 | P2 | Not Started | **Area / perimeter / volume** formulas and grid practice (guide §4.1–4.3). |
| MF-149 | P2 | Not Started | **Measurement conversion** — time, length, weight, capacity (guide §4.2). |
| MF-150 | P2 | Not Started | **Coordinate plane** plotting and patterns (Grade 5, guide §4.3). |
| MF-151 | P2 | Not Started | **Order of operations / numerical expressions** with parentheses (Grade 5). |
| MF-152 | P2 | Not Started | **Competition path** — Math Kangaroo / Noetic / AMC 8 foundation puzzles (guide §21). |
| MF-153 | P1 | Not Started | **Visual models** — multiplication arrays, equal-group division, area model (guide §7.6). |
| MF-154 | P1 | Not Started | **Strategy coach & "one new trick per day"** (guide §7.7–7.8). |
| MF-155 | P1 | Not Started | **Smart mistake diagnosis** — infer confusions (e.g. 8×9=63 → confused with 7×9) and schedule contrast practice (guide §7.3, §8.6). |
| MF-156 | P2 | Not Started | **Explain-your-thinking mode** — tag the strategy used (guide §7.10). |

---

## Section 15 — Settings Page

A full-screen Settings page (⚙️ on the dashboard) — shipped but previously
undocumented.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-160 | P1 | Done | **Settings page.** Sections for Profile, Practice, Appearance, and Google Sync. Code: `SettingsPage.tsx`. |
| MF-161 | P1 | Done | **Sound + auto-advance toggles** (also available mid-drill via the overlay). Code: `SettingsPage.tsx`, `SettingsOverlay.tsx`. |
| MF-162 | P1 | Done | **Default questions-per-session control** (1–200, ±5). Persisted to `settings.sessionLength`. |
| MF-163 | P2 | Done | **Edit name and grade** from settings (see MF-052). |

---

## Section 16 — Google Sign-in & Cloud Sync

Cross-device continuity via Google + Drive. Shipped; requires
`VITE_GOOGLE_CLIENT_ID` to be configured (gated).

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-170 | P1 | Done (gated) | **Google sign-in (GIS).** Token-client preloaded; popup on tap; silent refresh for returning users; grant flag persisted, token kept in memory only. Disabled with a clear notice when no client ID is configured. Code: `googleAuth.ts`, `SyncWidget.tsx`, `SettingsPage.tsx`. |
| MF-171 | P1 | Done (gated) | **Drive snapshot sync.** Full encrypted-free JSON snapshot of students/attempts/itemStates/sessions to Drive `appDataFolder`; pull-then-push merge on sign-in; push after each session. Code: `snapshot.ts`, `driveSync.ts`, `useSync.ts`. |
| MF-172 | P1 | Done | **Snapshot merge logic.** Item states keep the record with more attempts; attempts/sessions unioned by id; students upserted. Code: `snapshot.ts` (`mergeSnapshot`). |
| MF-173 | P2 | Done | **Sync status display.** Settings shows account, last-sync time, Drive file size, Drive modified time, and local attempt count; manual "Sync now". Code: `SettingsPage.tsx`, `getDriveFileInfo`. |
| MF-174 | P2 | Not Started | **At-rest encryption of the Drive snapshot.** The starter-kit AES-GCM store was not ported; the snapshot is plaintext JSON in the private appData folder. |

---

## Section 17 — Keyboard-First Drill UX

The drill is designed for full keyboard operation (no mouse switching).
Shipped; previously undocumented.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-180 | P0 | Done | **Always-focused answer input.** The numeric input auto-focuses on every new question and after each retry. Code: `PracticeScreen.tsx`. |
| MF-181 | P0 | Done | **Enter submits / advances.** Enter checks the answer; on a correct answer Enter (or Space) goes to the next question. |
| MF-182 | P1 | Done | **Auto-advance option.** When enabled, a correct answer advances automatically after a short delay. Code: `settings.autoAdvance`. |
| MF-183 | P0 | Done | **Wrong-answer retry.** On a wrong answer the field clears, an inline red "Incorrect — try again" shows, and the same question stays; the item is also re-queued. |
| MF-184 | P1 | Done | **Quit mid-session.** `Q` or ✕ opens a confirm dialog; partial answers are saved and a summary is shown. Zero-question sessions are deleted. Code: `PracticeScreen.tsx`, `usePracticeSession.ts`. |
| MF-185 | P1 | Done | **Choice input for comparisons.** Fraction-compare accepts `<` `=` `>` via buttons or matching keys. Code: `PracticeScreen.tsx`, `answerChecker.ts`. |
| MF-186 | P1 | Done | **On-screen numeric keypad** for touch-only use on iPad. Code: `NumPad.tsx`. |
| MF-187 | P2 | Done | **Auto-focused setup screens.** Count inputs on the table/arithmetic/fraction setup screens auto-select on open. Code: `TableSelector.tsx`, `ArithmeticSetup.tsx`, `FractionSetup.tsx`. |

---

## Section 18 — Appearance / Themes

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-190 | P2 | Done | **Color themes.** Seven themes (Indigo, Dark Blue, Sky Blue, High Contrast, Sunrise, Forest, Amber) applied via CSS variables; persisted per profile and re-applied on load. Code: `themes.ts`, `SettingsPage.tsx`, `App.tsx`. |

---

## Section 19 — Stats Navigation & Accessibility (shipped extras)

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-200 | P1 | Done | **Mini-calendar + custom date range.** Pick a single day or a range; days with activity are dotted. Code: `MiniCalendar.tsx`, `StatsPage.tsx`. |
| MF-201 | P1 | Done | **Per-operation tabs in the Facts view.** All / Multiply / Divide / Add / Subtract / Fractions tabs with counts and a per-operation summary (facts, answered, accuracy, avg speed, strong+). Code: `FactStatsTable.tsx`. |
| MF-202 | P1 | Done | **Color-blind-safe mastery palette + letters.** Shared palette (M/S/D/L) used by the grid and the facts table. Code: `masteryColors.ts`. |
| MF-203 | P1 | Done | **Growth tab.** Day/week/month comparison of which facts got stronger/weaker/new. Code: `GrowthView.tsx`. |
| MF-204 | P2 | Done | **Sortable/filterable facts table** across all operations (sort by tries, accuracy, wrong, avg/best speed; filter by status). Code: `FactStatsTable.tsx`. |
| MF-205 | P2 | Done | **Empty-session cleanup.** Zero-question sessions are removed on quit/complete and on startup. Code: `usePracticeSession.ts`, `repositories.ts` (`deleteEmpty`). |

---

## Section 20 — CI/CD & Release

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-210 | P0 | Done | **CI on every push/PR.** GitHub Actions runs typecheck → 121 tests → build. Code: `.github/workflows/ci.yml`. |
| MF-211 | P0 | Done | **Auto-deploy to GitHub Pages on main.** Build (with `VITE_GOOGLE_CLIENT_ID` secret + `VITE_BASE_PATH`) → upload → deploy. Live at `colinzou-git.github.io/mathfan/`. Code: `.github/workflows/deploy.yml`. |
| MF-212 | P1 | Done | **Configurable base path** for project-site vs custom-domain deploys. Code: `vite.config.ts`. |

---

## Section 21 — AI Tutor (Socratic)

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-220 | P1 | Done (gated) | **AI tutor chat.** 💡 button / "H" key in any drill opens a chat scoped to the current problem. Works for every question type. Code: `ai/TutorChat.tsx`, `PracticeScreen.tsx`. |
| MF-221 | P0 | Done | **Never reveals the answer.** System prompt forbids stating the final answer; gives one hint/question at a time, praises reasoning, suggests strategies, lets the child say the answer. Code: `ai/gemini.ts` (`systemInstruction`). |
| MF-222 | P1 | Done | **Bring-your-own Gemini key.** Settings → AI Tutor (key, model, Test, Remove). Key + model in localStorage **only** — never in the profile or Drive snapshot. Code: `ai/aiConfig.ts`, `SettingsPage.tsx`. |
| MF-223 | P1 | Done | **Graceful degradation.** Friendly no-key / offline / bad-key / rate-limit messages; "Open Settings" when unconfigured. Code: `ai/gemini.ts` (`explainAiError`). |
| MF-224 | P2 | Not Started | **Sign-in-gated AI proxy** for a published build (avoids embedding a key). |
| MF-225 | P2 | Not Started | **Other AI providers** — only Gemini implemented; not yet UI-pluggable. |

---

## Section 22 — Responsive & Professional UI

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-230 | P0 | Done | **iPhone portrait + iPad landscape.** Drill is single-column on phone portrait, two-column (question / keypad) on tablet landscape (≥820px). Code: `index.css` (`.drill-card`), `PracticeScreen.tsx`. |
| MF-231 | P1 | Done | **Safe-area insets** for notch / home indicator. Code: `index.css`. |
| MF-232 | P1 | Done | **Design tokens + component polish.** CSS variables (surface/border/muted), themed; NumPad + tutor restyled. Code: `index.css`, `NumPad.tsx`. |
| MF-233 | P2 | Partial | **Full multi-page landscape redesign.** Drill is responsive; dashboard/stats/settings work in both orientations but stay centered single-column. |

---

## Section 23 — FSRS Scheduler & Testing Clock

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-240 | P0 | Done | **FSRS-4.5 scheduler.** Replaced the prior SM-2-style heuristic with real FSRS: stability S, difficulty D (1–10), retrievability R, default weights; recall vs lapse stability formulas; `fsrsInterval(S)` at 0.9 target retention. New `StudentItemState` fields: `fsrsDifficulty`, `reps`, `lapses`. Code: `scheduler.ts`. |
| MF-241 | P1 | Done | **App clock.** Single source of "now" for scheduling/timestamps/stats (`features/time/clock.ts`); answer latency still uses the real wall clock. |
| MF-242 | P1 | Done | **Fast-time debug mode (1 day ≈ 20s).** Settings → Testing toggle accelerates the app clock ~4320× so due dates, streaks, and charts can be exercised in seconds — for manual or automated testing. Monotonic across toggles; persisted. Code: `clock.ts`, `SettingsPage.tsx`. |
| MF-243 | P2 | Done | **Deterministic time in tests.** Scheduler/stats take an explicit `now`, so automated tests control time directly. Tests: `clock.test.ts`, `scheduler.test.ts`. |

---

## Appendix — Status counts (auto-update manually when editing)

| Status | Count |
|---|---|
| Done | 56 |
| Partial | 11 |
| Not Started | 39 |
| Deferred | 0 |
| **Total** | **106** |

> "Done (changed)" and "Done (gated/config)" are counted as Done above. Partial =
> implemented but with a stated gap.

---

## Audit log

**2026-05-30 — /specsync reconciliation (code-verified).**
Reconciled docs/PRD.md against the source. Summary of changes:

- **Promoted to Done** (were "In Progress"/"Not Started" but verified working in
  code): the whole multiplication drill flow (MF-001–006, 008), adaptive
  scheduler + mastery model (MF-020–022), mastery grid (MF-030), audio incl.
  repeat button (MF-040–043), edit profile (MF-052), local storage + tests +
  PWA config (MF-070–073), speed tracking incl. personal bests and the
  "new best" moment (MF-080, 081, 084, 085, 086), day/week/month views
  (MF-091–093), and streak (MF-100).
- **Marked Partial** with the specific gap: session summary missing the
  missed-facts list (MF-009); grid cell detail missing last-seen/next-review
  (MF-031); multiple-profile *picker* missing — app always loads the first
  profile (MF-051); parent-specific view missing, `StatsPanel.tsx` is dead code
  (MF-060); today bar missing minutes (MF-090); accuracy chart not a fixed
  30-day window (MF-061, 105); fact-improvement delivered via Growth tab not
  grid arrows (MF-101); post-session message not yet tailored/varied (MF-108);
  mobile layout not device-verified, some intentional horizontal scroll (MF-074).
- **Kept/!confirmed Not Started:** in-drill format mixing (MF-007), surprise-me
  (MF-011), JSON export/import (MF-053), suggested focus (MF-062), per-table
  best/session-type bests (MF-082, 083), period vs-last deltas (MF-094, 095),
  per-table history panel (MF-096), yesterday stats (MF-097), per-table trend
  (MF-102), session-over-session compare — code present but unwired (MF-103),
  speed-over-time chart (MF-104), badges (MF-106), best-week (MF-107).
- **Changed description to match code:** session length is now free-form 1–200
  default 10, not 10/20/25 (MF-005); grid palette is color-blind-safe blue/green/
  yellow/orange with letters, not green/red (MF-030); avg-speed is a 0.7/0.3 EMA,
  not literal last-5 (MF-084).
- **Added shipped-but-undocumented features** as new sections: Settings page
  (§15), Google sign-in & Drive sync (§16), keyboard-first drill UX (§17),
  themes (§18), stats navigation & accessibility extras (§19), CI/CD (§20).

**Items I was unsure about (please confirm):**
1. **MF-103** — the session-over-session comparison UI is fully coded in
   `SessionSummary.tsx` but `PracticeScreen` never passes `lastSession`, so it
   never renders. I marked it **Not Started**; it could be "Partial (built, not
   wired)". Want me to wire it up (it's a small change)?
2. **MF-060/061** — I treated the Stats week/month views as *not* satisfying the
   "parent dashboard" intent (no parent framing; `StatsPanel.tsx` is dead code).
   If you consider the student Stats page sufficient for parents, these become
   Done.
3. **MF-074 / MF-070 / MF-071** — marked Done(config)/Partial because nothing is
   verified on a real iPad. If you've confirmed install + offline on a device, I
   can promote them to fully Done.

**2026-05-30 — FSRS, fast-clock, AI tutor, responsive, expanded curriculum.**
- Scheduler reviewed and replaced with real **FSRS-4.5** (was an SM-2-style
  heuristic with an unused `ease` field); §23 / MF-240.
- Added an **app clock** with a **fast-time debug mode** (1 day ≈ 20s) so
  spaced-review, streaks, and charts are testable in seconds; MF-241–243.
- Added a **Socratic AI tutor** (Gemini, bring-your-own key, never reveals the
  answer); §21.
- **Responsive drill** (iPad landscape two-column / iPhone portrait), safe
  areas, design tokens, decimal NumPad key; §22.
- Shipped four more grade 3–5 operations: word problems (MF-145), rounding
  (MF-143), primes/factors (MF-144, partial), decimals add/sub (MF-141, partial).
- Wired the three prior audit gaps: missed-facts list (MF-009), minutes-today
  (MF-090), session-over-session compare (MF-103).
- 153 tests passing. Live at colinzou-git.github.io/mathfan/.
