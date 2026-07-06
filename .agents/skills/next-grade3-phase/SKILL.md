\# Next Grade 3 Phase



Use this skill to implement the next unchecked Grade 3 Mastery Map phase.



\## Instructions



1\. Read `AGENTS.md`.

2\. Read `docs/grade3-mastery-map-roadmap.md`.

3\. Find the first section with `Status: TODO`.

4\. Implement only that phase.

5\. Do not implement future phases.

6\. Preserve existing MathFan behavior unless the selected phase explicitly requires a change.

7\. Add or update tests for the phase.

8\. Run: npm run ci

9\. If CI passes:
Change the phase status from TODO to DONE.
Add an implementation note under the phase.
Commit all changes with:
git add .
git commit -m "feat: complete grade3 mastery map phase <N>"

10\. If CI fails:
Fix failures caused by the phase.
Re-run CI.
If still failing, do not commit. Add a note explaining the failure.
At the end, report:
Phase completed
Files changed
Tests added/updated
CI result
Commit hash, if committed
Any follow-up risks


