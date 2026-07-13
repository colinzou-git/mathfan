import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock, tableNames, transactionMock } = vi.hoisted(() => {
  const names = [
    'students', 'itemStates', 'attempts', 'sessions', 'multFactStats',
    'quizSessions', 'mathAnswerEvents', 'learningGoals', 'goalEvents', 'goalEvaluations',
  ] as const;
  let insideTransaction = false;
  const database: Record<string, { toArray: ReturnType<typeof vi.fn> }> = {};
  for (const name of names) {
    database[name] = {
      toArray: vi.fn(async () => {
        if (!insideTransaction) throw new Error(`${name} read outside transaction`);
        return name === 'students' ? [{ id: 'student-1' }] : [];
      }),
    };
  }
  const transaction = vi.fn(async (_mode: string, _tables: unknown[], scope: () => Promise<unknown>) => {
    insideTransaction = true;
    try {
      return await scope();
    } finally {
      insideTransaction = false;
    }
  });
  return { dbMock: { ...database, transaction }, tableNames: names, transactionMock: transaction };
});

vi.mock('../db/dexie', () => ({ db: dbMock }));
vi.mock('../features/learning/eventRebuild', () => ({
  rebuildMultFactStatsFromEvents: vi.fn(),
  rebuildItemStatesFromEvents: vi.fn(),
}));

import { buildSnapshot } from '../features/sync/snapshot';

describe('buildSnapshot transaction consistency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads every snapshot table inside one read-only Dexie transaction', async () => {
    const result = await buildSnapshot();
    const tables = dbMock as unknown as Record<string, { toArray: ReturnType<typeof vi.fn> }>;
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(transactionMock.mock.calls[0][0]).toBe('r');
    expect(transactionMock.mock.calls[0][1]).toEqual(tableNames.map(name => tables[name]));
    for (const name of tableNames) expect(tables[name]!.toArray).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      appId: 'mathfan',
      snapshotVersion: 2,
      students: [{ id: 'student-1' }],
      itemStates: [],
      mathAnswerEvents: [],
      goalEvaluations: [],
    });
  });
});
