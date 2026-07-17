# CLAUDE_START_HERE

You are working in `mathfan`.

## Token-saving rule

Before scanning the repository, read these generated maps first:

1. `docs/code-map/CODEMAP.md` — architecture overview, tree, important snippets
2. `docs/code-map/SYMBOLS.md` — components, hooks, exports, functions, imports
3. `docs/code-map/DEPENDENCIES.md` — local and external import map
4. `docs/code-map/code_map.json` — machine-readable full map

Do **not** scan `node_modules`, `dist`, `build`, `coverage`, lockfiles, or generated files unless explicitly needed.

## Best workflow

When given a coding task:

1. Identify likely files from `CODEMAP.md` and `SYMBOLS.md`.
2. Read only those files first.
3. Use search for specific symbols/imports instead of opening broad folders.
4. After code changes, run the relevant checks from `package.json`.
5. If the architecture changed, ask the user to rerun:

```bash
python tools/generate_code_maps.py
```

## Likely entry points

- `src/App.tsx` — Top-level React app shell: routes/screens, global state, and feature wiring.
- `src/features/sync/SyncWidget.tsx` — Cloud sync/auth/data transfer logic.
- `src/features/sync/snapshot.ts` — Local persistence/database layer.
- `vite.config.ts` — Vite build/PWA configuration.
- `package.json` — Project package metadata, scripts, dependencies, and dev tooling.
- `src/main.tsx` — React entry point that mounts the app.
- `src/features/sync/driveSync.ts` — Cloud sync/auth/data transfer logic.
- `src/features/sync/snapshotParsers.ts` — Cloud sync/auth/data transfer logic.
- `src/features/sync/learnerKeyMerge.ts` — Cloud sync/auth/data transfer logic.
- `src/features/sync/useSync.ts` — Cloud sync/auth/data transfer logic.

## Suggested first prompt to Claude Code

```text
Read docs/code-map/CLAUDE_START_HERE.md, docs/code-map/CODEMAP.md, and docs/code-map/SYMBOLS.md first. Use them as the repo map. Do not scan the whole repo unless the map is insufficient. Then help me with: <TASK HERE>.
```
