# Cloud Development (iPhone Claude Code + GitHub)

This guide describes how to develop MathFan entirely from the **Claude Code app on
iPhone** against the GitHub repo — no local checkout required. The whole loop runs
through GitHub: branch → change → CI → PR → merge → Pages deploy.

MathFan is a local-first PWA, so once it deploys to GitHub Pages you can install it
to your iPhone home screen and use it offline.

## Before you change anything

1. **Read `CLAUDE.md`** (repo root) for the project rules. Highlights:
   - Do not remove existing features or redesign unrelated UI.
   - Preserve FSRS scheduling, quiz, practice, stats, sync, and AI tutor behavior.
   - Treat `itemStates`, `multFactStats`, `studentSkillStates` as derived caches;
     `mathAnswerEvents` is the source of truth.
   - Keep child-facing wording positive and non-shaming.
2. **Read the code maps before scanning source files** (this is much cheaper than
   reading the whole tree on a phone):
   - `docs/code-map/CLAUDE_START_HERE.md` — start here.
   - `docs/code-map/CODEMAP.md` — module overview.
   - `docs/code-map/SYMBOLS.md` — symbol index.
   - `docs/code-map/DEPENDENCIES.md` — dependency graph.
   - `docs/code-map/code_map.json` — machine-readable lookup; query this first.

## The workflow

### 1. Create a branch

Never commit directly to `main`. Branch from the latest `main`:

```
git checkout main
git pull
git checkout -b <type>/<short-description>   # e.g. fix/quiz-timer, feat/skill-hints
```

### 2. Make small, testable changes

- Keep each branch focused on one bug fix or one feature (one commit per completed
  unit of work, per `CLAUDE.md`).
- Add tests for new logic.
- If you touch anything that affects the code structure, you'll regenerate the code
  maps before the final commit (see step 4).

### 3. Run CI locally before pushing

```
npm install      # first time on a fresh checkout / container
npm run ci       # lint + tests + build (tsc -b && vite build)
```

`npm run ci` is the same gate GitHub Actions runs. If it fails locally, fix it
before opening the PR — don't rely on Actions to catch it.

### 4. Regenerate code maps if structure changed

If you added/removed/renamed source files or exported symbols:

```
python tools/generate_code_maps.py
```

Commit the updated `docs/code-map/*` files alongside your change. These files are
**committed on purpose** (they are no longer git-ignored) so the iPhone workflow can
read them without a local build.

### 5. Commit and push the branch

```
git add -A
git commit -m "<type>: <summary>"
git push -u origin <your-branch>
```

### 6. Open a Pull Request

Open a PR from your branch into `main` and fill in the checklist from
`.github/pull_request_template.md` (changed files, tests run, whether FSRS /
IndexedDB schema / Google sync / PWA-update behavior was touched, and whether code
maps were regenerated).

### 7. Merge only after Actions are green

- The **CI** workflow (`.github/workflows/ci.yml`) runs lint + tests + build on every
  PR. **Wait for it to pass.** Do not merge a red PR.
- Squash/merge into `main` only once all required checks are green.

### 8. Confirm the GitHub Pages deployment

- Merging to `main` triggers the **Deploy to GitHub Pages** workflow
  (`.github/workflows/deploy.yml`): it rebuilds with the production
  `VITE_GOOGLE_CLIENT_ID` / `VITE_BASE_PATH` and publishes `dist/` to Pages.
- Watch the **Actions** tab until the `Deploy` job finishes; its summary links the
  live `page_url`.
- Open the deployed site and verify it serves the new build:
  - In the app, use **Settings → Check for Updates**. It probes `build-info.json`
    over the network and compares the deployed `appVersion` / `gitSha` against the
    running build — the `gitSha` should match the commit you just merged.
  - The service worker activates new builds immediately (`skipWaiting` +
    `clientsClaim`), so a reload picks up the new version.

## Config notes

- **Base path:** `VITE_BASE_PATH` defaults to `/`. For a project site at
  `username.github.io/mathfan/`, set the `VITE_BASE_PATH` repo variable to
  `/mathfan/`. A custom domain (see `public/CNAME`) uses `/`.
- **Google sign-in:** the real `VITE_GOOGLE_CLIENT_ID` lives in repo
  Secrets and is only injected during the deploy build; CI uses a stub, so Google
  sync can't be exercised in CI.
- **PWA icons:** `public/` holds `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`,
  `pwa-192.png`, and `pwa-512.png`. If you change branding, regenerate the raster
  icons from `favicon.svg` and keep `vite.config.ts`'s `includeAssets` / `manifest.icons`
  in sync with the files that actually exist.
