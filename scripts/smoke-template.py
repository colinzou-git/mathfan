"""Playwright smoke-test template. Copy per feature (smoke-<feature>.py).

Run the local server first, then: python scripts/smoke-template.py [base_url]

The pattern that worked well on WordFan:
- block the real service worker so a controllerchange reload doesn't kill the
  page mid-test, OR tolerate the reload and re-wait for the app object;
- drive the app through a small window.* debug surface (window.App here) rather
  than scraping the DOM;
- assert on behavior, and for any bug you fix, ADD a check here that reproduces
  the production condition (e.g. a Range-capable server, a wrong MIME type).
"""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.goto(f"{base}/?fresh=smoke", wait_until="domcontentloaded")
        page.wait_for_function("window.App != null", timeout=15000)
        time.sleep(1.0)  # let any controllerchange reload settle

        version = page.evaluate("() => window.App.version")
        print(f"app version: {version}", flush=True)
        if not version:
            failures.append("window.App.version missing")

        # --- add feature-specific checks below ---
        # example: theme applies
        applied = page.evaluate("() => { window.App.applyTheme('candy'); return document.documentElement.dataset.theme; }")
        if applied != "candy":
            failures.append(f"theme did not apply: {applied}")

        # example: no runtime errors were captured
        errs = page.evaluate("() => window.App.getErrors()")
        if errs:
            print(f"captured errors: {errs}", flush=True)

        browser.close()

    if failures:
        print("\nFAILED:", flush=True)
        for f in failures:
            print(f"  - {f}", flush=True)
        return 1
    print("\nPASS", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
