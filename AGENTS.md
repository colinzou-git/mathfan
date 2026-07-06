# MathFan Codex Instructions

MathFan is a React + TypeScript + Vite local-first PWA for elementary math practice.

## Start here

Before scanning source files, read:

1. `CLAUDE.md`
2. `docs/code-map/CLAUDE_START_HERE.md`
3. `docs/code-map/CODEMAP.md`
4. `docs/code-map/SYMBOLS.md`

Use `docs/code-map/code_map.json` for targeted lookup before broad repository searches.

## Project rules

- Do not remove existing features or redesign unrelated UI.
- Preserve FSRS scheduling behavior unless the task explicitly changes it.
- Preserve quiz, practice, stats, sync, and AI tutor behavior unless explicitly requested.
- Treat `mathAnswerEvents` as the source of truth where possible.
- Treat `itemStates` and `multFactStats` as derived caches.
- Keep child-facing wording positive, encouraging, and non-shaming.
- Prefer small, testable changes.
- Add regression coverage for every confirmed bug.

## Required validation

Run the normal code checks after every implementation change:

```bash
npm run ci
```

For UI, navigation, persistence, input, PWA-update, or browser-facing changes, also run the browser suite:

```bash
python -m pip install -r requirements-e2e.txt
python -m playwright install chromium
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# In another terminal:
npm run test:e2e
```

The browser suite must exercise the real built app rather than a component mock. Do not replace failed browser checks with unit tests.

## Codex browser workflow

When the Codex Browser plugin is available:

1. Start or verify the local preview server at `http://127.0.0.1:4173`.
2. Use `@Browser` for exploratory reproduction, clicks, typing, screenshots, DOM inspection, console inspection, and visual verification.
3. Test desktop, mobile, and iPad-sized viewports when layout is affected.
4. Convert any reproduced bug into an automated check in `scripts/e2e_mathfan.py` or `scripts/smoke-update-flow.py`.
5. Re-run `npm run test:e2e` after the fix.

The in-app browser is not a substitute for repeatable automated tests. Do not use real Google credentials in browser automation; mock network/auth behavior instead.

## Completion

- Keep commits focused.
- Run `python tools/generate_code_maps.py` when files or exported symbols change.
- Report new files, tests run, and any validation that could not be completed.
