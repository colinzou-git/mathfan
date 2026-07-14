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

describe('learner identity Dexie schema', () => {
  it('indexes students by learnerKey for future-profile lookup', () => {
    const db = new MathFanDB();
    const studentsSchema = db.tables.find(t => t.name === 'students')?.schema;

    expect(studentsSchema?.idxByName['learnerKey']).toBeDefined();

    db.close();
  });
});
