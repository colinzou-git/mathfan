# Browser Testing for MathFan

MathFan has two browser-level smoke suites:

- `scripts/e2e_mathfan.py` — profile setup, persisted settings, wrong/correct answers, session completion, dashboard updates, and responsive desktop/mobile/iPad navigation.
- `scripts/smoke-update-flow.py` — Settings → Check for Updates, including up-to-date, update-available, and network-error branches.

Both use Python Playwright and drive the real production Vite preview in Chromium.

## One-time setup

```bash
npm ci
python -m pip install -r requirements-e2e.txt
python -m playwright install chromium
```

On Linux CI or a fresh Linux machine, install browser system dependencies too:

```bash
python -m playwright install --with-deps chromium
```

## Run locally

Terminal 1:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Terminal 2:

```bash
npm run test:e2e
```

Optional individual suites:

```bash
npm run test:e2e:journey
npm run test:e2e:update
```

Failure screenshots and Playwright traces are written to `test-results/browser/`.

## Codex app

The repository root `AGENTS.md` instructs Codex to run this suite for browser-facing changes. For exploratory testing:

1. Enable the Codex Browser plugin.
2. Start the preview server.
3. Ask Codex to use `@Browser` with `http://127.0.0.1:4173`.
4. Reproduce the exact state, inspect console/DOM/network behavior, and take screenshots.
5. Add a repeatable regression to one of the Playwright scripts before considering the issue fixed.

The Codex in-app browser is appropriate for local unauthenticated app flows. Real signed-in Google flows should be tested in a regular browser or Chrome integration; automated CI tests should mock authentication and Drive responses rather than use personal credentials.

## CI

`.github/workflows/ci.yml` contains a separate `Browser E2E` job. It:

1. Runs after lint/unit tests/build pass.
2. Installs Python Playwright and Chromium.
3. Builds and starts the Vite preview.
4. Runs all browser suites.
5. Uploads screenshots, traces, and the preview log when a failure occurs.

## Adding coverage

Prefer accessible selectors:

- `get_by_role(...)`
- `get_by_label(...)`
- `get_by_text(...)`

Use `data-testid` only when a stable accessible selector is unavailable. Keep test data deterministic by constraining number ranges and question counts. Block service workers for most browser tests so cached PWA assets do not hide current-build failures; test service-worker/update behavior separately.

## Manual iPhone/iPad export checklist

Chromium automation covers prepared-file UI and download integrity, but it cannot reproduce every iOS transient-user-activation or share-target condition. Before an export-related release, install the built PWA on both iPhone and iPad and verify:

1. Generate JSON and ZIP exports; use a profile with a realistically large practice history for ZIP.
2. Confirm **Share or Save File** appears only after generation finishes.
3. Open the share sheet and save the file to Files.
4. Dismiss the share sheet and confirm the prepared file remains available with a readable message.
5. Retry **Share or Save File** without regenerating the export.
6. Exercise a device with no suitable share target, where reproducible, and a browser permission/blocking failure.
7. Use **Download Instead** after an incomplete share and verify the same filename and non-empty file are delivered.
8. Tap **Cancel** and confirm the prepared-file controls disappear.
