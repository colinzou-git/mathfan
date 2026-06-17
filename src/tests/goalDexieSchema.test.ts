import { describe, expect, it } from 'vitest';
import { MathFanDB } from '../db/dexie';

describe('goal Dexie schema', () => {
  it('declares goal tables in the database schema', () => {
    const db = new MathFanDB();
    const tableNames = db.tables.map(table => table.name);

    expect(tableNames).toContain('learningGoals');
    expect(tableNames).toContain('goalEvents');
    expect(tableNames).toContain('goalEvaluations');

    db.close();
  });
});
