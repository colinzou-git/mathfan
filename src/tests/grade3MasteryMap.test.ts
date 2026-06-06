import { describe, it, expect } from 'vitest';
import {
  GRADE3_MASTERY_MAP,
  getGrade3Skill,
  getGrade3SkillsByDomain,
  isGrade3SkillId,
} from '../features/mastery/grade3MasteryMap';
import type { Grade3Domain, MasterySkillNode } from '../features/mastery/grade3MasteryMap';

// ── Map shape ──────────────────────────────────────────────────────────────────

describe('GRADE3_MASTERY_MAP', () => {
  it('has between 19 and 25 skills', () => {
    expect(GRADE3_MASTERY_MAP.length).toBeGreaterThanOrEqual(19);
    expect(GRADE3_MASTERY_MAP.length).toBeLessThanOrEqual(25);
  });

  it('every skill has a non-empty id, title, description', () => {
    for (const skill of GRADE3_MASTERY_MAP) {
      expect(skill.id.length).toBeGreaterThan(0);
      expect(skill.title.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });

  it('all skill ids are unique', () => {
    const ids = GRADE3_MASTERY_MAP.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all prerequisite ids reference existing skills', () => {
    const ids = new Set(GRADE3_MASTERY_MAP.map(s => s.id));
    for (const skill of GRADE3_MASTERY_MAP) {
      for (const prereq of skill.prerequisites) {
        expect(ids.has(prereq), `unknown prerequisite "${prereq}" on skill "${skill.id}"`).toBe(true);
      }
    }
  });

  it('covers all six Grade3Domains', () => {
    const domains = new Set(GRADE3_MASTERY_MAP.map(s => s.domain));
    const expected: Grade3Domain[] = ['multiplication', 'division', 'fractions', 'area_perimeter', 'geometry', 'addition_subtraction'];
    for (const d of expected) {
      expect(domains.has(d), `missing domain "${d}"`).toBe(true);
    }
  });

  it('every skill has at least one californiaStandardId', () => {
    for (const skill of GRADE3_MASTERY_MAP) {
      expect(skill.californiaStandardIds.length, `"${skill.id}" has no standard IDs`).toBeGreaterThan(0);
    }
  });
});

// ── getGrade3Skill ─────────────────────────────────────────────────────────────

describe('getGrade3Skill', () => {
  it('returns the skill for a known id', () => {
    const skill = getGrade3Skill('g3-mul-meaning');
    expect(skill).toBeDefined();
    expect(skill!.id).toBe('g3-mul-meaning');
    expect(skill!.domain).toBe('multiplication');
  });

  it('returns undefined for an unknown id', () => {
    expect(getGrade3Skill('not-a-real-skill')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(getGrade3Skill('')).toBeUndefined();
  });

  it('result is the same object that is in the map', () => {
    const skill = getGrade3Skill('g3-frac-unit') as MasterySkillNode;
    expect(GRADE3_MASTERY_MAP).toContain(skill);
  });
});

// ── getGrade3SkillsByDomain ────────────────────────────────────────────────────

describe('getGrade3SkillsByDomain', () => {
  it('returns only skills belonging to the requested domain', () => {
    const skills = getGrade3SkillsByDomain('fractions');
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every(s => s.domain === 'fractions')).toBe(true);
  });

  it('multiplication domain has at least 3 skills', () => {
    expect(getGrade3SkillsByDomain('multiplication').length).toBeGreaterThanOrEqual(3);
  });

  it('division domain has at least 2 skills', () => {
    expect(getGrade3SkillsByDomain('division').length).toBeGreaterThanOrEqual(2);
  });

  it('area_perimeter domain has at least 2 skills', () => {
    expect(getGrade3SkillsByDomain('area_perimeter').length).toBeGreaterThanOrEqual(2);
  });

  it('geometry domain has at least 1 skill', () => {
    expect(getGrade3SkillsByDomain('geometry').length).toBeGreaterThanOrEqual(1);
  });

  it('all six domains together account for all skills', () => {
    const domains: Grade3Domain[] = ['multiplication', 'division', 'fractions', 'area_perimeter', 'geometry', 'addition_subtraction'];
    const total = domains.reduce((sum, d) => sum + getGrade3SkillsByDomain(d).length, 0);
    expect(total).toBe(GRADE3_MASTERY_MAP.length);
  });
});

// ── isGrade3SkillId ────────────────────────────────────────────────────────────

describe('isGrade3SkillId', () => {
  it('returns true for every id in the map', () => {
    for (const skill of GRADE3_MASTERY_MAP) {
      expect(isGrade3SkillId(skill.id)).toBe(true);
    }
  });

  it('returns false for an unknown id', () => {
    expect(isGrade3SkillId('g3-fake-skill')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isGrade3SkillId('')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isGrade3SkillId('G3-MUL-MEANING')).toBe(false);
  });
});
