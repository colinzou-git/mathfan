<!--
MathFan PR checklist. Fill this in before requesting review / merge.
Merge only after the CI workflow is green. See docs/CLOUD_DEVELOPMENT.md.
-->

## Summary

<!-- What does this PR do and why? One or two sentences. -->

## Changed files

<!-- List the key files changed and what changed in each. -->
-

## Tests run

- [ ] `npm run ci` passes locally (lint + tests + build)
- [ ] Added/updated tests for new logic

<!-- Paste the relevant result or note what you ran. -->

## Impact checklist

Check each that applies and note the impact.

- [ ] **FSRS scheduling** touched — _(if yes, confirm existing scheduling behavior is preserved)_
- [ ] **IndexedDB / Dexie schema** touched — _(if yes, note the version bump + migration)_
- [ ] **Google sync** touched — _(if yes, note auth/Drive impact; remember CI uses a stub client ID)_
- [ ] **PWA / update behavior** touched — _(service worker, manifest, icons, build-info, version bump)_
- [ ] **Code maps regenerated** — ran `python tools/generate_code_maps.py` and committed `docs/code-map/*`

## Notes

<!-- Anything reviewers should know: follow-ups, known limitations, screenshots. -->
