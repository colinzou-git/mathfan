\# MathFan Claude Instructions


MathFan is a React + TypeScript + Vite local-first PWA for elementary math practice.



\## Core rules

\- Before search repo code, read docs/code-map/CLAUDE_START_HERE.md first, then CODEMAP.md and SYMBOLS.md. Use code_map.json and symbols.json for lookup before scanning source files.

\- Do not remove existing features.

\- Do not redesign unrelated UI.

\- Preserve current FSRS scheduling behavior.

\- Preserve existing quiz, practice, stats, sync, and AI tutor behavior unless explicitly requested.

\- Use `mathAnswerEvents` as source of truth where possible.

\- Treat `itemStates`, `multFactStats`, and future `studentSkillStates` as derived caches.

\- Keep child-facing wording positive, encouraging, and non-shaming.

\- Prefer small, testable changes.

\- Ask User questions if any before implement code.

\- Add tests for new logic.

\- Run `npm run ci` after changes.

\- Make one commit per completed bug fixe or feature.


If CI fails:

\- Fix the issue if it is clearly caused by your changes.

\- If still failing, suggest debug actions from user.

At the end of a run, do the following:
Report the new source files introduced. If no new source files, say 'No new source files added.'
If any new source files were introduced, then update .\tools\generate_code_maps.py to cover new source files. Report updating status in a short sentence after each check/update. If no update, say reasons in a short sentence.
Run 'python .\tools\generate_code_maps.py' to update code map and symbol map. Report running results in one short sentence after run. if no run, say reasons in a short sentence.




