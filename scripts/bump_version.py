#!/usr/bin/env python3
"""Bump the shell version in ONE place; rewrite it everywhere in lockstep.

Python twin of bump-version.mjs (use whichever your toolchain has). This is the
fix for the most error-prone manual step in the WordFan project.

Usage:
  python scripts/bump_version.py 1.2.0   # set explicit version
  python scripts/bump_version.py         # auto-bump the patch number

Reads the current version from app/version.js, then replaces that exact string
in every file in FILES (byte-level, so encoding/CRLF are preserved). Add any new
file that embeds the version to FILES.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = [
    "app/version.js",
    "app/sw.js",
    "app/index.html",
    "app/manifest.webmanifest",
]


def main() -> int:
    version_file = ROOT / "app/version.js"
    m = re.search(r'BUILD_VERSION\s*=\s*"([^"]+)"', version_file.read_text(encoding="utf-8"))
    if not m:
        print("Could not find BUILD_VERSION in app/version.js")
        return 1
    current = m.group(1)

    if len(sys.argv) > 1:
        nxt = sys.argv[1]
    else:
        parts = current.split(".")
        if len(parts) == 3 and all(p.isdigit() for p in parts):
            parts[2] = str(int(parts[2]) + 1)
            nxt = ".".join(parts)
        else:
            print(f'Cannot auto-bump non-semver "{current}". Pass an explicit version.')
            return 1

    if nxt == current:
        print(f"New version equals current ({current}). Nothing to do.")
        return 1

    cur_b, nxt_b = current.encode(), nxt.encode()
    changed = 0
    for rel in FILES:
        p = ROOT / rel
        b = p.read_bytes()
        if cur_b in b:
            p.write_bytes(b.replace(cur_b, nxt_b))
            changed += 1
            print(f"  {rel}: {current} -> {nxt}")
        else:
            print(f"  {rel}: (no occurrence of {current})")
    print(f"\nBumped {current} -> {nxt} across {changed} file(s).")
    print("Now rebuild/redeploy and verify the live version flipped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
