"""Automated smoke for the Settings → About → "Check for Updates" flow.

This drives the real MathFan React app against a preview build and exercises the
build-info.json probe added in SettingsPage.

Branches:
  1. up-to-date  — server build-info matches the running build → "latest".
  2. available   — server build-info reports a different git SHA → "update
                   available".
  3. error       — the build-info fetch fails → a real error, NOT "up to date".

Network mocking uses Playwright `page.route` so the test is fully local. Service
workers are blocked so route interception always sees the raw fetch.

Run against a preview server:
    npm run build && npm run preview -- --host 127.0.0.1 --port 4173
    python scripts/smoke-update-flow.py http://127.0.0.1:4173
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import Page, Route, sync_playwright

RESULTS_DIR = Path(os.environ.get("E2E_RESULTS_DIR", "test-results/browser"))
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def navigate_to_settings(page: Page) -> None:
    """Land on the dashboard (creating a profile on first run) and open Settings."""
    page.wait_for_function(
        """() =>
            document.querySelector('[data-testid="open-settings"]') ||
            document.querySelector('input[placeholder="e.g. Alex"]')
        """,
        timeout=15000,
    )

    name_input = page.query_selector('input[placeholder="e.g. Alex"]')
    if name_input:
        name_input.fill("SmokeTester")
        page.click('button:has-text("Start Learning")')

    page.wait_for_selector('[data-testid="open-settings"]', timeout=15000)
    page.click('[data-testid="open-settings"]')
    page.wait_for_selector('[data-testid="check-update-button"]', timeout=15000)


def run_check(page: Page) -> str:
    """Click 'Check for Updates' and return the resulting status text."""
    page.click('[data-testid="check-update-button"]')
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="update-status"]');
            return el && !/Checking for latest/.test(el.textContent || '');
        }""",
        timeout=15000,
    )
    return page.evaluate(
        "() => document.querySelector('[data-testid=\"update-status\"]').textContent"
    )


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
        "E2E_BASE_URL", "http://127.0.0.1:4173"
    )
    failures: list[str] = []
    last_page: Page | None = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        api = browser.new_context()
        response = api.request.get(f"{base}/build-info.json")
        if not response.ok:
            raise RuntimeError(f"Could not read preview build-info.json: {response.status}")
        real = response.json()
        api.close()

        # --- Branch 1: up-to-date ---
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        last_page = page
        page.on("pageerror", lambda error: failures.append(f"Branch 1 page error: {error}"))
        page.route(
            "**/build-info.json**",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(real)
            ),
        )
        page.goto(f"{base}/?fresh=update-smoke-1", wait_until="domcontentloaded")
        navigate_to_settings(page)
        status = run_check(page)
        if "latest" not in (status or "").lower():
            failures.append(f"Branch 1 (up-to-date) expected 'latest', got {status!r}")
        ctx.close()

        # --- Branch 2: update available ---
        forged = dict(real)
        forged["gitSha"] = "deadbeefcafef00d"
        forged["buildTime"] = "2099-12-31T23:59:00.000Z"
        forged["appVersion"] = "9.9.9"

        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        last_page = page
        page.on("pageerror", lambda error: failures.append(f"Branch 2 page error: {error}"))
        page.route(
            "**/build-info.json**",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(forged)
            ),
        )
        page.goto(f"{base}/?fresh=update-smoke-2", wait_until="domcontentloaded")
        navigate_to_settings(page)
        status = run_check(page)
        if "new version available" not in (status or "").lower():
            failures.append(
                f"Branch 2 (available) expected 'new version available', got {status!r}"
            )
        server_build = page.query_selector('[data-testid="server-build"]')
        if not server_build or "9.9.9" not in server_build.text_content():
            failures.append(
                "Branch 2 expected the forged server build (v9.9.9) to be displayed."
            )
        ctx.close()

        # --- Branch 3: check error ---
        def abort_build_info(route: Route) -> None:
            route.abort()

        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        last_page = page
        page.on("pageerror", lambda error: failures.append(f"Branch 3 page error: {error}"))
        page.route("**/build-info.json**", abort_build_info)
        page.goto(f"{base}/?fresh=update-smoke-3", wait_until="domcontentloaded")
        navigate_to_settings(page)
        status = (run_check(page) or "").lower()
        if "could not check" not in status:
            failures.append(
                f"Branch 3 (error) expected 'could not check', got {status!r}"
            )
        if "latest" in status or "up to date" in status:
            failures.append(
                "Branch 3 must NOT claim the app is up to date when the probe fails."
            )

        if failures and last_page:
            try:
                last_page.screenshot(
                    path=str(RESULTS_DIR / "update-flow-failure.png"), full_page=True
                )
            except Exception:
                pass
        ctx.close()
        browser.close()

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", flush=True)
        return 1

    print("PASS: update-flow browser smoke", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
