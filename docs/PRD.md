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
| MF-001 | P0 | In Progress | **Multiplication practice section.** The app has a dedicated Multiplication mode where students drill multiplication facts. It is distinct from the adaptive daily review and can be entered on demand from the home screen. |
| MF-002 | P0 | Not Started | **Times table selector — single table.** Before a session starts, the student can pick one multiplier (2 through 13) to focus on. Selecting "7" drills 7×2, 7×3, 7×4 … 7×13 in that session. |
| MF-003 | P0 | Not Started | **Times table selector — multiple tables.** The student can select two or more multipliers (e.g. 7 and 8) and practice them interleaved in one mixed session. Any combination of tables 2–13 is valid. |
| MF-004 | P0 | Not Started | **Table range 2–13.** The multiplication table covers 2×2 through 13×13. Facts involving 0 or 1 are excluded from timed practice as they do not require memorization. |
| MF-005 | P0 | Not Started | **Session length control.** Before starting any session, the student (or parent) chooses how many questions to answer: **10, 20, or 25**. Default is 20. The choice is remembered for the next session. |
| MF-006 | P1 | Not Started | **Fact ordering within a single-table drill.** Single-table sessions present facts in random order (not sequential 2, 3, 4 …) to prevent pattern-matching without true recall. |
| MF-007 | P1 | Not Started | **Question format variety.** Within a multiplication session, questions are presented in mixed formats: `7 × 8 = ?` (standard), `? × 8 = 56` (unknown factor), `56 ÷ 7 = ?` (inverse). Default mix: 70% standard, 20% unknown factor, 10% inverse. |
| MF-008 | P1 | Not Started | **Per-fact result feedback.** After each answer, the app shows immediately: correct or wrong, the correct answer, and the student's response time in seconds. |
| MF-009 | P1 | Not Started | **Session summary screen.** At the end of every session (multiplication or daily review), the app shows: total questions, correct count, accuracy %, average response time, fastest answer, and the list of facts that were missed. |
| MF-010 | P2 | Not Started | **Highlight weak facts in table selector.** In the table selector UI, tables the student has historically struggled with are visually marked (e.g. a warning dot), so the student can intentionally target weak spots. |
| MF-011 | P2 | Not Started | **"Surprise me" mode.** A single button that auto-selects 2–3 tables the student most needs to practice based on mastery data, and starts the session immediately. |

---

## Section 2 — Adaptive Daily Review

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-020 | P0 | In Progress | **Adaptive session planner.** Each daily session automatically selects questions: 60% due for review, 20% weak/error-prone items, 20% new or rarely seen items. Session length is set by MF-005. |
| MF-021 | P0 | In Progress | **Spaced review scheduler.** After each answer, the app computes the next review date using correctness and response speed (again / hard / good / easy → stability days). Wrong answers are retried within the same session. |
| MF-022 | P0 | In Progress | **Mastery model per fact.** Each fact tracks: attempt count, correct count, median latency, stability days, mastery level (new / learning / developing / strong / mastered). |

---

## Section 3 — Mastery Grid

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-030 | P1 | In Progress | **13×13 mastery grid.** A visual grid showing every multiplication fact (2×2 through 13×13) color-coded by mastery level: green = mastered, light green = strong, yellow = developing, red = learning, gray = new. |
| MF-031 | P1 | In Progress | **Cell detail on tap.** Tapping a cell shows: the fact, correct rate %, median speed, personal best speed, last seen date, next review date. |

---

## Section 4 — Audio

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-040 | P1 | In Progress | **Audio question reading.** The app speaks each problem aloud using the browser Web Speech API (e.g. "Seven times eight"). |
| MF-041 | P1 | In Progress | **Audio answer feedback.** After answering, the app speaks the result (e.g. "Correct. Seven times eight is fifty-six."). |
| MF-042 | P1 | Not Started | **Repeat button.** A speaker icon on the question card re-reads the current problem on demand. |
| MF-043 | P1 | In Progress | **Audio on/off toggle.** Audio can be disabled from settings. The setting persists per student profile. |

---

## Section 5 — Student Profile & Settings

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-050 | P0 | Done | **Create student profile.** A student can enter their name and select grade level (3, 4, or 5). Profile is stored locally. |
| MF-051 | P0 | In Progress | **Multiple profiles.** The app supports more than one student profile on the same device. A profile picker is shown at startup when more than one profile exists. |
| MF-052 | P1 | Not Started | **Edit profile.** Student name and grade can be edited after creation. |
| MF-053 | P2 | Not Started | **Export / import progress.** The student can export their full practice history as a JSON file and import it on another device. |

---

## Section 6 — Parent Dashboard

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-060 | P1 | In Progress | **Weekly summary.** Parent view shows: days practiced this week, total questions, overall accuracy, and which facts improved or still need work. |
| MF-061 | P2 | Not Started | **Accuracy trend chart.** Line chart of accuracy over the past 30 days. |
| MF-062 | P2 | Not Started | **Suggested focus.** App recommends 3–5 specific facts for the parent to review with the child based on mastery data. |

---

## Section 7 — Non-Functional Requirements

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-070 | P0 | In Progress | **PWA — installable on iPad.** The app can be added to the iPad home screen and opened as a standalone app without a browser chrome. |
| MF-071 | P0 | In Progress | **Offline-capable.** After first load, the full app works without a network connection. |
| MF-072 | P0 | In Progress | **Local-first storage.** All student data (profiles, attempts, mastery states, sessions) is stored in IndexedDB on-device. No backend required for MVP. |
| MF-073 | P0 | Done | **Unit tests for core logic.** Scheduler, answer checker, and question generator all have automated tests that pass before each release. |
| MF-074 | P0 | Not Started | **Mobile-friendly layout.** All UI is usable with thumbs on an iPad screen. Tap targets are at least 44×44 pt. No horizontal scrolling on any screen. |
| MF-075 | P1 | Not Started | **Child-safe design.** No public leaderboard, no ads, no open chat, no links to external sites. All comparison is against the student's own past performance only. |

---

## Section 8 — Speed & Performance Tracking

The app tracks speed at three levels: individual fact, per-table session, and overall session. "Speed" means correct response time only — wrong answers are not counted toward personal bests.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-080 | P0 | In Progress | **Record response time for every attempt.** Every attempt log entry stores the elapsed time from question display to answer submission, in milliseconds. This is the raw source for all speed statistics. |
| MF-081 | P0 | Not Started | **Personal best per individual fact.** For each fact (e.g. 7×8), store the student's all-time fastest correct response time. Display it in the cell detail (MF-031) and on the feedback screen after answering correctly. |
| MF-082 | P1 | Not Started | **Personal best per times table.** For each table (e.g. "7 times table"), store the best average response time achieved across any single session that practiced that table. A "best session" is the session where the student's average correct-answer speed was fastest. |
| MF-083 | P1 | Not Started | **Personal best per session type.** Separate personal bests are tracked for: single-table drill, multi-table mixed session, and adaptive daily review. Shown on the session summary screen. |
| MF-084 | P1 | Not Started | **Average speed per fact.** Display rolling median response time per fact (last 5 correct attempts). Used to classify each fact as fast / normal / slow and to color-code the mastery grid. |
| MF-085 | P1 | Not Started | **Speed classification thresholds.** Each correct response is classified: Fast (≤1.5 s), Normal (1.5–4 s), Slow (>4 s). Thresholds are the same for all students in MVP; configurable per grade later. These thresholds directly feed the again/hard/good/easy rating used by the scheduler. |
| MF-086 | P2 | Not Started | **"New personal best" moment.** When a student beats their personal best for a fact or a session, the app shows a brief celebration (e.g. a star burst or "New record!") without interrupting the session flow. |

---

## Section 9 — Progress History: Day / Week / Month Views

The student (and parent) can look back at practice history across three time windows. All counts and stats are calculated from the stored attempt log and session records.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-090 | P0 | Not Started | **Today's stats bar.** Always visible on the home/dashboard screen: problems answered today, accuracy today, minutes practiced today. Updates in real time as sessions complete. |
| MF-091 | P1 | Not Started | **Day view.** A detailed view of a single day showing: each session (time started, mode, questions, accuracy, average speed), total questions for the day, and accuracy for the day. The student can tap any past day to see its detail. |
| MF-092 | P1 | Not Started | **Week view.** A 7-day bar chart (or calendar strip) showing questions answered per day for the current week. Tapping a day bar opens that day's detail (MF-091). Shows totals: questions this week, accuracy this week, days practiced this week. |
| MF-093 | P1 | Not Started | **Month view.** A calendar-style or bar chart view for the current month showing daily question counts and accuracy. Shows totals: questions this month, accuracy this month, days practiced this month. |
| MF-094 | P1 | Not Started | **Period comparison — questions.** On the week view, show "this week vs last week" question count. On the month view, show "this month vs last month." Use a simple up/down arrow with a number (e.g. "+34 from last week"). |
| MF-095 | P1 | Not Started | **Period comparison — accuracy.** Same as MF-094 but for accuracy %. Show whether accuracy improved or declined week-over-week and month-over-month. |
| MF-096 | P1 | Not Started | **Per-table history panel.** From the table selector or mastery grid, the student can drill into any individual times table (e.g. "7×") and see: total practice sessions, best session speed, accuracy over time, and a sparkline of average speed per session (most recent 10 sessions). |
| MF-097 | P2 | Not Started | **Yesterday's stats.** On the home screen, show yesterday's question count and accuracy as a quick reference point for today's session. |

---

## Section 10 — Motivation & Growth

The app's goal is to make the student feel good about their own improvement. All comparison is against the student's own past — never against other students.

| ID | Priority | Status | Description |
|---|---|---|---|
| MF-100 | P0 | Not Started | **Practice streak.** Display the number of consecutive days the student has practiced. Shown prominently on the dashboard. Losing a streak does not cause shame — it resets quietly and a new streak begins. |
| MF-101 | P1 | Not Started | **Fact improvement indicator.** In the mastery grid and fact detail view, show whether each fact is getting faster compared to the student's performance 7 days ago. Use a simple arrow: ↑ faster, → same, ↓ slower. |
| MF-102 | P1 | Not Started | **Per-table improvement indicator.** In the table selector, show each table's average speed trend over the past 7 days (↑ faster / → same / ↓ slower). Students can see at a glance which tables they are improving. |
| MF-103 | P1 | Not Started | **Session-over-session improvement.** On the session summary screen, compare this session's average speed and accuracy to the student's last session of the same type (e.g. last 7-times-table drill). Show delta: "3 seconds faster on average" or "5% more accurate than last time." |
| MF-104 | P1 | Not Started | **Growth chart — speed over time.** A line chart showing the student's average correct-answer speed (across all facts) for each day practiced over the past 30 days. Downward slope = getting faster = good. |
| MF-105 | P1 | Not Started | **Growth chart — accuracy over time.** A line chart showing overall accuracy (%) per day for the past 30 days. Upward slope = improving. Shown alongside the speed chart (MF-104). |
| MF-106 | P1 | Not Started | **Milestone badges.** The student earns simple visual badges for meaningful milestones: first session completed, 7-day streak, first fact mastered, all facts in a table mastered, accuracy above 90% in a session, beat a personal best. Badges are collected locally and visible on the profile screen. |
| MF-107 | P2 | Not Started | **"Best week" highlight.** On the month view, highlight the week in which the student answered the most questions or achieved the highest accuracy. Framed positively: "Your best week was May 12–18." |
| MF-108 | P2 | Not Started | **Encouraging message after session.** After completing a session, show a short, positive, non-repetitive message tailored to the result: accuracy improved, streak extended, personal best, or just a general encouragement. Never shows negative or shame language. |

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
| MF-141 | P2 | Not Started | **Decimals — compare, round, add/subtract/multiply/divide to hundredths.** |
| MF-142 | P2 | Not Started | **Decimal ↔ fraction ↔ percent conversions** (e.g. `0.25 = 1/4 = 25%`, guide §5.1). |
| MF-143 | P2 | Not Started | **Rounding** to nearest 10 and 100 (Grade 3, guide §4.1). |
| MF-144 | P2 | Not Started | **Factors, multiples, prime/composite** (Grade 4, guide §4.2). |
| MF-145 | P2 | Not Started | **Word-problem schema trainer** — equal groups, compare, array/area, missing factor, multi-step (guide §7.9). |
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

## Appendix — Status counts (auto-update manually when editing)

| Status | Count |
|---|---|
| Done | 11 |
| In Progress | 11 |
| Not Started | 67 |
| Deferred | 0 |
| **Total** | **89** |

> Note: many Section 1–10 items shown as "In Progress" are in fact shipped
> (drill engine, stats, growth, themes, sync). A full status reconciliation pass
> (`/specsync`) is due to mark them Done against the current code.
