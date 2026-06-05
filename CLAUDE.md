\# MathFan Claude Instructions



MathFan is a React + TypeScript + Vite local-first PWA for elementary math practice.



\## Core rules



\- Do not remove existing features.

\- Do not redesign unrelated UI.

\- Preserve current FSRS scheduling behavior.

\- Preserve existing quiz, practice, stats, sync, and AI tutor behavior unless explicitly requested.

\- Use `mathAnswerEvents` as source of truth where possible.

\- Treat `itemStates`, `multFactStats`, and future `studentSkillStates` as derived caches.

\- Keep child-facing wording positive, encouraging, and non-shaming.

\- Prefer small, testable changes.

\- Add tests for new logic.

\- Run `npm run ci` after changes.

\- Make one commit per completed phase.



\## Current project focus



We are implementing the Grade 3 Mastery Map learning loop:



diagnose → practice → review → update mastery map



The detailed task list is in:



`docs/grade3-mastery-map-roadmap.md`



\## Phase workflow



When asked to work on the Grade 3 roadmap:



1\. Read `docs/grade3-mastery-map-roadmap.md`.

2\. Find the first phase with `Status: TODO`.

3\. Implement only that phase.

4\. Do not start the next phase.

5\. Run `npm run ci`.

6\. Update that phase status to `DONE` if successful.

7\. Add a short implementation note under that phase.

8\. Commit with message:



`feat: complete grade3 mastery map phase N`



If CI fails:

\- Do not mark the phase DONE.

\- Fix the issue if it is clearly caused by your changes.

\- If still failing, add a note under the phase with the failure reason.

