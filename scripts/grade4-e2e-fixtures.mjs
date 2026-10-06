// Test-only fixture export. The browser suite still drives the real production build.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  if (process.argv[2]) {
    const { makeItemFromId } = await server.ssrLoadModule('/src/features/curriculum/makeItemFromId.ts');
    console.log(JSON.stringify(makeItemFromId(process.argv[2])));
  } else {
  const { GRADE4_SKILLS } = await server.ssrLoadModule('/src/features/curriculum/curriculumRegistry.ts');
  const { foundationItemIds, makeFoundationItem } = await server.ssrLoadModule('/src/features/curriculum/foundationItems.ts');
  const { makeItemFromId } = await server.ssrLoadModule('/src/features/curriculum/makeItemFromId.ts');
  const { buildReadinessPlan } = await server.ssrLoadModule('/src/features/diagnosis/readinessPlanner.ts');
  const { planPracticeForSkill } = await server.ssrLoadModule('/src/features/mastery/skillPracticePlanner.ts');
  const readiness = buildReadinessPlan('fixture').items;
  const bridges = [...new Set(GRADE4_SKILLS.flatMap(skill => skill.prerequisites))].flatMap(id => (planPracticeForSkill(id).specificItemIds ?? []).map(makeItemFromId));
  const items = [...GRADE4_SKILLS.flatMap(skill => foundationItemIds(skill.id).map(makeItemFromId)), ...bridges,
    ...GRADE4_SKILLS.map((skill, index) => makeFoundationItem(skill.id, 'check', 0, 600 + index))];
  const dir = process.env.E2E_RESULTS_DIR || 'test-results/browser';
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/grade4-fixtures.json`, JSON.stringify({ skills: GRADE4_SKILLS, items, readiness }));
  }
} finally { await server.close(); }
