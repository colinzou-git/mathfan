#!/usr/bin/env python3
"""
scripts/generate_code_map.py

Entry-point wrapper for the code-map generator.
Delegates to tools/generate_code_maps.py so the script lives in the
same `scripts/` folder as the other project utilities.

Usage (from repo root):
  python scripts/generate_code_map.py
  python scripts/generate_code_map.py --verbose
  python scripts/generate_code_map.py --repo . --out docs/code-map

All arguments are forwarded verbatim to the underlying generator.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Locate the real generator relative to this file's position in the repo.
_REPO_ROOT = Path(__file__).resolve().parent.parent
_GENERATOR = _REPO_ROOT / "tools" / "generate_code_maps.py"

if not _GENERATOR.exists():
    print(f"ERROR: generator not found at {_GENERATOR}", file=sys.stderr)
    sys.exit(2)

# Inject the repo root so `import generate_code_maps` resolves correctly,
# then hand off execution to the generator module directly.
sys.path.insert(0, str(_GENERATOR.parent))

# Override sys.argv[0] so argparse help text shows the right script name.
sys.argv[0] = str(_GENERATOR)

import generate_code_maps  # noqa: E402 — intentional late import after path fix

raise SystemExit(generate_code_maps.main())
