"""Browser-level end-to-end smoke tests for MathFan.

The suite drives the production Vite preview with a real Chromium browser. It
covers first-run profile setup, persisted settings, wrong/correct answer flows,
session completion, dashboard updates, and responsive navigation.

Run after starting a preview server:
    npm run build
    npm run preview -- --host 127.0.0.1 --port 4173
    python scripts/e2e_mathfan.py http://127.0.0.1:4173
"""
from __future__ import annotations

import os
import json
import re
import sys
import traceback
import zipfile
from pathlib import Path
from typing import Callable

from playwright.sync_api import Browser, Page, expect, sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
    "E2E_BASE_URL", "http://127.0.0.1:4173"
)
RESULTS_DIR = Path(os.environ.get("E2E_RESULTS_DIR", "test-results/browser"))
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def assert_no_horizontal_overflow(page: Page, label: str) -> None:
    overflow = page.evaluate(
        """() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
            body: document.body.scrollWidth,
        })"""
    )
    widest = max(overflow["document"], overflow["body"])
    if widest > overflow["viewport"] + 1:
        raise AssertionError(
            f"{label} has horizontal overflow: viewport={overflow['viewport']} widest={widest}"
        )


def create_profile(page: Page, name: str, fresh: str) -> None:
    page.goto(f"{BASE_URL}/?fresh={fresh}", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Welcome to MathFan")).to_be_visible()

    # Required-field validation must be visible and must not advance the screen.
    page.get_by_role("button", name=re.compile(r"Start Learning")).click()
    expect(page.get_by_text("Please enter a name.", exact=True)).to_be_visible()

    page.get_by_label("Name", exact=True).fill(name)
    # Grade 3 is the default selection. Verify it after profile creation instead
    # of relying on the compound label's browser-specific accessible name.
    page.get_by_role("button", name=re.compile(r"Start Learning")).click()

    expect(page.get_by_role("heading", name=f"Hi, {name}!", exact=True)).to_be_visible()
    expect(page.get_by_text("Grade 3", exact=True)).to_be_visible()


def set_practice_preferences_and_verify_persistence(page: Page) -> None:
    page.get_by_test_id("open-settings").click()
    expect(page.get_by_role("heading", name="Settings", exact=True)).to_be_visible()

    switches = page.get_by_role("switch")
    if switches.count() < 2:
        raise AssertionError("Expected Sound and Auto-advance switches in Settings")

    expect(switches.nth(0)).to_have_attribute("aria-checked", "true")
    expect(switches.nth(1)).to_have_attribute("aria-checked", "true")
    switches.nth(0).click()
    switches.nth(1).click()
    expect(switches.nth(0)).to_have_attribute("aria-checked", "false")
    expect(switches.nth(1)).to_have_attribute("aria-checked", "false")

    # Give the IndexedDB writes time to finish before simulating an app restart.
    page.wait_for_timeout(250)
    page.get_by_role("button", name="← Back", exact=True).click()
    page.reload(wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name=re.compile(r"Hi, BrowserTester!"))).to_be_visible()

    page.get_by_test_id("open-settings").click()
    switches = page.get_by_role("switch")
    expect(switches.nth(0)).to_have_attribute("aria-checked", "false")
    expect(switches.nth(1)).to_have_attribute("aria-checked", "false")
    page.get_by_role("button", name="← Back", exact=True).click()


def expect_dashboard_attempt_stats(page: Page) -> None:
    """Verify dashboard counters after one wrong and one corrected submission."""
    today_label = page.get_by_text("Today", exact=True)
    expect(today_label).to_be_visible()
    # Dashboard Q counts answer submissions; the summary counts solved problems.
    expect(today_label.locator("..")).to_contain_text("2 Q")

    accuracy_label = page.get_by_text("Accuracy", exact=True)
    expect(accuracy_label).to_be_visible()
    expect(accuracy_label.locator("..")).to_contain_text("50%")


def run_practice_journey(page: Page) -> None:
    # The operation button's accessible name includes its icon, so match the
    # visible operation text without requiring exact equality.
    page.get_by_role("button", name=re.compile(r"Multiply")).click()
    expect(page.get_by_role("heading", name="Multiplication", exact=True)).to_be_visible()

    # Force a deterministic 1 × 1 problem and a one-question session.
    page.get_by_label("First number smallest", exact=True).fill("1")
    page.get_by_label("First number largest", exact=True).fill("1")
    page.get_by_label("Second number smallest", exact=True).fill("1")
    page.get_by_label("Second number largest", exact=True).fill("1")
    page.get_by_label("Number of questions", exact=True).fill("1")
    page.get_by_role("button", name=re.compile(r"Start — 1 questions")).click()

    answer = page.get_by_label("Your answer", exact=True)
    expect(answer).to_be_visible()

    # Wrong answer: the question remains active and progressive feedback appears.
    answer.fill("2")
    answer.press("Enter")
    expect(page.get_by_text("Incorrect — try again", exact=True)).to_be_visible()
    expect(page.get_by_role("status")).to_be_visible()

    # Corrected answer: auto-advance is disabled, so the Next button must appear.
    answer = page.get_by_label("Your answer", exact=True)
    answer.fill("1")
    answer.press("Enter")
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
    page.get_by_role("button", name=re.compile(r"Next")).click()

    expect(page.get_by_role("heading", name="Session Complete!", exact=True)).to_be_visible()
    expect(page.get_by_text("You solved 1 problem.", exact=True)).to_be_visible()
    learning_label = page.get_by_text("learning moment", exact=True)
    expect(learning_label).to_be_visible()
    expect(learning_label.locator("..")).to_contain_text("1")
    page.get_by_role("button", name="Home", exact=True).click()

    expect(page.get_by_role("heading", name="Hi, BrowserTester!", exact=True)).to_be_visible()
    expect_dashboard_attempt_stats(page)

    # The saved answer/session must survive a reload.
    page.reload(wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Hi, BrowserTester!", exact=True)).to_be_visible()
    expect_dashboard_attempt_stats(page)


def verify_local_user_data_exports(page: Page) -> None:
    """Download and inspect both local export formats while signed out."""
    page.get_by_test_id("open-settings").click()
    expect(page.get_by_role("heading", name="Settings", exact=True)).to_be_visible()
    export_button = page.get_by_role("button", name="Export User Data", exact=True)
    expect(export_button).to_be_enabled()

    # Export must flush this write rather than capturing the previous value.
    page.get_by_label("Default questions per session", exact=True).fill("25")

    export_button.click()
    with page.expect_download() as json_download_info:
        page.get_by_role("menuitem", name="Export as JSON", exact=True).click()
    json_download = json_download_info.value
    if not re.fullmatch(r"mathfan-user-data-\d{8}-\d{6}\.json", json_download.suggested_filename):
        raise AssertionError(f"Unexpected JSON export filename: {json_download.suggested_filename}")
    json_path = json_download.path()
    if json_path is None:
        raise AssertionError("JSON export did not produce a local download path")
    if Path(json_path).stat().st_size == 0:
        raise AssertionError("JSON export is empty")
    payload = json.loads(Path(json_path).read_text(encoding="utf-8"))
    metadata = payload["exportMetadata"]
    snapshot = payload["snapshot"]
    if metadata["exportMode"] != "local":
        raise AssertionError("JSON export is not marked as local")
    for build_key in ("appVersion", "gitSha", "buildTime"):
        if not metadata.get(build_key):
            raise AssertionError(f"JSON export is missing {build_key}")
    expected_tables = {
        "students", "itemStates", "attempts", "sessions", "multFactStats",
        "quizSessions", "mathAnswerEvents", "learningGoals", "goalEvents", "goalEvaluations",
    }
    if not expected_tables.issubset(snapshot):
        raise AssertionError(f"JSON export is missing tables: {expected_tables - set(snapshot)}")
    if not any(student["displayName"] == "BrowserTester" for student in snapshot["students"]):
        raise AssertionError("JSON export did not preserve the created profile name")
    browser_profile = next(student for student in snapshot["students"] if student["displayName"] == "BrowserTester")
    if browser_profile["settings"]["sessionLength"] != 25:
        raise AssertionError("JSON export did not flush the latest Settings write")
    if not snapshot["mathAnswerEvents"]:
        raise AssertionError("JSON export did not include recorded practice activity")

    export_button.click()
    with page.expect_download() as zip_download_info:
        page.get_by_role("menuitem", name="Export as ZIP", exact=True).click()
    zip_download = zip_download_info.value
    if not re.fullmatch(r"mathfan-user-data-\d{8}-\d{6}\.zip", zip_download.suggested_filename):
        raise AssertionError(f"Unexpected ZIP export filename: {zip_download.suggested_filename}")
    zip_path = zip_download.path()
    if zip_path is None:
        raise AssertionError("ZIP export did not produce a local download path")
    if Path(zip_path).stat().st_size == 0:
        raise AssertionError("ZIP export is empty")
    root = Path(zip_download.suggested_filename).stem
    expected_archive_files = {
        f"{root}/manifest.json",
        f"{root}/mathfan-user-data.json",
        f"{root}/csv/students.csv",
        f"{root}/csv/item-states.csv",
        f"{root}/csv/attempts.csv",
        f"{root}/csv/sessions.csv",
        f"{root}/csv/multiplication-fact-stats.csv",
        f"{root}/csv/quiz-sessions.csv",
        f"{root}/csv/math-answer-events.csv",
        f"{root}/csv/learning-goals.csv",
        f"{root}/csv/goal-events.csv",
        f"{root}/csv/goal-evaluations.csv",
    }
    with zipfile.ZipFile(zip_path) as archive:
        names = set(archive.namelist())
        if not expected_archive_files.issubset(names):
            raise AssertionError(f"ZIP export is missing files: {expected_archive_files - names}")
        manifest = json.loads(archive.read(f"{root}/manifest.json"))
        zipped_payload = json.loads(archive.read(f"{root}/mathfan-user-data.json"))
    if manifest["rowCounts"]["students"] < 1:
        raise AssertionError("ZIP manifest has an incorrect student row count")
    if not any(student["displayName"] == "BrowserTester" for student in zipped_payload["snapshot"]["students"]):
        raise AssertionError("ZIP export did not preserve the created profile name")

    assert_no_horizontal_overflow(page, "desktop export settings")
    page.get_by_role("button", name="← Back", exact=True).click()


def desktop_student_journey(page: Page) -> None:
    create_profile(page, "BrowserTester", "e2e-desktop")
    set_practice_preferences_and_verify_persistence(page)
    run_practice_journey(page)
    verify_local_user_data_exports(page)
    assert_no_horizontal_overflow(page, "desktop dashboard")


def responsive_navigation(page: Page, label: str) -> None:
    create_profile(page, f"{label.title()}Tester", f"e2e-{label}")
    assert_no_horizontal_overflow(page, f"{label} dashboard")

    for button_name in (
        "Grade 3 Math Map",
        "Goals",
        "Multiply",
        "Multiplication Quiz",
        "Stats & History",
    ):
        expect(page.get_by_role("button", name=re.compile(button_name))).to_be_visible()

    page.get_by_test_id("open-settings").click()
    expect(page.get_by_role("heading", name="Settings", exact=True)).to_be_visible()
    assert_no_horizontal_overflow(page, f"{label} settings")
    export_button = page.get_by_role("button", name="Export User Data", exact=True)
    expect(export_button).to_be_enabled()
    export_button.click()
    expect(page.get_by_role("menu", name="Export format")).to_be_visible()
    assert_no_horizontal_overflow(page, f"{label} export menu")
    page.keyboard.press("Escape")
    page.get_by_role("button", name="← Back", exact=True).click()

    page.get_by_role("button", name=re.compile(r"Multiply")).click()
    expect(page.get_by_role("heading", name="Multiplication", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name=re.compile(r"Start — \d+ questions"))).to_be_visible()
    assert_no_horizontal_overflow(page, f"{label} multiplication setup")


def standalone_pwa_share_flow(page: Page) -> None:
    create_profile(page, "PwaTester", "e2e-pwa-share")
    page.get_by_test_id("open-settings").click()
    page.get_by_role("button", name="Export User Data", exact=True).click()
    page.get_by_role("menuitem", name="Export as JSON", exact=True).click()

    share_button = page.get_by_role("button", name="Share or Save File", exact=True)
    expect(share_button).to_be_visible()
    expect(page.get_by_role("button", name="Download Instead", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="Cancel", exact=True)).to_be_visible()
    share_button.click()
    expect(page.get_by_text(re.compile(r"Exported mathfan-user-data-.*\.json"))).to_be_visible()
    share_calls = page.evaluate("window.__mathfanShareCalls || []")
    if len(share_calls) != 1 or not share_calls[0].endswith(".json"):
        raise AssertionError(f"Prepared file was not shared from the explicit click: {share_calls}")


def set_one_question_sessions(page: Page) -> None:
    page.get_by_test_id("open-settings").click()
    page.get_by_label("Default questions per session", exact=True).fill("1")
    page.get_by_label("Default questions per session", exact=True).press("Tab")
    page.wait_for_timeout(250)
    page.get_by_role("button", name="← Back", exact=True).click()


def open_mastery_skill(page: Page, skill_name: str) -> None:
    page.get_by_role("button", name=re.compile(r"Grade 3 Math Map")).click()
    page.get_by_role("button", name=re.compile(rf"^{re.escape(skill_name)}:")).click()
    page.get_by_role("button", name=re.compile(r"Practice this skill")).click()
    expect(page.get_by_role("img").last).to_be_visible()
    assert_no_horizontal_overflow(page, skill_name)


def area_perimeter_missing_side_lesson(page: Page) -> None:
    create_profile(page, "PerimeterTester", "e2e-perimeter-missing")
    set_one_question_sessions(page)
    open_mastery_skill(page, "Missing-Side Perimeter")
    prompt = page.locator(".drill-q > div").first.inner_text()
    numbers = [int(value) for value in re.findall(r"\d+", prompt)]
    if "Which equation" in prompt:
        total, *known = numbers
        equation = " + ".join(str(value) for value in known) + f" + x = {total}"
        page.get_by_role("button", name=equation, exact=True).click()
    else:
        total, *known = numbers
        answer = sum(known) if "sum of the known sides" in prompt else total - sum(known)
        page.get_by_label("Your answer", exact=True).fill(str(answer))
        page.get_by_label("Your answer", exact=True).press("Enter")
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()


def area_perimeter_comparison_lesson(page: Page) -> None:
    create_profile(page, "ComparisonTester", "e2e-area-perimeter-compare")
    set_one_question_sessions(page)
    open_mastery_skill(page, "Compare Area and Perimeter")
    prompt = page.locator(".drill-q > div").first.inner_text()
    numbers = [int(value) for value in re.findall(r"\d+", prompt)]
    if "perimeter of Rectangle A" in prompt:
        answer = 2 * (numbers[0] + numbers[1])
    else:
        answer = numbers[2] * numbers[3]
    page.get_by_label("Your answer", exact=True).fill(str(answer))
    page.get_by_label("Your answer", exact=True).press("Enter")
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()


def fraction_equivalence_visual_lesson(page: Page) -> None:
    create_profile(page, "FractionEquivalentTester", "e2e-fraction-equivalent")
    set_one_question_sessions(page)
    open_mastery_skill(page, "Equivalent Fractions")
    prompt = page.locator(".drill-q > div").first.inner_text()
    values = [int(value) for value in re.findall(r"\d+", prompt)]
    numerator, denominator, target_denominator = values[:3]
    answer = numerator * target_denominator // denominator
    page.get_by_label("Your answer", exact=True).fill(str(answer))
    page.get_by_label("Your answer", exact=True).press("Enter")
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()


def fraction_same_numerator_lesson(page: Page) -> None:
    create_profile(page, "FractionCompareTester", "e2e-fraction-same-numerator")
    set_one_question_sessions(page)
    open_mastery_skill(page, "Compare Same Numerators")
    prompt = page.locator(".drill-q > div").first.inner_text()
    n1, d1, n2, d2 = [int(value) for value in re.findall(r"\d+", prompt)][:4]
    if prompt.startswith("Why is"):
        page.get_by_role(
            "button",
            name="The numerators match, so fewer equal pieces means larger pieces.",
            exact=True,
        ).click()
        expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
        return
    left, right = n1 * d2, n2 * d1
    answer = "=" if left == right else "<" if left < right else ">"
    page.get_by_role("button", name=answer, exact=True).click()
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()


def subtraction_across_zero_lesson(page: Page) -> None:
    create_profile(page, "RegroupTester", "e2e-subtraction-across-zero")
    set_one_question_sessions(page)
    open_mastery_skill(page, "Subtract Across Zero")
    completed_error_analysis = False
    for _ in range(10):
        prompt_locator = page.locator(".drill-q > div").first
        prompt = prompt_locator.inner_text()
        values = [int(value) for value in re.findall(r"\d+", prompt)]
        a, b = values[:2]
        if prompt.startswith("A learner wrote"):
            shown = values[2]
            correct = a - b
            place = "ones" if shown == correct - 10 else "tens" if shown == correct - 100 else "regrouping"
            page.get_by_role("button", name=place, exact=True).click()
            completed_error_analysis = True
        else:
            page.get_by_label("Your answer", exact=True).fill(str(a - b))
            page.get_by_label("Your answer", exact=True).press("Enter")
        expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
        if completed_error_analysis:
            break
        page.wait_for_timeout(1400)
    if not completed_error_analysis:
        raise AssertionError("Across-zero lesson did not include its planned error-analysis item")


def run_scenario(
    browser: Browser,
    name: str,
    viewport: dict[str, int],
    scenario: Callable[[Page], None],
    standalone_share: bool = False,
) -> None:
    context = browser.new_context(
        viewport=viewport,
        timezone_id="America/Los_Angeles",
        service_workers="block",
        reduced_motion="reduce",
    )
    if standalone_share:
        context.add_init_script(
            """(() => {
                const originalMatchMedia = window.matchMedia.bind(window);
                window.matchMedia = query => query === '(display-mode: standalone)'
                    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }
                    : originalMatchMedia(query);
                window.__mathfanShareCalls = [];
                Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => !!data?.files?.length });
                Object.defineProperty(navigator, 'share', {
                    configurable: true,
                    value: async data => { window.__mathfanShareCalls.push(data.files[0].name); },
                });
            })()"""
        )
    else:
        context.add_init_script(
            """(() => {
                Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
                Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
            })()"""
        )
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    page = context.new_page()
    page_errors: list[str] = []
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))

    try:
        scenario(page)
        if page_errors:
            raise AssertionError(f"Unhandled page errors: {page_errors}")
        context.tracing.stop()
        print(f"PASS: {name}", flush=True)
    except Exception:
        screenshot = RESULTS_DIR / f"{name}.png"
        trace = RESULTS_DIR / f"{name}-trace.zip"
        try:
            page.screenshot(path=str(screenshot), full_page=True)
        except Exception:
            pass
        try:
            context.tracing.stop(path=str(trace))
        except Exception:
            pass
        print(f"FAIL: {name}", flush=True)
        traceback.print_exc()
        raise
    finally:
        context.close()


def main() -> int:
    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        scenarios = [
            ("desktop-student-journey", {"width": 1440, "height": 1000}, desktop_student_journey, False),
            (
                "mobile-responsive",
                {"width": 390, "height": 844},
                lambda page: responsive_navigation(page, "mobile"),
                False,
            ),
            (
                "ipad-responsive",
                {"width": 1024, "height": 768},
                lambda page: responsive_navigation(page, "ipad"),
                False,
            ),
            ("standalone-pwa-share", {"width": 1024, "height": 768}, standalone_pwa_share_flow, True),
            ("missing-side-lesson", {"width": 390, "height": 844}, area_perimeter_missing_side_lesson, False),
            ("area-perimeter-comparison", {"width": 1024, "height": 768}, area_perimeter_comparison_lesson, False),
            ("fraction-equivalence-visual", {"width": 390, "height": 844}, fraction_equivalence_visual_lesson, False),
            ("fraction-same-numerator", {"width": 1024, "height": 768}, fraction_same_numerator_lesson, False),
            ("subtraction-across-zero", {"width": 390, "height": 844}, subtraction_across_zero_lesson, False),
        ]
        for name, viewport, scenario, standalone_share in scenarios:
            try:
                run_scenario(browser, name, viewport, scenario, standalone_share)
            except Exception as exc:
                failures.append(f"{name}: {exc}")
        browser.close()

    if failures:
        print("\nBrowser E2E failures:", flush=True)
        for failure in failures:
            print(f"  - {failure}", flush=True)
        return 1

    print("\nPASS: all MathFan browser E2E scenarios", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
