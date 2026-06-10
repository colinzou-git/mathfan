"""Automated smoke for the Settings → About → "Check for Updates" flow.

This drives the real MathFan React app against a preview build and exercises the
build-info.json probe added in SettingsPage. It replaces an older script that
assumed a WordFan/WordLover global (`window.WordLoverApp`) and DOM ids that no
longer exist.

Branches:
  1. up-to-date  — server build-info matches the running build → "latest".
  2. available   — server build-info reports a different git SHA → "update
                   available". This is the case the old `registration.waiting`
                   check missed under `skipWaiting: true`.
  3. error       — the build-info fetch fails → a real error, NOT "up to date".

Network mocking uses Playwright `page.route` so the test is fully local. Service
workers are blocked so route interception always sees the raw fetch.

Run against a preview server:
    npm run build && npm run preview -- --port 4173
    python scripts/smoke-update-flow.py http://127.0.0.1:4173
"""
from __future__ import annotations

import json
import sys
import time

from playwright.sync_api import Route, sync_playwright


def navigate_to_settings(page) -> None:
    """Land on the dashboard (creating a profile on first run) and open Settings."""
    # First-run profile setup, if shown.
    name_input = page.query_selector('input[placeholder="e.g. Alex"]')
    if name_input:
        name_input.fill("SmokeTester")
        page.click('button:has-text("Start Learning")')
    page.wait_for_selector('[data-testid="open-settings"]', timeout=15000)
    page.click('[data-testid="open-settings"]')
    page.wait_for_selector('[data-testid="check-update-button"]', timeout=15000)


def run_check(page) -> str:
    """Click 'Check for Updates' and return the resulting status text."""
    page.click('[data-testid="check-update-button"]')
    # Wait until the status line settles out of the "Checking…" state.
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="update-status"]');
            return el && !/Checking for latest/.test(el.textContent || '');
        }""",
        timeout=15000,
    )
    return page.evaluate("() => document.querySelector('[data-testid=\"update-status\"]').textContent")


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Read the real deployed build-info so the "up-to-date" branch can echo
        # the exact values the running bundle was built with.
        api = browser.new_context()
        real = api.request.get(f"{base}/build-info.json").json()
        api.close()

        # --- Branch 1: up-to-date (serve the real build-info back) ---
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.route("**/build-info.json**", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps(real)))
        page.goto(f"{base}/?fresh=update-smoke-1", wait_until="domcontentloaded")
        navigate_to_settings(page)
        status = run_check(page)
        if "latest" not in (status or "").lower():
            failures.append(f"Branch 1 (up-to-date) expected 'latest', got {status!r}")
        ctx.close()

        # --- Branch 2: update available (forge a different git SHA) ---
        forged = dict(real)
        forged["gitSha"] = "deadbeefcafef00d"
        forged["buildTime"] = "2099-12-31T23:59:00.000Z"
        forged["appVersion"] = "9.9.9"

        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.route("**/build-info.json**", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps(forged)))
        page.goto(f"{base}/?fresh=update-smoke-2", wait_until="domcontentloaded")
        navigate_to_settings(page)
        status = run_check(page)
        if "new version available" not in (status or "").lower():
            failures.append(f"Branch 2 (available) expected 'new version available', got {status!r}")
        server_build = page.query_selector('[data-testid="server-build"]')
        if not server_build or "9.9.9" not in server_build.text_content():
            failures.append("Branch 2 expected the forged server build (v9.9.9) to be displayed.")
        ctx.close()

        # --- Branch 3: check-error (abort the build-info fetch) ---
        def abort_build_info(route: Route) -> None:
            route.abort()

        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.route("**/build-info.json**", abort_build_info)
        page.goto(f"{base}/?fresh=update-smoke-3", wait_until="domcontentloaded")
        navigate_to_settings(page)
        status = (run_check(page) or "").lower()
        if "could not check" not in status:
            failures.append(f"Branch 3 (error) expected 'could not check', got {status!r}")
        if "latest" in status or "up to date" in status:
            failures.append("Branch 3 must NOT claim the app is up to date when the probe fails.")
        ctx.close()

        browser.close()

    if failures:
        for f in failures:
            print(f"FAIL: {f}", flush=True)
        return 1
    print("PASS", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
