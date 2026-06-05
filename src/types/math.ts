export type GradeLevel = 3 | 4 | 5;
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
export type MasteryLevel = 'new' | 'learning' | 'developing' | 'strong' | 'mastered';
export type SessionLength = number; // any positive integer

export type ItemType =
  | 'multiplication_fact'
  | 'division_fact'
  | 'unknown_factor'
  | 'addition_fact'
  | 'subtraction_fact'
  | 'fraction_equivalent'
  | 'fraction_compare'
  | 'word_problem'
  | 'rounding'
  | 'prime_composite'
  | 'factor_check'
  | 'decimal_add'
  | 'decimal_sub'
  | 'fraction_number_line'
  | 'decimal_place_value'
  | 'geometry_vocabulary'
  | 'competition_puzzle'
  | 'area_unit_squares'
  | 'area_rectangle'
  | 'perimeter_rectangle'
  | 'rectilinear_area'
  | 'multiplication_properties';

export type SessionMode =
  | 'daily_review'
  | 'single_table'
  | 'multi_table'
  | 'multiplication'
  | 'addition'
  | 'subtraction'
  | 'division'
  | 'fraction'
  | 'word_problem'
  | 'rounding'
  | 'factors'
  | 'decimals'
  | 'audio'
  | 'challenge'
  | 'area'
  | 'geometry';

/** How the student enters an answer for an item. */
export type AnswerInput = 'numeric' | 'choice';

export type FractionMode = 'equivalent' | 'compare';

export interface StudentProfile {
  id: string;
  displayName: string;
  gradeLevel: GradeLevel;
  timezone: string;
  createdAt: string;
  settings: StudentSettings;
}

export interface StudentSettings {
  audioEnabled: boolean;
  speechRate: number;
  dailyGoalMinutes: number;
  sessionLength: SessionLength;
  autoAdvance: boolean;
  theme: ThemeName;
  allowTimedMode: boolean;
  competitionModeEnabled: boolean;
  parentModeEnabled: boolean;
}

// Forward-declare ThemeName here so StudentSettings can reference it without a circular import
export type ThemeName =
  | 'indigo' | 'dark-blue' | 'light-blue' | 'high-contrast'
  | 'sunrise' | 'light-green' | 'orange';

export interface Skill {
  id: string;
  gradeLevel: GradeLevel;
  domain: string;
  topic: string;
  title: string;
  description: string;
  californiaStandardIds: string[];
  prerequisites: string[];
}

export interface PracticeItem {
  id: string;
  skillId: string;
  itemType: ItemType;
  prompt: string;
  answer: string | number;
  choices?: Array<string | number>;
  /** How the answer is entered. Defaults to 'numeric' when omitted. */
  answerInput?: AnswerInput;
  explanation?: string;
  visualModelType?: 'array' | 'number_line' | 'area_model' | 'place_value' | 'none';
  tags: string[];
  difficulty: number;
  factA?: number;
  factB?: number;
}

export interface StudentItemState {
  studentId: string;
  itemId: string;
  skillId: string;
  attemptCount: number;
  correctCount: number;
  lastAnswer?: string;
  lastCorrect: boolean;
  lastLatencyMs: number;
  medianLatencyMs: number;
  personalBestMs?: number;
  ease: number;
  /** FSRS stability S (days). 0 = never successfully reviewed. */
  stabilityDays: number;
  /** Item intrinsic difficulty (0–1), copied from the PracticeItem. */
  difficulty: number;
  /** FSRS per-card difficulty D (1–10). 0 = uninitialised. */
  fsrsDifficulty?: number;
  /** Total scheduled reviews (FSRS reps). */
  reps?: number;
  /** Times the card lapsed (answered "again" when it was due). */
  lapses?: number;
  /** ts-fsrs State enum value (0=New,1=Learning,2=Review,3=Relearning). Absent = inferred from reps. */
  fsrsCardState?: number;
  /** Days the card was scheduled for at the last review. */
  fsrsScheduledDays?: number;
  /** ts-fsrs learning_steps progress. Always 0 with enable_short_term=false; stored for forward compatibility. */
  fsrsLearningSteps?: number;
  masteryLevel: MasteryLevel;
  lastSeenAt?: string;
  nextDueAt?: string;
  mistakePatterns: string[];
}

export interface AttemptLog {
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
  reviewGrade: ReviewGrade;
  createdAt: string;
}

export interface PracticeSession {
  id: string;
  studentId: string;
  startedAt: string;
  endedAt?: string;
  mode: SessionMode;
  tables?: number[];
  plannedQuestionCount: number;
  completedQuestionCount: number;
  correctCount: number;
  // First-try fluency metrics (optional; absent on sessions saved before this feature).
  firstTryCount?: number;
  correctedCount?: number;
  repeatedCount?: number;
  slowFirstTryCount?: number;
  attemptCount?: number;
  averageLatencyMs: number;
  fastestCorrectMs?: number;
}

// ── Stats types ───────────────────────────────────────────────────────────────

export interface DayStats {
  date: string;                    // YYYY-MM-DD local
  questionsAnswered: number;
  correctCount: number;
  accuracy: number;                // 0–1
  sessionCount: number;
  minutesPracticed: number;
  averageCorrectLatencyMs: number; // 0 when no correct answers
  fastestCorrectLatencyMs: number; // 0 when no correct answers
}

export interface PeriodStats {
  questions: number;
  correct: number;
  accuracy: number;
  minutesPracticed: number;
  daysActive: number;
  averageCorrectLatencyMs: number;
}

export interface PeriodComparison {
  thisWeek: PeriodStats;
  lastWeek: PeriodStats;
  thisMonth: PeriodStats;
  lastMonth: PeriodStats;
}

export interface PerTableStats {
  table: number;                      // 2–13
  totalSessions: number;
  totalQuestions: number;
  accuracy: number;                   // 0–1
  bestAverageLatencyMs: number | null;
  recentAverageLatencyMs: number | null; // last session with that table
  recentSessionSpeeds: number[];      // avg speed per session (up to 10, oldest first)
}

export interface SessionConfig {
  mode: SessionMode;
  tables?: number[];          // single_table / multi_table (legacy sessions)
  /** When set, practice exactly these item IDs (repeated to fill sessionLength) instead of generating from tables/ranges. */
  specificItemIds?: string[];
  sessionLength: SessionLength;
  /**
   * First operand range. Meaning depends on mode:
   * multiplication → first multiplier · division → dividend · addition/subtraction
   * → first number · fraction → numerator · word/rounding/factors/decimals → value.
   */
  operandMin?: number;
  operandMax?: number;
  /**
   * Second operand range (modes with two independent operands):
   * multiplication → second multiplier · division → divisor · addition/subtraction
   * → second number · fraction → denominator.
   */
  operand2Min?: number;
  operand2Max?: number;
  fractionMode?: FractionMode; // fraction
  grade?: GradeLevel;         // word_problem / rounding / factors / decimals
}

// ── Growth comparison (period over period) ─────────────────────────────────────

export type GrowthDirection = 'stronger' | 'weaker' | 'same' | 'new';

export interface FactWindowStats {
  attempts: number;
  correct: number;
  accuracy: number;            // 0–1
  avgCorrectLatencyMs: number; // 0 when no correct answers
}

export interface FactGrowth {
  itemId: string;
  prompt: string;
  direction: GrowthDirection;
  current: FactWindowStats;
  previous: FactWindowStats | null; // null when fact is new this period
  accuracyDelta: number;            // current.accuracy − previous.accuracy (0 for new)
  speedDeltaMs: number;             // previous − current latency (positive = faster now)
}

export interface GrowthSummary {
  stronger: FactGrowth[];
  weaker: FactGrowth[];
  same: FactGrowth[];
  newFacts: FactGrowth[];
}
