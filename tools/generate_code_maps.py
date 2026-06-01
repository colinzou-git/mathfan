#!/usr/bin/env python3
r"""
generate_code_maps.py

Generate Claude/Codex-friendly code maps for a local repository.
Designed for React/Vite/TypeScript web apps like MathFan, but works for most repos.

Usage from PowerShell inside your repo:
  python .\tools\generate_code_maps.py
  python .\tools\generate_code_maps.py --repo . --out docs\code-map

Recommended MathFan workflow:
  1. Put this file at: tools/generate_code_maps.py
  2. Run: python .\tools\generate_code_maps.py
  3. In Claude Code, start with:
     "Read docs/code-map/CLAUDE_START_HERE.md first. Use the code maps before scanning files."
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

# Folders that waste LLM tokens or contain generated/build/cache/vendor content.
DEFAULT_IGNORE_DIRS = {
    ".git", ".github", ".idea", ".vscode", ".next", ".nuxt", ".svelte-kit",
    "node_modules", "dist", "build", "coverage", ".cache", ".parcel-cache",
    ".turbo", ".vercel", ".netlify", "out", "tmp", "temp", "logs",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "vendor", "Pods", "DerivedData",
}

DEFAULT_IGNORE_FILES = {
    "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb",
    "tsconfig.tsbuildinfo", ".DS_Store",
}

CODE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".css", ".scss", ".html",
    ".json", ".md", ".yml", ".yaml",
}

TEXT_EXTENSIONS = CODE_EXTENSIONS | {
    ".txt", ".env.example", ".toml", ".ini", ".config",
}

MAX_FILE_BYTES_DEFAULT = 350_000
SNIPPET_LINES_DEFAULT = 60

IMPORT_RE = re.compile(r"^\s*import\s+(?:type\s+)?(?:(?:[\s\S]*?)\s+from\s+)?['\"]([^'\"]+)['\"]", re.MULTILINE)
DYNAMIC_IMPORT_RE = re.compile(r"import\(['\"]([^'\"]+)['\"]\)")
REQUIRE_RE = re.compile(r"require\(['\"]([^'\"]+)['\"]\)")
EXPORT_NAMED_RE = re.compile(r"^\s*export\s+(?:type\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)", re.MULTILINE)
EXPORT_LIST_RE = re.compile(r"^\s*export\s*\{([^}]+)\}", re.MULTILINE)
FUNCTION_RE = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(", re.MULTILINE)
ARROW_RE = re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>", re.MULTILINE)
CLASS_RE = re.compile(r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)", re.MULTILINE)
INTERFACE_RE = re.compile(r"^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)", re.MULTILINE)
TYPE_RE = re.compile(r"^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=", re.MULTILINE)
REACT_COMPONENT_RE = re.compile(r"^\s*(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(", re.MULTILINE)
HOOK_RE = re.compile(r"^\s*(?:export\s+)?(?:function|const)\s+(use[A-Z][A-Za-z0-9_]*)\b", re.MULTILINE)
CSS_CLASS_RE = re.compile(r"\.([A-Za-z_-][A-Za-z0-9_-]*)\s*[,{]")
JSON_KEY_RE = re.compile(r'"([A-Za-z0-9_.:-]+)"\s*:')


@dataclass
class FileInfo:
    path: str
    ext: str
    bytes: int
    lines: int
    sha1: str
    imports: list[str]
    exports: list[str]
    functions: list[str]
    classes: list[str]
    interfaces: list[str]
    types: list[str]
    components: list[str]
    hooks: list[str]
    css_classes: list[str]
    json_keys: list[str]
    purpose: str
    too_large: bool = False
    read_error: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Markdown/JSON code maps so Claude Code can understand a repo with fewer tokens."
    )
    parser.add_argument("--repo", default=".", help="Repository root. Default: current folder.")
    parser.add_argument("--out", default="docs/code-map", help="Output folder. Default: docs/code-map.")
    parser.add_argument("--max-file-bytes", type=int, default=MAX_FILE_BYTES_DEFAULT,
                        help="Skip detailed parsing for files above this size. Default: 350000.")
    parser.add_argument("--snippet-lines", type=int, default=SNIPPET_LINES_DEFAULT,
                        help="Number of important-file lines to include in OVERVIEW snippets. Default: 60.")
    parser.add_argument("--include-hidden", action="store_true", help="Include hidden files/folders except ignored directories.")
    parser.add_argument("--json-only", action="store_true", help="Only generate JSON, not Markdown.")
    parser.add_argument("--verbose", action="store_true", help="Print scanned files.")
    return parser.parse_args()


def relpath(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def is_hidden(path: Path, root: Path) -> bool:
    try:
        rel_parts = path.relative_to(root).parts
    except ValueError:
        return False
    return any(part.startswith(".") and part not in {"."} for part in rel_parts)


def should_skip_dir(path: Path, root: Path, include_hidden: bool) -> bool:
    name = path.name
    if name in DEFAULT_IGNORE_DIRS:
        return True
    if not include_hidden and is_hidden(path, root) and name not in {".github"}:
        return True
    return False


def should_scan_file(path: Path, root: Path, include_hidden: bool) -> bool:
    name = path.name
    if name in DEFAULT_IGNORE_FILES:
        return False
    if not include_hidden and is_hidden(path, root):
        return False
    # Include exact suffix-like files such as .env.example by name check.
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    if name in {"Dockerfile", "Makefile", "README", "LICENSE", ".env.example"}:
        return True
    return False


def iter_files(root: Path, include_hidden: bool) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        current = Path(dirpath)
        dirnames[:] = [d for d in dirnames if not should_skip_dir(current / d, root, include_hidden)]
        for filename in filenames:
            path = current / filename
            if should_scan_file(path, root, include_hidden):
                yield path


def read_text(path: Path, max_bytes: int) -> tuple[str, bool, str | None]:
    try:
        size = path.stat().st_size
        if size > max_bytes:
            # Read a prefix so we can still calculate line-ish context without wasting memory/tokens.
            raw = path.read_bytes()[:max_bytes]
            return raw.decode("utf-8", errors="replace"), True, None
        return path.read_text(encoding="utf-8", errors="replace"), False, None
    except Exception as exc:  # pragma: no cover - defensive for odd file encodings/permissions
        return "", False, f"{type(exc).__name__}: {exc}"


def unique_sorted(values: Iterable[str]) -> list[str]:
    cleaned = []
    seen = set()
    for value in values:
        value = value.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        cleaned.append(value)
    return sorted(cleaned, key=str.lower)


def extract_export_list(text: str) -> list[str]:
    names: list[str] = []
    for match in EXPORT_LIST_RE.finditer(text):
        chunk = match.group(1)
        for item in chunk.split(","):
            item = item.strip()
            if not item:
                continue
            # handle: Foo as Bar
            parts = re.split(r"\s+as\s+", item)
            names.append(parts[-1].strip())
    return names


def extract_python_symbols(text: str) -> tuple[list[str], list[str], list[str]]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return [], [], []
    functions: list[str] = []
    classes: list[str] = []
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(node.name)
        elif isinstance(node, ast.ClassDef):
            classes.append(node.name)
        elif isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            imports.append(node.module or ".")
    return unique_sorted(functions), unique_sorted(classes), unique_sorted(imports)


def guess_purpose(path: str, text: str, info_hint: dict[str, list[str]]) -> str:
    lower = path.lower()
    imports = set(info_hint.get("imports", []))
    exports = info_hint.get("exports", [])
    components = info_hint.get("components", [])
    hooks = info_hint.get("hooks", [])

    if path.endswith("package.json"):
        return "Project package metadata, scripts, dependencies, and dev tooling."
    if path.endswith("vite.config.ts") or path.endswith("vite.config.js"):
        return "Vite build/PWA configuration."
    if path.endswith("tsconfig.json") or "/tsconfig" in lower:
        return "TypeScript compiler configuration."
    if path.endswith("eslint.config.js") or "eslint" in lower:
        return "Linting configuration."
    if lower.endswith("app.tsx") or lower.endswith("app.jsx"):
        return "Top-level React app shell: routes/screens, global state, and feature wiring."
    if lower.endswith("main.tsx") or lower.endswith("main.jsx"):
        return "React entry point that mounts the app."
    if "/db/" in lower or "database" in lower or "dexie" in text.lower():
        return "Local persistence/database layer."
    if "/sync/" in lower or "googledrive" in text.lower() or "drive" in lower:
        return "Cloud sync/auth/data transfer logic."
    if "/auth/" in lower or "oauth" in text.lower() or "googleauth" in lower:
        return "Authentication integration."
    if "/practice/" in lower:
        return "Practice session UI and/or quiz interaction logic."
    if "/stats/" in lower:
        return "Progress/statistics screens or calculations."
    if "/settings/" in lower:
        return "Student/app settings UI or persistence."
    if "/dashboard/" in lower:
        return "Dashboard/profile setup/student navigation feature."
    if "/audio/" in lower or "speech" in lower:
        return "Speech/audio feedback utilities."
    if lower.endswith(".css") or lower.endswith(".scss"):
        return "Styling rules."
    if lower.endswith(".test.ts") or lower.endswith(".test.tsx") or ".spec." in lower:
        return "Automated tests."
    if components:
        return f"React UI component file: {', '.join(components[:4])}."
    if hooks:
        return f"React/custom hook utilities: {', '.join(hooks[:4])}."
    if exports:
        return f"Exports reusable code: {', '.join(exports[:5])}."
    if imports:
        return "Support module that imports project/external dependencies."
    return "Project file."


def analyze_file(path: Path, root: Path, max_file_bytes: int) -> FileInfo:
    relative = relpath(path, root)
    size = path.stat().st_size
    text, too_large, read_error = read_text(path, max_file_bytes)
    sha1 = hashlib.sha1(text.encode("utf-8", errors="replace")).hexdigest()[:12] if text else ""
    lines = text.count("\n") + (1 if text else 0)
    ext = path.suffix.lower() or path.name

    imports: list[str] = []
    exports: list[str] = []
    functions: list[str] = []
    classes: list[str] = []
    interfaces: list[str] = []
    types: list[str] = []
    components: list[str] = []
    hooks: list[str] = []
    css_classes: list[str] = []
    json_keys: list[str] = []

    if read_error is None:
        if ext in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
            imports = unique_sorted(
                list(IMPORT_RE.findall(text))
                + list(DYNAMIC_IMPORT_RE.findall(text))
                + list(REQUIRE_RE.findall(text))
            )
            exports = unique_sorted(EXPORT_NAMED_RE.findall(text) + extract_export_list(text))
            functions = unique_sorted(FUNCTION_RE.findall(text) + ARROW_RE.findall(text))
            classes = unique_sorted(CLASS_RE.findall(text))
            interfaces = unique_sorted(INTERFACE_RE.findall(text))
            types = unique_sorted(TYPE_RE.findall(text))
            components = unique_sorted(REACT_COMPONENT_RE.findall(text))
            hooks = unique_sorted(HOOK_RE.findall(text))
        elif ext == ".py":
            functions, classes, imports = extract_python_symbols(text)
            exports = unique_sorted(functions + classes)
        elif ext in {".css", ".scss"}:
            css_classes = unique_sorted(CSS_CLASS_RE.findall(text))[:80]
        elif ext == ".json" or path.name.endswith(".json"):
            json_keys = unique_sorted(JSON_KEY_RE.findall(text))[:80]

    hint = {"imports": imports, "exports": exports, "components": components, "hooks": hooks}
    purpose = guess_purpose(relative, text, hint)

    return FileInfo(
        path=relative,
        ext=ext,
        bytes=size,
        lines=lines,
        sha1=sha1,
        imports=imports,
        exports=exports,
        functions=functions,
        classes=classes,
        interfaces=interfaces,
        types=types,
        components=components,
        hooks=hooks,
        css_classes=css_classes,
        json_keys=json_keys,
        purpose=purpose,
        too_large=too_large,
        read_error=read_error,
    )


def load_package_json(root: Path) -> dict:
    package_path = root / "package.json"
    if not package_path.exists():
        return {}
    try:
        return json.loads(package_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def build_tree(files: Sequence[FileInfo], max_depth: int = 6) -> str:
    paths = sorted(f.path for f in files)
    tree: dict = {}
    for p in paths:
        parts = p.split("/")
        cursor = tree
        for part in parts[:max_depth]:
            cursor = cursor.setdefault(part, {})
        if len(parts) > max_depth:
            cursor.setdefault("…", {})

    lines: list[str] = []

    def walk(node: dict, prefix: str = "") -> None:
        items = sorted(node.items(), key=lambda kv: (kv[1] == {}, kv[0].lower()))
        for i, (name, child) in enumerate(items):
            connector = "└── " if i == len(items) - 1 else "├── "
            lines.append(prefix + connector + name)
            if child:
                extension = "    " if i == len(items) - 1 else "│   "
                walk(child, prefix + extension)

    walk(tree)
    return "\n".join(lines)


def md_table(rows: list[list[str]], headers: list[str]) -> str:
    def esc(s: object) -> str:
        text = str(s).replace("|", "\\|").replace("\n", "<br>")
        return text
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        out.append("| " + " | ".join(esc(cell) for cell in row) + " |")
    return "\n".join(out)


def file_import_kind(imp: str) -> str:
    if imp.startswith("."):
        return "local"
    if imp.startswith("@/"):
        return "alias"
    return "external"


def important_score(f: FileInfo) -> tuple[int, int]:
    score = 0
    lower = f.path.lower()
    if lower.endswith(("app.tsx", "main.tsx", "package.json", "vite.config.ts")):
        score += 50
    if "/features/" in lower:
        score += 20
    if "/db/" in lower or "/sync/" in lower or "/types/" in lower:
        score += 18
    if f.components:
        score += 10
    if f.exports:
        score += 8
    if f.lines > 200:
        score += 4
    if lower.endswith((".test.ts", ".test.tsx", ".css", ".md")):
        score -= 8
    return score, f.lines


def pick_important_files(files: Sequence[FileInfo], limit: int = 30) -> list[FileInfo]:
    candidates = [f for f in files if f.ext in {".ts", ".tsx", ".js", ".jsx", ".json"}]
    return sorted(candidates, key=important_score, reverse=True)[:limit]


def read_snippet(root: Path, path: str, max_lines: int) -> str:
    p = root / path
    try:
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return ""
    snippet = "\n".join(f"{idx + 1:>4}: {line}" for idx, line in enumerate(lines[:max_lines]))
    if len(lines) > max_lines:
        snippet += f"\n... ({len(lines) - max_lines} more lines)"
    return snippet


def generate_overview(root: Path, out_dir: Path, files: Sequence[FileInfo], package: dict, args: argparse.Namespace) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    important = pick_important_files(files)
    total_bytes = sum(f.bytes for f in files)
    total_lines = sum(f.lines for f in files)

    deps = package.get("dependencies", {}) or {}
    dev_deps = package.get("devDependencies", {}) or {}
    scripts = package.get("scripts", {}) or {}

    rows = []
    for f in important:
        symbols = ", ".join((f.components + f.hooks + f.exports + f.functions + f.classes)[:8])
        rows.append([f.path, f.lines, f.purpose, symbols])

    script_rows = [[name, cmd] for name, cmd in scripts.items()]
    dep_rows = [[name, version, "runtime"] for name, version in deps.items()]
    dep_rows += [[name, version, "dev"] for name, version in dev_deps.items()]

    text = f"""# Code Map Overview

Generated: {now}

Repo root: `{root}`  
Output folder: `{out_dir}`

## What this is for

This folder is a compact repo memory for Claude Code / Codex. Start AI coding sessions by asking the model to read `CLAUDE_START_HERE.md`, then `CODEMAP.md`, then `SYMBOLS.md` before scanning source files.

## Project summary

- Package name: `{package.get('name', root.name)}`
- Version: `{package.get('version', 'unknown')}`
- Module type: `{package.get('type', 'unknown')}`
- Scanned files: **{len(files)}**
- Scanned lines: **{total_lines:,}**
- Scanned bytes: **{total_bytes:,}**

## NPM scripts

{md_table(script_rows, ['Script', 'Command']) if script_rows else '_No package scripts found._'}

## Dependencies

{md_table(dep_rows, ['Package', 'Version', 'Kind']) if dep_rows else '_No package dependencies found._'}

## Most important files

{md_table(rows, ['File', 'Lines', 'Likely purpose', 'Key symbols'])}

## Repository tree, filtered

```text
{build_tree(files)}
```

## Important-file snippets

These snippets are intentionally short. They help Claude know where to look without reading every file.
"""
    for f in important[:12]:
        snippet = read_snippet(root, f.path, args.snippet_lines)
        if not snippet:
            continue
        text += f"\n### `{f.path}`\n\nPurpose: {f.purpose}\n\n```text\n{snippet}\n```\n"
    return text


def generate_symbols(files: Sequence[FileInfo]) -> str:
    rows = []
    for f in files:
        if not any([f.imports, f.exports, f.functions, f.classes, f.interfaces, f.types, f.components, f.hooks, f.css_classes, f.json_keys]):
            continue
        symbols = []
        if f.components:
            symbols.append("Components: " + ", ".join(f.components[:10]))
        if f.hooks:
            symbols.append("Hooks: " + ", ".join(f.hooks[:10]))
        if f.exports:
            symbols.append("Exports: " + ", ".join(f.exports[:12]))
        if f.functions:
            symbols.append("Functions: " + ", ".join(f.functions[:12]))
        if f.classes:
            symbols.append("Classes: " + ", ".join(f.classes[:8]))
        if f.interfaces:
            symbols.append("Interfaces: " + ", ".join(f.interfaces[:8]))
        if f.types:
            symbols.append("Types: " + ", ".join(f.types[:8]))
        if f.css_classes:
            symbols.append("CSS: " + ", ".join(f.css_classes[:12]))
        if f.json_keys:
            symbols.append("JSON keys: " + ", ".join(f.json_keys[:12]))
        imports = ", ".join(f.imports[:20])
        rows.append([f.path, f.lines, f.purpose, imports, "<br>".join(symbols)])

    return f"""# Symbols and Imports Map

Use this when you need to find the right file/function/component quickly.

{md_table(rows, ['File', 'Lines', 'Likely purpose', 'Imports', 'Symbols'])}
"""


def generate_dependencies(files: Sequence[FileInfo]) -> str:
    local_edges = []
    external_count: dict[str, int] = {}
    for f in files:
        for imp in f.imports:
            kind = file_import_kind(imp)
            if kind in {"local", "alias"}:
                local_edges.append([f.path, imp])
            else:
                root_pkg = imp.split("/")[0] if not imp.startswith("@") else "/".join(imp.split("/")[:2])
                external_count[root_pkg] = external_count.get(root_pkg, 0) + 1

    external_rows = [[pkg, count] for pkg, count in sorted(external_count.items(), key=lambda kv: (-kv[1], kv[0]))]
    local_rows = sorted(local_edges, key=lambda row: row[0].lower())

    return f"""# Dependency Map

## External imports by frequency

{md_table(external_rows, ['Package', 'Import count']) if external_rows else '_No external imports found._'}

## Local import edges

{md_table(local_rows, ['From file', 'Imports']) if local_rows else '_No local imports found._'}
"""


def generate_claude_start(files: Sequence[FileInfo], package: dict) -> str:
    app_name = package.get("name", "this repo")
    important = pick_important_files(files, limit=10)
    important_list = "\n".join(f"- `{f.path}` — {f.purpose}" for f in important)

    return f"""# CLAUDE_START_HERE

You are working in `{app_name}`.

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

{important_list}

## Suggested first prompt to Claude Code

```text
Read docs/code-map/CLAUDE_START_HERE.md, docs/code-map/CODEMAP.md, and docs/code-map/SYMBOLS.md first. Use them as the repo map. Do not scan the whole repo unless the map is insufficient. Then help me with: <TASK HERE>.
```
"""


def generate_json(root: Path, files: Sequence[FileInfo], package: dict) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(root),
        "package": {
            "name": package.get("name"),
            "version": package.get("version"),
            "type": package.get("type"),
            "scripts": package.get("scripts", {}),
            "dependencies": package.get("dependencies", {}),
            "devDependencies": package.get("devDependencies", {}),
        },
        "files": [asdict(f) for f in files],
    }


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    args = parse_args()
    root = Path(args.repo).resolve()
    if not root.exists() or not root.is_dir():
        print(f"ERROR: repo folder does not exist: {root}", file=sys.stderr)
        return 2

    out_dir = (root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out).resolve()
    package = load_package_json(root)

    files: list[FileInfo] = []
    for path in iter_files(root, include_hidden=args.include_hidden):
        # Do not include our own generated output folder if running repeatedly.
        try:
            path.relative_to(out_dir)
            continue
        except ValueError:
            pass
        info = analyze_file(path, root, args.max_file_bytes)
        files.append(info)
        if args.verbose:
            print(f"scanned {info.path}")

    files.sort(key=lambda f: f.path.lower())
    out_dir.mkdir(parents=True, exist_ok=True)

    json_data = generate_json(root, files, package)
    write_file(out_dir / "code_map.json", json.dumps(json_data, indent=2, ensure_ascii=False))

    if not args.json_only:
        write_file(out_dir / "CODEMAP.md", generate_overview(root, out_dir, files, package, args))
        write_file(out_dir / "SYMBOLS.md", generate_symbols(files))
        write_file(out_dir / "DEPENDENCIES.md", generate_dependencies(files))
        write_file(out_dir / "CLAUDE_START_HERE.md", generate_claude_start(files, package))

    print(f"Generated code maps in: {out_dir}")
    print("Files:")
    print(f"  - {out_dir / 'CLAUDE_START_HERE.md'}")
    print(f"  - {out_dir / 'CODEMAP.md'}")
    print(f"  - {out_dir / 'SYMBOLS.md'}")
    print(f"  - {out_dir / 'DEPENDENCIES.md'}")
    print(f"  - {out_dir / 'code_map.json'}")
    print("\nClaude Code prompt:")
    print("Read docs/code-map/CLAUDE_START_HERE.md first. Use the code maps before scanning source files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
