# MathLadder: Adaptive Grade 3–5 Math Practice Web App

**Document type:** Product brainstorm + PRD + implementation guide  
**Primary target:** Grade 3, Grade 4, Grade 5 students  
**Initial location alignment:** San Jose, California, United States  
**Curriculum anchor:** California Common Core State Standards for Mathematics  
**Product vision:** Build a comfortable, strong math foundation through adaptive practice, spaced review, visual reasoning, and eventually competition-style problem solving.

---

## 1. Product Thesis

MathLadder is an adaptive math practice web app for elementary students, starting with multiplication/division fluency and expanding into fractions, decimals, word problems, geometry, measurement, and early math competition preparation.

The app should not be just a worksheet generator or speed drill. It should be a **math foundation trainer** that:

1. Diagnoses exactly which facts, skills, and problem types the student is weak on.
2. Automatically schedules reviews before the student forgets.
3. Avoids wasting time on items the student has already mastered.
4. Builds both fluency and understanding.
5. Supports audio practice, visual models, and explanation.
6. Helps students grow toward math talent and competition readiness.

Core progression:

```text
accuracy → fluency → flexibility → reasoning → problem solving → creativity
```

---

## 2. Educational Design Principles

### 2.1 Adaptive practice, not fixed repetition

The app should not repeatedly show easy items like `3 × 3` if the student already knows them. It should focus on the student’s personal weak spots, such as:

```text
8 × 9
7 × 8
56 ÷ 7
72 ÷ 9
? × 8 = 64
```

Each question should update a student-specific mastery model.

### 2.2 Spaced review

A student may know `8 × 9 = 72` today but forget it after two weeks. The app should schedule review based on memory strength.

Example interval pattern:

```text
wrong → repeat soon
correct but slow → review later today or tomorrow
correct and normal → review in 2–3 days
correct and fast repeatedly → review in 1–4 weeks
long-term mastered → occasional maintenance review
```

### 2.3 Fluency is more than speed

Timed practice is useful, but the app should avoid making the student anxious. The goal is:

```text
accurate + efficient + flexible
```

Design rules:

- Accuracy first, speed second.
- Beat your own previous time, not other students.
- No shame animation.
- No public ranking by default.
- Show growth over time.
- Use short sessions.

### 2.4 Visual models before abstract rules

Especially for multiplication, division, fractions, decimals, area, and volume, students should see visual meaning before only symbolic procedures.

Examples:

- Multiplication as arrays.
- Division as equal groups.
- Fractions on number lines.
- Equivalent fractions as same point / same area.
- Multiplication as area model.
- Decimals as place-value blocks and number lines.

### 2.5 Interleaving after initial learning

The app should not only drill one skill in a blocked way forever.

Bad long-term pattern:

```text
3×1, 3×2, 3×3, 3×4, 3×5
```

Better after initial teaching:

```text
3×6, 4×7, 8×3, 24÷6, ?×3=18
```

Use blocked practice for first exposure, then interleaved mixed review for retention and transfer.

### 2.6 Explanation and reasoning

For some questions, require the student to explain their thinking:

```text
I used an array.
I used repeated addition.
I used a known fact.
I used the distributive property.
I used a number line.
I estimated first.
```

This helps move beyond memorization.

---

## 3. Target Users

### 3.1 Student

- Grade 3, 4, or 5.
- Needs solid math foundation.
- May struggle with fact fluency, word problems, fractions, or multi-step reasoning.
- May eventually want to prepare for math competitions.

### 3.2 Parent

- Wants the child to practice efficiently.
- Wants clear progress reports.
- Wants the app to show gaps without requiring the parent to manually diagnose them.
- Wants safe, low-distraction, child-friendly design.

### 3.3 Optional teacher/tutor later

- Can assign skills.
- Can view mastery.
- Can export reports.

---

## 4. Curriculum Alignment

### 4.1 Grade 3 focus

Core Grade 3 app-friendly topics:

| Area | App modules |
|---|---|
| Multiplication facts | 0–12 tables, especially 1-digit × 1-digit |
| Division facts | Inverse of multiplication |
| Fact families | `6×7=42`, `42÷6=7`, etc. |
| Equal groups | Word problems |
| Arrays | Visual multiplication |
| Unknown factor | `8 × ? = 56` |
| Area/perimeter | Grid-based practice |
| Fractions | Unit fractions, simple fraction comparisons, fractions on number lines |
| Rounding | nearest 10 and 100 |
| Two-step word problems | four operations |

Important anchor:

- Grade 3 should include fluent multiplication/division within 100 and memory of all products of two one-digit numbers.

### 4.2 Grade 4 focus

Core Grade 4 app-friendly topics:

| Area | App modules |
|---|---|
| Multi-digit multiplication | up to 4-digit × 1-digit and 2-digit × 2-digit |
| Division | up to 4-digit dividend ÷ 1-digit divisor |
| Factors/multiples | foundation for number theory |
| Prime/composite | competition foundation |
| Equivalent fractions | visual and symbolic |
| Compare fractions | number line and benchmark reasoning |
| Fraction addition/subtraction | like denominators |
| Fraction × whole number | visual and symbolic |
| Decimals | tenths/hundredths |
| Measurement conversion | time, length, weight, capacity |
| Geometry | angles, lines, symmetry |

### 4.3 Grade 5 focus

Core Grade 5 app-friendly topics:

| Area | App modules |
|---|---|
| Multi-digit multiplication | standard algorithm fluency |
| Long division | up to 4-digit dividend ÷ 2-digit divisor |
| Decimal place value | thousandths |
| Decimal operations | add, subtract, multiply, divide to hundredths |
| Fraction addition/subtraction | unlike denominators |
| Fraction multiplication | visual models + equations |
| Unit fraction division | visual models |
| Volume | rectangular prisms |
| Coordinate plane | graphing and patterns |
| Expressions | parentheses and numerical expressions |

---

## 5. Best App-Friendly Math Categories

Not every math skill fits an adaptive app equally well. Prioritize the topics that benefit from repetition, feedback, scheduling, and short sessions.

### 5.1 Tier 1: Perfect for adaptive practice

| Category | Examples |
|---|---|
| Multiplication facts | `7×8`, `9×6`, `12×12` |
| Division facts | `72÷9`, `56÷7` |
| Addition/subtraction fluency | mental math |
| Fraction equivalence | `2/3 = ?/12` |
| Decimal-fraction conversion | `0.25 = 1/4` |
| Percent foundations | `1/2 = 50%`, `1/4 = 25%` |
| Unit conversion | feet/inches, minutes/hours, cups/quarts |
| Geometry vocabulary | acute, obtuse, parallel, perpendicular |
| Area/perimeter formulas | rectangle, square, composite shapes |
| Volume formulas | rectangular prism |
| Coordinate plotting | `(3, 5)` |
| Order of operations | parentheses and expressions |

### 5.2 Tier 2: Strong with visual scaffolding

| Category | App interaction |
|---|---|
| Fractions on number line | drag point to correct location |
| Compare fractions | use benchmark `0`, `1/2`, `1` |
| Multi-digit multiplication | area model → algorithm |
| Long division | step-by-step interactive |
| Decimal place value | place-value chart |
| Measurement | virtual ruler/container |
| Graphs/data | read bar graph, line plot |

### 5.3 Tier 3: Talent and competition mode

| Category | Examples |
|---|---|
| Number patterns | missing terms |
| Logical reasoning | must-be-true statements |
| Counting | simple combinations |
| Spatial reasoning | folding, symmetry, rotation |
| Estimation | closest answer |
| Visual puzzles | Math Kangaroo style |
| AMC 8 foundation | ratios, geometry, probability, number theory |

---

## 6. MVP Scope

The first version should be narrow and excellent.

### MVP Name

Recommended product name:

```text
MathLadder
```

Reason: it suggests foundation, progression, and long-term growth.

Other name ideas:

```text
MathGap
MathSprint
FactForge
MathRoots
NumberPilot
MathTalent
```

### MVP Goal

Build:

```text
Adaptive multiplication/division fact practice + spaced review + audio + mastery map
```

### MVP Modules

| Priority | Module |
|---|---|
| P0 | Student profile |
| P0 | Multiplication facts 0–12 |
| P0 | Division fact families |
| P0 | Question generator |
| P0 | Answer checking |
| P0 | Response latency tracking |
| P0 | Adaptive mastery model |
| P0 | Spaced review scheduler |
| P0 | Daily 10-minute session |
| P1 | Audio speaking mode |
| P1 | 12×12 mastery grid |
| P1 | Mistake diagnosis |
| P1 | Parent dashboard |
| P1 | Word problems for multiplication/division |
| P2 | Visual arrays |
| P2 | Fraction number-line preview |
| P2 | Competition puzzle preview |

---

## 7. Key Features

### 7.1 Adaptive Times Table Mastery Map

Show a 12×12 grid.

Each cell represents one multiplication fact.

Status colors:

```text
Green = fast and stable
Yellow = correct but slow
Red = often wrong
Blue = due for review
Gray = not introduced yet
```

Example insight:

```text
You know 112/144 multiplication facts.
You are weak on 7×8, 8×9, 6×8, 12×7.
Your division is weaker than multiplication.
Today’s best use of 10 minutes:
- 3 min due review
- 3 min hard facts
- 2 min division inverse facts
- 2 min word problems
```

### 7.2 Fact Family Trainer

Practice the whole family around a multiplication fact.

Example:

```text
8 × 9 = 72
9 × 8 = 72
72 ÷ 8 = 9
72 ÷ 9 = 8
8 × ? = 72
? × 9 = 72
```

This builds multiplication/division connections.

### 7.3 Smart Mistake Diagnosis

If the student answers:

```text
8 × 9 = 63
```

The app should infer:

```text
Possible confusion with 7 × 9 = 63.
```

Then schedule contrast practice:

```text
7×9 = 63
8×9 = 72
9×9 = 81
```

### 7.4 Slow-Correct Detection

Correctness alone is not enough.

Classify each response:

| Result | Meaning | Next action |
|---|---|---|
| Wrong | Not mastered | reteach + repeat soon |
| Correct but slow | fragile recall | short review interval |
| Correct and normal | developing | normal interval |
| Correct and fast | strong | longer interval |
| Fast but wrong | dangerous misconception | slow down + contrast practice |
| Slow and wrong | needs reteaching | show strategy/visual model |

### 7.5 Audio Mode

Audio is a major differentiator.

Modes:

| Mode | Example |
|---|---|
| Chant mode | “Three times three is nine.” |
| Call-and-response | App says “Eight times seven”; student answers “fifty-six.” |
| Listening quiz | App speaks; student types/taps answer |
| Reverse audio | App says “seventy-two”; student names factor pairs |
| Parent-child mode | App speaks, child answers aloud |
| Car/walk mode | low-pressure review without intense screen use |

Example chant sequence:

```text
3, 3, 9
4, 4, 16
4, 5, 20
8, 9, 72
```

Better spoken version:

```text
Three times three is nine.
Four times four is sixteen.
Four times five is twenty.
Eight times nine is seventy-two.
```

### 7.6 Visual Multiplication Mode

For `6 × 8`, show 6 rows and 8 columns.

Then teach flexible decompositions:

```text
6×8 = 6×4 + 6×4
6×8 = 5×8 + 1×8
6×8 = 3×8 + 3×8
```

### 7.7 Strategy Coach

Teach one strategy at a time.

| Fact type | Strategy |
|---|---|
| ×2 | double |
| ×4 | double twice |
| ×5 | half of ×10 |
| ×9 | ×10 minus one group |
| ×8 | double, double, double |
| ×6 | ×5 plus one group |
| square facts | pattern memory |

Example:

```text
8 × 9 = 9 × 8
9 × 8 = 10 × 8 - 8
80 - 8 = 72
```

### 7.8 One New Trick Per Day

Daily short lesson:

```text
Today’s trick: multiplying by 9.
9×7 = 10×7 - 7 = 63.
```

Then schedule related practice.

### 7.9 Word Problem Schema Trainer

Instead of random word problems, tag them by schema.

| Schema | Example |
|---|---|
| Equal groups | 6 bags, 8 apples each |
| Compare | Tom has 4 times as many |
| Array/area | 7 rows of 9 chairs |
| Missing factor | 48 cookies into 6 boxes |
| Fraction of quantity | 3/4 of 20 |
| Measurement conversion | 3 feet = ? inches |
| Multi-step | buy, share, compare |

### 7.10 Explain Your Thinking Mode

For selected questions, ask:

```text
How did you solve it?
```

Options:

```text
I memorized it.
I used an array.
I used repeated addition.
I used a known fact.
I used the distributive property.
I used a number line.
I estimated first.
I worked backward.
```

---

## 8. Adaptive Scheduling Algorithm

### 8.1 Item model

Each skill/fact has a student-specific memory state.

Example:

```json
{
  "skill_id": "MUL_8x9",
  "grade_band": "3",
  "topic": "multiplication",
  "prompt_type": "multiplication_fact",
  "canonical_prompt": "8 × 9",
  "answer": 72,
  "accuracy": 0.71,
  "attempt_count": 14,
  "correct_count": 10,
  "median_latency_ms": 4200,
  "last_seen_at": "2026-05-29T18:00:00-07:00",
  "next_due_at": "2026-06-03T09:00:00-07:00",
  "stability_days": 3.2,
  "difficulty": 0.78,
  "mastery_level": "developing",
  "mistake_patterns": ["answered_63", "confused_with_7x9"]
}
```

### 8.2 Review result categories

Map raw result to memory grade:

| Grade | Meaning |
|---|---|
| Again | wrong, no recall, or severe hesitation |
| Hard | correct but slow |
| Good | correct at acceptable speed |
| Easy | correct very fast and confident |

### 8.3 Session composition

A 10-minute session should contain:

```text
60% due review
20% weak-gap practice
10% new skills
10% puzzle/fun challenge
```

For early MVP, use 20 questions per session:

```text
12 due reviews
4 weak items
2 new/underexposed items
2 fun challenge items
```

### 8.4 Scheduling rules for MVP

Simplified first version:

```typescript
type ReviewGrade = "again" | "hard" | "good" | "easy";

function nextIntervalDays(currentStabilityDays: number, grade: ReviewGrade): number {
  if (grade === "again") return 0;      // same session or later today
  if (grade === "hard") return Math.max(1, currentStabilityDays * 0.8);
  if (grade === "good") return Math.max(2, currentStabilityDays * 1.8);
  if (grade === "easy") return Math.max(4, currentStabilityDays * 2.8);
  return 1;
}
```

Later, replace this with an FSRS-like model.

### 8.5 Latency thresholds

For multiplication facts:

```text
fast: <= 1500 ms
normal: 1500–4000 ms
slow: > 4000 ms
timeout: > 10000 ms
```

These should be configurable by grade and student ability.

### 8.6 Mistake pattern examples

| Wrong answer | Possible diagnosis |
|---|---|
| `8×9 = 63` | confused with `7×9` |
| `7×8 = 54` | nearby fact confusion |
| `6×8 = 42` | confused with `6×7` |
| `9×9 = 72` | confused with `8×9` |
| `56÷8 = 8` | divisor/quotient confusion |
| `72÷9 = 9` | square bias or divisor repetition |

---

## 9. Data Model

### 9.1 StudentProfile

```typescript
interface StudentProfile {
  id: string;
  displayName: string;
  gradeLevel: 3 | 4 | 5;
  timezone: string; // e.g. "America/Los_Angeles"
  createdAt: string;
  settings: StudentSettings;
}
```

### 9.2 StudentSettings

```typescript
interface StudentSettings {
  audioEnabled: boolean;
  speechRate: number;
  dailyGoalMinutes: number;
  maxSessionQuestions: number;
  allowTimedMode: boolean;
  competitionModeEnabled: boolean;
  parentModeEnabled: boolean;
}
```

### 9.3 Skill

```typescript
interface Skill {
  id: string;
  gradeLevel: 3 | 4 | 5;
  domain: string;
  topic: string;
  title: string;
  description: string;
  californiaStandardIds: string[];
  prerequisites: string[];
}
```

### 9.4 PracticeItem

```typescript
interface PracticeItem {
  id: string;
  skillId: string;
  itemType:
    | "multiplication_fact"
    | "division_fact"
    | "unknown_factor"
    | "word_problem"
    | "fraction_number_line"
    | "decimal_place_value"
    | "geometry_vocabulary"
    | "competition_puzzle";
  prompt: string;
  answer: string | number;
  choices?: Array<string | number>;
  explanation?: string;
  visualModelType?: "array" | "number_line" | "area_model" | "place_value" | "none";
  tags: string[];
  difficulty: number;
}
```

### 9.5 StudentItemState

```typescript
interface StudentItemState {
  studentId: string;
  itemId: string;
  skillId: string;
  attemptCount: number;
  correctCount: number;
  lastAnswer?: string;
  lastCorrect: boolean;
  lastLatencyMs: number;
  medianLatencyMs: number;
  ease: number;
  stabilityDays: number;
  difficulty: number;
  masteryLevel: "new" | "learning" | "developing" | "strong" | "mastered";
  lastSeenAt?: string;
  nextDueAt?: string;
  mistakePatterns: string[];
}
```

### 9.6 AttemptLog

```typescript
interface AttemptLog {
  id: string;
  studentId: string;
  itemId: string;
  skillId: string;
  sessionId: string;
  promptShown: string;
  correctAnswer: string | number;
  studentAnswer: string | number;
  isCorrect: boolean;
  latencyMs: number;
  reviewGrade: "again" | "hard" | "good" | "easy";
  createdAt: string;
}
```

### 9.7 PracticeSession

```typescript
interface PracticeSession {
  id: string;
  studentId: string;
  startedAt: string;
  endedAt?: string;
  mode:
    | "daily_review"
    | "times_table"
    | "division"
    | "audio"
    | "word_problem"
    | "challenge";
  plannedQuestionCount: number;
  completedQuestionCount: number;
  correctCount: number;
  averageLatencyMs: number;
}
```

---

## 10. Question Types

### 10.1 Direct multiplication

```text
8 × 9 = ?
```

### 10.2 Reverse multiplication

```text
? × 9 = 72
```

### 10.3 Division fact

```text
72 ÷ 9 = ?
```

### 10.4 Fact family

```text
Complete the family:
8 × 9 = 72
9 × 8 = ?
72 ÷ 8 = ?
72 ÷ 9 = ?
```

### 10.5 Word problem

```text
There are 8 bags. Each bag has 9 apples. How many apples are there?
```

### 10.6 Visual array

```text
[show 8 rows and 9 columns]
How many dots?
```

### 10.7 Strategy prompt

```text
Solve 9×8 using 10×8 - 8.
```

### 10.8 Audio prompt

App speaks:

```text
Eight times nine.
```

Student answers:

```text
72
```

### 10.9 Error correction

```text
A student says 8 × 9 = 63. What mistake did they make?
```

### 10.10 Explain mode

```text
Why is 8 × 9 equal to 72?
```

Possible answer choices:

```text
Because 8×10 is 80, and 80−8 is 72.
Because 8+9 is 17.
Because 8×8 is 72.
Because 9−8 is 1.
```

---

## 11. Grade 3–5 Roadmap

### Phase 1: Multiplication/division engine

- Student profile
- Practice session
- Multiplication fact generation
- Division fact generation
- Adaptive scheduler
- Mastery grid
- Audio text-to-speech
- Local progress storage

### Phase 2: Conceptual support

- Visual arrays
- Strategy coach
- Error diagnosis
- Fact family trainer
- Parent dashboard

### Phase 3: Word problems

- Equal groups
- Arrays
- Unknown factor
- Measurement quantities
- Two-step problems
- Explain strategy

### Phase 4: Fractions

- Unit fractions
- Equivalent fractions
- Compare fractions
- Number line
- Fraction of a quantity
- Add/subtract like denominators
- Add/subtract unlike denominators
- Fraction multiplication preview

### Phase 5: Decimals and Grade 5 readiness

- Place value to thousandths
- Decimal comparison
- Decimal rounding
- Decimal operations
- Powers of 10

### Phase 6: Competition foundation

- Number patterns
- Logic puzzles
- Counting
- Factors/multiples
- Remainders
- Geometry puzzles
- Estimation
- Working backward

---

## 12. Dashboard Ideas

### 12.1 Student dashboard

Show:

```text
Today’s goal: 10 minutes
Due reviews: 18
Weak facts: 7
Current streak: 5 days
Multiplication mastery: 78%
Division mastery: 61%
```

### 12.2 Mastery grid

Show 12×12 multiplication grid.

Each cell opens:

```text
Fact: 8×9
Correct rate: 71%
Median speed: 4.2 sec
Last seen: 3 days ago
Next review: tomorrow
Common mistake: answered 63
Strategy: 10×8 - 8
```

### 12.3 Parent dashboard

Show:

```text
This week:
- Practiced 5 days
- 96 questions answered
- 81% accuracy
- Strong improvement on 7×8 and 8×9
- Still needs practice on division fact families
```

Avoid overwhelming the parent with too many charts in MVP.

---

## 13. Audio Implementation

Use browser Web Speech API for MVP.

### Requirements

- Speak problem aloud.
- Speak answer after response.
- Support slow/normal/fast speech rate.
- Allow mute.
- Allow “repeat question” button.
- Avoid requiring speech recognition in MVP; typed/tapped answers are more reliable.

### Example utterances

```text
"Eight times nine."
"Correct. Eight times nine is seventy-two."
"Try again. Think of ten times eight minus eight."
```

### Later extension

Speech recognition could allow the child to answer aloud, but this should be optional because browser speech recognition reliability varies.

---

## 14. Safety, Privacy, and Child-Friendly Design

Because this is for children:

- No public leaderboard by default.
- No open chat with strangers.
- No ads.
- No unnecessary data collection.
- No school name unless needed.
- Parent-controlled profiles.
- Local-first storage in MVP.
- Export/import progress.
- Avoid collecting exact birth date; grade level is enough.
- Use positive feedback.
- Do not shame wrong answers.
- Avoid addictive dark patterns.

---

## 15. Suggested Tech Stack

### 15.1 Frontend

```text
React
TypeScript
Vite
PWA
CSS modules or Tailwind
```

### 15.2 Local storage

```text
IndexedDB
Dexie.js wrapper
```

### 15.3 State management

For MVP:

```text
React state + custom hooks
```

Later:

```text
Zustand or Redux Toolkit
```

### 15.4 Testing

```text
Vitest for unit tests
Playwright for end-to-end tests
```

### 15.5 Audio

```text
Web Speech API
```

### 15.6 Deployment

```text
GitHub Pages
Cloudflare Pages
Netlify
Vercel
```

### 15.7 Optional backend later

```text
Supabase
Firebase
Cloudflare D1
PostgreSQL
```

MVP recommendation: local-first PWA with IndexedDB first; add cloud sync later.

---

## 16. Suggested Project Structure

```text
mathladder/
  README.md
  AGENTS.md
  package.json
  vite.config.ts
  tsconfig.json
  src/
    app/
      App.tsx
      routes.tsx
    components/
      MasteryGrid.tsx
      PracticeCard.tsx
      AudioButton.tsx
      ProgressSummary.tsx
    features/
      practice/
        PracticeSession.tsx
        questionGenerator.ts
        answerChecker.ts
        sessionPlanner.ts
      scheduler/
        scheduler.ts
        masteryModel.ts
      audio/
        speech.ts
      curriculum/
        skills.ts
        multiplicationItems.ts
        divisionItems.ts
      dashboard/
        StudentDashboard.tsx
        ParentDashboard.tsx
    db/
      schema.ts
      dexie.ts
      repositories.ts
    types/
      math.ts
      student.ts
    utils/
      time.ts
      random.ts
    tests/
      scheduler.test.ts
      questionGenerator.test.ts
      answerChecker.test.ts
```

---

## 17. Coding-AI Instructions

Use the following instructions when giving this project to a coding AI.

### 17.1 Initial prompt for coding AI

```text
You are implementing MathLadder, a local-first PWA for Grade 3–5 adaptive math practice.

Start with the MVP:
1. React + TypeScript + Vite.
2. PWA-ready structure.
3. IndexedDB/Dexie local storage.
4. Student profile.
5. Multiplication facts 0–12.
6. Division fact families.
7. Practice session UI.
8. Answer checking.
9. Response latency tracking.
10. Adaptive spaced review scheduler.
11. 12×12 mastery grid.
12. Browser text-to-speech mode.
13. Basic parent dashboard.
14. Unit tests for scheduler, question generator, and answer checker.

Important design principles:
- Accuracy first, speed second.
- Do not over-practice mastered facts.
- Schedule weak and due items first.
- Use child-friendly, low-pressure UI.
- No public leaderboard.
- No backend in MVP.
- Store all progress locally.
- Code should be modular and easy to extend to fractions and word problems later.

Before coding, create:
- implementation-plan.md
- architecture.md
- data-model.md
- task-list.md

Then implement in small steps and run tests after each major step.
```

### 17.2 Coding agent guardrails

The coding AI should:

- Make small commits/changes.
- Keep data model clean.
- Write tests for scheduling logic.
- Avoid overengineering backend sync in MVP.
- Avoid adding login before local MVP is working.
- Avoid hardcoding only one student forever; support multiple local profiles.
- Avoid AI chat features for children in MVP.
- Avoid cloud data collection unless explicitly required later.

---

## 18. Requirements

### 18.1 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | User can create a local student profile | P0 |
| FR-002 | User can select grade level 3, 4, or 5 | P0 |
| FR-003 | App generates multiplication facts 0–12 | P0 |
| FR-004 | App generates division facts from multiplication fact families | P0 |
| FR-005 | App displays one question at a time | P0 |
| FR-006 | Student can answer by typing or tapping number pad | P0 |
| FR-007 | App checks answer immediately | P0 |
| FR-008 | App records correctness | P0 |
| FR-009 | App records response latency | P0 |
| FR-010 | App classifies response as again/hard/good/easy | P0 |
| FR-011 | App updates mastery state after each answer | P0 |
| FR-012 | App schedules next review date/time | P0 |
| FR-013 | App prioritizes due and weak items | P0 |
| FR-014 | App reduces frequency of mastered items | P0 |
| FR-015 | App shows 12×12 multiplication mastery grid | P1 |
| FR-016 | App supports audio question speaking | P1 |
| FR-017 | App supports audio answer feedback | P1 |
| FR-018 | App shows parent progress summary | P1 |
| FR-019 | App identifies common mistake patterns | P1 |
| FR-020 | App supports word problems for multiplication/division | P1 |
| FR-021 | App supports visual arrays | P2 |
| FR-022 | App supports fraction number-line practice | P2 |
| FR-023 | App supports competition puzzle preview | P2 |
| FR-024 | User can export/import local progress | P2 |

### 18.2 Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-001 | App works as a PWA on iPhone, iPad, Android, Windows, and Mac | P0 |
| NFR-002 | App works offline after first load | P0 |
| NFR-003 | App stores MVP data locally | P0 |
| NFR-004 | App loads quickly | P0 |
| NFR-005 | App uses child-friendly UI | P0 |
| NFR-006 | App avoids public leaderboard | P0 |
| NFR-007 | App avoids ads | P0 |
| NFR-008 | App code is modular and testable | P0 |
| NFR-009 | Scheduler and answer checker have unit tests | P0 |
| NFR-010 | UI is usable on mobile screen sizes | P0 |
| NFR-011 | Audio can be disabled | P1 |
| NFR-012 | Parent dashboard uses clear language | P1 |

---

## 19. Acceptance Criteria for MVP

The MVP is acceptable when:

1. A parent can create a student profile.
2. The student can start a daily practice session.
3. The app asks multiplication and division facts.
4. The app tracks correct/wrong answers.
5. The app tracks response time.
6. The app schedules the next review.
7. The app chooses weak/due items more often than mastered items.
8. The app shows a 12×12 mastery grid.
9. The app can speak questions aloud.
10. The app stores progress locally.
11. The app works offline after installation as a PWA.
12. Unit tests pass for:
   - answer checking
   - question generation
   - scheduling
   - mastery update

---

## 20. Example User Stories

### Student stories

```text
As a student, I want to practice the facts I am weak on, so I can improve faster.
```

```text
As a student, I want the app to speak problems aloud, so I can practice by listening.
```

```text
As a student, I want to see my multiplication grid, so I know what I have mastered.
```

### Parent stories

```text
As a parent, I want to see which facts my child struggles with, so I can help efficiently.
```

```text
As a parent, I want short daily sessions, so practice becomes sustainable.
```

```text
As a parent, I want local-first storage, so the app does not collect unnecessary child data.
```

### Future teacher/tutor stories

```text
As a tutor, I want to assign a topic, so the student can practice targeted skills.
```

---

## 21. Future Expansion: Competition Path

After the school foundation is solid, unlock optional challenge paths.

### 21.1 Math Kangaroo-style path

Focus:

- Visual reasoning
- Patterns
- Logic
- Spatial reasoning
- Clever arithmetic
- Geometry puzzles

### 21.2 Noetic-style path

Focus:

- Elementary problem solving
- Multi-step reasoning
- Number sense
- Logic
- Word problems

### 21.3 AMC 8 foundation path

For later advanced students:

- Ratios
- Counting
- Probability
- Geometry
- Number theory
- Estimation
- Graph interpretation
- Algebraic thinking

### 21.4 MATHCOUNTS future path

For grades 6–8 later:

- Speed + accuracy
- Number theory
- Algebra
- Geometry
- Combinatorics
- Probability

---

## 22. Recommended Coding AI Workflow

### Best fit for this project

**Recommended primary coding AI: Claude Code.**

Reason:

- This project requires a coding agent that can read a whole repository, edit many files, run commands, and iterate through tests.
- The project is better suited to a terminal/agent workflow than only autocomplete.
- The user already uses PowerShell and has explored Claude Code CLI.
- A Markdown PRD like this is ideal input for a repo-level coding agent.

### Suggested tool roles

| Tool | Best role |
|---|---|
| Claude Code | Primary implementation agent for repo-wide changes |
| Cursor | Best if you want an AI-first IDE with visual code editing |
| GitHub Copilot | Great for autocomplete and smaller coding tasks |
| Gemini CLI | Useful free/open-source terminal alternative and codebase assistant |
| ChatGPT | Product design, architecture review, debugging explanations, code review |

### Recommended workflow

1. Use ChatGPT to refine PRD and architecture.
2. Put this file in the repo as `docs/mathladder-prd.md`.
3. Create an `AGENTS.md` with coding rules.
4. Use Claude Code to implement in small steps.
5. Use GitHub after every milestone.
6. Use Playwright/Vitest tests to keep the coding AI grounded.
7. Ask ChatGPT to review architecture and code diffs when needed.

### Suggested AGENTS.md content

```markdown
# AGENTS.md

## Project
MathLadder is a local-first PWA for adaptive Grade 3–5 math practice.

## Rules
- Use React + TypeScript + Vite.
- Keep the MVP local-first.
- Use IndexedDB/Dexie for persistence.
- Do not add backend auth unless explicitly requested.
- Prioritize multiplication/division MVP first.
- Make small, testable changes.
- Write tests for scheduler, answer checker, and question generator.
- Keep child safety in mind.
- No public leaderboard.
- No ads.
- No open chat for children.
- Run tests before declaring a task complete.

## Development order
1. Project scaffold.
2. Data model.
3. Question generator.
4. Answer checker.
5. Scheduler.
6. Practice UI.
7. Mastery grid.
8. Audio mode.
9. Parent dashboard.
10. Tests and polish.
```

---

## 23. Research and Reference Links

Use these links for grounding; do not treat this project as a substitute for a teacher, tutor, or formal curriculum.

### California standards

- California Common Core State Standards for Mathematics PDF: https://www.cde.ca.gov/be/st/ss/documents/ccssmathstandardaug2013.pdf
- California 3.OA.7: https://www2.cde.ca.gov/cacs/id/web/338
- California 3.OA.3: https://www2.cde.ca.gov/cacs/id/web/333
- California 4.NBT.5: https://www2.cde.ca.gov/cacs/id/web/374
- California 4.NBT.6: https://www2.cde.ca.gov/cacs/id/web/375
- California 5.NBT.5: https://www2.cde.ca.gov/cacs/id/web/408
- California 5.NBT.6: https://www2.cde.ca.gov/cacs/id/web/409
- California 5.NF.1: https://www2.cde.ca.gov/cacs/id/web/411
- California 5.NF.3: https://www2.cde.ca.gov/cacs/id/web/413
- California 5.NF.6: https://www2.cde.ca.gov/cacs/id/web/418
- California Standards for Mathematical Practice: https://www.cde.ca.gov/be/st/ss/mathpractices.asp

### Evidence-based math instruction

- IES/WWC elementary math intervention practice guide: https://ies.ed.gov/ncee/wwc/PracticeGuide/26
- IES/WWC fractions practice guide: https://ies.ed.gov/ncee/wwc/practiceguide/15
- IES/WWC problem solving grades 4–8 guide: https://ies.ed.gov/ncee/wwc/PracticeGuide/16
- NCTM procedural fluency position statement: https://www.nctm.org/Standards-and-Positions/Position-Statements/Procedural-Fluency-in-Mathematics/
- Interleaved practice research example: https://pmc.ncbi.nlm.nih.gov/articles/PMC8589969/

### Competitions

- Math Kangaroo: https://mathkangaroo.org/mks/
- Noetic Learning Math Contest: https://www.noetic-learning.com/mathcontest/
- AMC 8 / MAA: https://maa.org/student-programs/amc/
- MATHCOUNTS: https://www.mathcounts.org/

### Coding AI

- Claude Code docs: https://code.claude.com/docs/en/overview
- Cursor docs: https://cursor.com/en-US/docs
- GitHub Copilot docs: https://docs.github.com/copilot
- GitHub Copilot coding agent: https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent
- Gemini CLI docs: https://developers.google.com/gemini-code-assist/docs/gemini-cli

---

## 24. Immediate Next Implementation Task List

Use this as the first task list for a coding agent.

### Task 1: Scaffold

- Create React + TypeScript + Vite app.
- Add routing.
- Add basic mobile-friendly layout.
- Add PWA support.
- Add testing setup.

### Task 2: Curriculum seed data

- Generate multiplication facts 0–12.
- Generate division fact families.
- Add tags and skill IDs.
- Add grade-level mapping.

### Task 3: Answer engine

- Implement answer checking.
- Normalize numeric input.
- Track latency.
- Classify response grade.

### Task 4: Scheduler

- Implement due-item selection.
- Implement mastery update.
- Implement next review interval.
- Add tests.

### Task 5: Practice UI

- Show question.
- Numeric keypad.
- Submit/enter support.
- Feedback.
- Next question.
- Session summary.

### Task 6: Mastery grid

- 12×12 grid.
- Cell colors by mastery.
- Click cell for details.
- Show weak facts list.

### Task 7: Audio

- Speak prompt.
- Speak feedback.
- Repeat button.
- Mute setting.

### Task 8: Parent dashboard

- Weekly summary.
- Weak facts.
- Time practiced.
- Accuracy trend.
- Suggested next focus.

### Task 9: Polish

- Mobile UI.
- Offline install.
- Export/import.
- Accessibility.
- Tests.

---

## 25. Long-Term Vision

MathLadder can grow from a simple times-table practice app into a full adaptive elementary math foundation system.

Long-term product layers:

```text
Layer 1: Facts and fluency
Layer 2: Visual models and concepts
Layer 3: Word problems and schemas
Layer 4: Fractions and decimals
Layer 5: Geometry and measurement
Layer 6: Competition-style reasoning
Layer 7: Personalized math talent path
```

The key differentiator is the combination of:

```text
adaptive diagnosis + spaced review + visual reasoning + audio practice + competition pathway
```

This makes the app stronger than a simple flashcard tool or worksheet generator.
