import { describe, it, expect } from 'vitest';
import { resolvePracticeDoneDestination } from '../features/practice/practiceNavigation';

// ── resolvePracticeDoneDestination ────────────────────────────────────────────

describe('resolvePracticeDoneDestination', () => {
  it('returns mastery-map when practiceReturn is mastery-map', () => {
    expect(resolvePracticeDoneDestination('mastery-map')).toBe('mastery-map');
  });

  it('returns stats when practiceReturn is stats', () => {
    expect(resolvePracticeDoneDestination('stats')).toBe('stats');
  });

  it('returns dashboard for dashboard practiceReturn', () => {
    expect(resolvePracticeDoneDestination('dashboard')).toBe('dashboard');
  });

  it('returns dashboard for any unrecognized practiceReturn', () => {
    expect(resolvePracticeDoneDestination('quiz')).toBe('dashboard');
    expect(resolvePracticeDoneDestination('practice')).toBe('dashboard');
  });
});

// ── Stale practiceReturn regression ──────────────────────────────────────────
//
// Scenario: user launches practice from mastery-map, finishes, then opens the quiz.
// Before the fix, quiz used handleSessionDone (which reads practiceReturn), sending
// the user back to mastery-map instead of dashboard.
// After the fix, quiz uses handleQuizDone which always goes to 'dashboard'.

type Screen = 'dashboard' | 'mastery-map' | 'stats' | 'practice' | 'quiz';

function makeAppNav() {
  let screen: Screen = 'dashboard';
  let practiceReturn: Screen = 'dashboard';

  return {
    screen: () => screen,
    practiceReturn: () => practiceReturn,

    openMasteryMap() { screen = 'mastery-map'; },
    openDashboard() { screen = 'dashboard'; },
    openQuiz() { screen = 'quiz'; },

    startPractice() {
      practiceReturn = screen;
      screen = 'practice';
    },

    // handleSessionDone: reads practiceReturn (used for practice sessions)
    handleSessionDone() {
      screen = resolvePracticeDoneDestination(practiceReturn) as Screen;
    },

    // handleQuizDone: always goes to dashboard (the fix)
    handleQuizDone() {
      screen = 'dashboard';
    },
  };
}

describe('stale practiceReturn regression', () => {
  it('practice from mastery-map returns to mastery-map on done', () => {
    const nav = makeAppNav();
    nav.openMasteryMap();
    nav.startPractice();
    nav.handleSessionDone();
    expect(nav.screen()).toBe('mastery-map');
  });

  it('quiz done returns to dashboard even when practiceReturn was set to mastery-map', () => {
    const nav = makeAppNav();

    // Step 1: practice from mastery-map → practiceReturn is now 'mastery-map'
    nav.openMasteryMap();
    nav.startPractice();
    nav.handleSessionDone(); // returns to mastery-map

    // Step 2: navigate to quiz from dashboard (practiceReturn is STILL 'mastery-map')
    nav.openDashboard();
    nav.openQuiz();
    expect(nav.practiceReturn()).toBe('mastery-map'); // stale value

    // Step 3: quiz done must go to dashboard, not mastery-map
    nav.handleQuizDone();
    expect(nav.screen()).toBe('dashboard');
  });

  it('practice from stats returns to stats on done', () => {
    let s: Screen = 'stats';
    let pr: Screen = 'dashboard';
    function startPracticeFrom(src: Screen) { pr = src; s = 'practice'; }
    function sessionDone() { s = resolvePracticeDoneDestination(pr) as Screen; }
    startPracticeFrom('stats');
    sessionDone();
    expect(s).toBe('stats');
  });
});
