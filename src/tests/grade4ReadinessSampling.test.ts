import { describe, expect, it } from 'vitest';
import { GRADE4_SKILLS } from '../features/curriculum/curriculumRegistry';
import { buildReadinessPlan, READINESS_MAX_QUESTIONS, readinessProbeSkillIds, readinessRecommendations, readinessSessionId } from '../features/diagnosis/readinessPlanner';

describe('versioned, bounded Grade 4 readiness', () => {
  it('keeps thirteen entry probes even with eighty registered skills', () => {
    const expanded = [...GRADE4_SKILLS, ...Array.from({ length: 80 }, (_, i) => ({ id: `future-${i}` }))];
    expect(readinessProbeSkillIds(2, expanded)).toEqual(readinessProbeSkillIds(2));
    expect(readinessProbeSkillIds(2, expanded)).toHaveLength(13);
    expect(buildReadinessPlan('g4-readiness:s:v2').items).toHaveLength(20);
  });
  it('preserves every answered prefix, resumes deterministically, and caps contrasts at two', () => {
    for (const version of [1, 2]) {
      const id = `g4-readiness:s:v${version}`;
      const results: Parameters<typeof buildReadinessPlan>[1] = [];
      while (results.length < buildReadinessPlan(id, results).items.length) {
        const before = buildReadinessPlan(id, results);
        const item = before.items[results.length];
        results.push({ item, isCorrect: false });
        const resumed = buildReadinessPlan(id, JSON.parse(JSON.stringify(results)));
        expect(resumed.items.slice(0, results.length).map(item => item.id)).toEqual(results.map(result => result.item.id));
        expect(resumed.items.length).toBeLessThanOrEqual(READINESS_MAX_QUESTIONS);
      }
      expect(results).toHaveLength(22);
    }
  });
  it('keeps legacy item IDs and prefers an existing current session', () => {
    const legacy = buildReadinessPlan('g4-readiness:s:v1');
    expect(legacy.items[7].id).toBe('G4F1~g4-oa-factor-meaning~model~0~300');
    expect(legacy.items[19].id).toBe('G4F1~g4-nbt-estimate-check~model~0~312');
    expect(readinessSessionId('s', [{ sessionId: legacy.sessionId }])).toBe(legacy.sessionId);
    expect(readinessSessionId('s', [{ sessionId: legacy.sessionId }, { sessionId: 'g4-readiness:s:v2' }])).toBe('g4-readiness:s:v2');
    expect(readinessSessionId('s', [{ sessionId: 'g4-readiness:someone-else:v1' }])).toBe('g4-readiness:s:v2');
  });
  it('prioritizes observed difficulties without calling unprobed skills failures', () => {
    const items = buildReadinessPlan('g4-readiness:s:v2').items;
    const observed = items.filter(item => item.gradeLevel === 4).map((item, i) => ({ item, isCorrect: i !== 2 }));
    expect(readinessRecommendations(observed).startSkillId).toBe(observed[2].item.skillId);
    expect(readinessRecommendations(observed).refreshSkillIds).toEqual([]);
  });
});
