export type PracticeDoneDestination = 'dashboard' | 'mastery-map' | 'stats';

export function resolvePracticeDoneDestination(practiceReturn: string): PracticeDoneDestination {
  return practiceReturn === 'mastery-map' || practiceReturn === 'stats'
    ? practiceReturn
    : 'dashboard';
}
