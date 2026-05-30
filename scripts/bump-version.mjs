#!/usr/bin/env node
// Bump the shell version in ONE place and have it rewritten everywhere in lockstep.
// This is the fix for the most error-prone manual step in the WordFan project,
// where the SW cache name, the app version constant, and every ?v= asset query
// string had to be edited together by hand.
//
// Usage:
//   node scripts/bump-version.mjs 1.2.0      # set explicit version
//   node scripts/bump-version.mjs            # auto-bump the patch number
//
// It reads the current version from app/version.js, then replaces that exact
// string in every file listed below. Keep new files that embed the version in
// FILES.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "app/version.js",
  "app/sw.js",
  "app/index.html",
  "app/manifest.webmanifest",
];

const versionFile = join(root, "app/version.js");
const current = readFileSync(versionFile, "utf8").match(/BUILD_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (!current) {
  console.error("Could not find BUILD_VERSION in app/version.js");
  process.exit(1);
}

let next = process.argv[2];
if (!next) {
  const parts = current.split(".").map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isInteger(n))) {
    parts[2] += 1;
    next = parts.join(".");
  } else {
    console.error(`Cannot auto-bump non-semver "${current}". Pass an explicit version.`);
    process.exit(1);
  }
}

if (next === current) {
  console.error(`New version equals current (${current}). Nothing to do.`);
  process.exit(1);
}

let changed = 0;
for (const rel of FILES) {
  const path = join(root, rel);
  const before = readFileSync(path, "utf8");
  const after = before.split(current).join(next); // replace ALL occurrences
  if (after !== before) {
    writeFileSync(path, after);
    changed += 1;
    console.log(`  ${rel}: ${current} -> ${next}`);
  } else {
    console.log(`  ${rel}: (no occurrence of ${current})`);
  }
}
console.log(`\nBumped ${current} -> ${next} across ${changed} file(s).`);
console.log("Now rebuild/redeploy and verify the live version flipped.");
