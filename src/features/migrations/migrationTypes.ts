import type { StudentItemState } from '../../types/math';

/** Pre-#26 shape of a `StudentItemState` row, keyed by exact item id instead of cardKey. */
export interface LegacyStudentItemState extends Omit<StudentItemState, 'cardKey' | 'lastItemId'> {
  itemId: string;
}

export type DataMigrationKind = 'hybrid-card-v1';
export type DataMigrationStatus = 'started' | 'completed' | 'failed' | 'rolled_back';

export interface DataMigrationRun {
  id: string;
  kind: DataMigrationKind;
  status: DataMigrationStatus;
  startedAt: string;
  completedAt?: string;
  sourceEventCount: number;
  outputCardCount?: number;
  error?: string;
}

export interface MigrationBackup {
  id: string;
  migrationRunId: string;
  createdAt: string;
  /**
   * Legacy (pre-schema-v8, itemId-keyed) rows for the one-time automatic backup
   * captured during the Dexie v7 upgrade, or current-shape (cardKey-keyed) rows
   * for an app-level cardStateMigration re-run's own rollback safety net.
   */
  itemStates: LegacyStudentItemState[] | StudentItemState[];
}
