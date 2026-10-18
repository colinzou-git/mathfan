import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getCurriculumSkill } from '../features/curriculum/curriculumRegistry';
import { SkillDetailPanel } from '../features/mastery/SkillDetailPanel';

const plannerMocks = vi.hoisted(() => ({
  planPracticeForSkill: vi.fn(),
}));

vi.mock('../features/mastery/skillPracticePlanner', () => ({
  planPracticeForSkill: plannerMocks.planPracticeForSkill,
}));

afterEach(() => {
  cleanup();
  plannerMocks.planPracticeForSkill.mockReset();
});

const factorPairsSkill = getCurriculumSkill('g4-oa-factor-pairs')!;
const advancedFactsTitle = getCurriculumSkill('g3-mul-tables-advanced')!.title;

describe('SkillDetailPanel Quick Refresh prerequisite targeting', () => {
  it('refreshes the actual unmet prerequisite instead of prerequisites[0]', () => {
    plannerMocks.planPracticeForSkill.mockReturnValue({
      mode: 'multiplication',
      specificItemIds: ['MUL_6x7', 'MUL_7x8', 'MUL_8x9', 'MUL_9x9'],
      sessionLength: 3,
    });
    const onBridge = vi.fn();

    render(
      <SkillDetailPanel
        skill={factorPairsSkill}
        unmetPrereqIds={['g3-mul-tables-advanced']}
        unmetPrereqNames={[advancedFactsTitle]}
        onClose={() => {}}
        onPracticeSkill={() => {}}
        onReviewDue={() => {}}
        onBridge={onBridge}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`quick refresh: ${advancedFactsTitle}`, 'i') }));

    expect(plannerMocks.planPracticeForSkill).toHaveBeenCalledOnce();
    expect(plannerMocks.planPracticeForSkill).toHaveBeenCalledWith('g3-mul-tables-advanced', { sessionLength: 3 });
    expect(plannerMocks.planPracticeForSkill).not.toHaveBeenCalledWith('g4-oa-factor-meaning', expect.anything());
    expect(onBridge).toHaveBeenCalledWith({
      mode: 'multiplication',
      specificItemIds: ['MUL_6x7', 'MUL_7x8', 'MUL_8x9'],
      sessionLength: 3,
      returnToSkillId: 'g4-oa-factor-pairs',
    });
  });

  it('does not offer Quick Refresh when every prerequisite is satisfied', () => {
    render(
      <SkillDetailPanel
        skill={factorPairsSkill}
        unmetPrereqIds={[]}
        unmetPrereqNames={[]}
        onClose={() => {}}
        onPracticeSkill={() => {}}
        onReviewDue={() => {}}
        onBridge={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: /quick refresh/i })).toBeNull();
    expect(plannerMocks.planPracticeForSkill).not.toHaveBeenCalled();
  });

  it('uses the first actual unmet prerequisite in curriculum priority order', () => {
    plannerMocks.planPracticeForSkill.mockReturnValue({
      mode: 'multiplication',
      specificItemIds: ['G4OA4_factor_meaning_model_21_0'],
      sessionLength: 3,
    });

    render(
      <SkillDetailPanel
        skill={factorPairsSkill}
        unmetPrereqIds={['g4-oa-factor-meaning', 'g3-mul-tables-advanced']}
        unmetPrereqNames={[
          getCurriculumSkill('g4-oa-factor-meaning')!.title,
          advancedFactsTitle,
        ]}
        onClose={() => {}}
        onPracticeSkill={() => {}}
        onReviewDue={() => {}}
        onBridge={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /quick refresh/i }));
    expect(plannerMocks.planPracticeForSkill).toHaveBeenCalledWith('g4-oa-factor-meaning', { sessionLength: 3 });
  });
});
