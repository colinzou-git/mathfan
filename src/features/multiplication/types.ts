export type MasteryState = 'new' | 'weak' | 'learning' | 'strong' | 'mastered' | 'forgotten';

// e.g. "7x8"
export type MultiplicationFactKey = `${number}x${number}`;

export interface MultiplicationFactStats {
  studentId: string;
  key: MultiplicationFactKey;
  left: number;
  right: number;
  answer: number;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  accuracy: number;
  averageResponseTimeMs: number | null;
  lastResponseTimeMs: number | null;
  lastPracticedAt: string | null;
  lastQuizAt: string | null;
  masteryScore: number;
  masteryState: MasteryState;
  streakCorrect: number;
  streakIncorrect: number;
  everTested: boolean;
}

export interface QuizAnswerLog {
  quizId: string;
  factKey: MultiplicationFactKey;
  left: number;
  right: number;
  correctAnswer: number;
  studentAnswer: number | null;
  isCorrect: boolean;
  responseTimeMs: number;
  answeredAt: string;
  previousMasteryScore: number;
  newMasteryScore: number;
  previousMasteryState: MasteryState;
  newMasteryState: MasteryState;
}

export interface QuizSession {
  id: string;
  studentId: string;
  category: 'multiplication';
  quizLength: number;
  startedAt: string;
  completedAt: string | null;
  answerLogs: QuizAnswerLog[];
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  averageResponseTimeMs: number | null;
  weakFactsDiscovered: MultiplicationFactKey[];
  strongFactsConfirmed: MultiplicationFactKey[];
  forgottenFactsDiscovered: MultiplicationFactKey[];
  untestedFactsCovered: MultiplicationFactKey[];
  recommendedPracticeFacts: MultiplicationFactKey[];
}

export interface QuizQuestion {
  factKey: MultiplicationFactKey;
  left: number;
  right: number;
  answer: number;
}
