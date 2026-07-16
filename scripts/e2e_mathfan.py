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


def legacy_scheduler_upgrade(page: Page) -> None:
    """Open the built app over a real v6 IndexedDB and verify scheduler recovery."""
    seed_url = f"{BASE_URL}/__seed_issue_40__"
    page.route(seed_url, lambda route: route.fulfill(status=200, content_type="text/html", body="<!doctype html><title>seed</title>"))
    page.goto(seed_url, wait_until="domcontentloaded")
    page.evaluate(
        """async () => {
            await new Promise((resolve, reject) => {
                const request = indexedDB.deleteDatabase('mathfan');
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
                const request = indexedDB.open('mathfan', 6);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    database.createObjectStore('students', { keyPath: 'id' });
                    database.createObjectStore('itemStates', { keyPath: ['studentId', 'itemId'] });
                    database.createObjectStore('attempts', { keyPath: 'id' });
                    database.createObjectStore('sessions', { keyPath: 'id' });
                    database.createObjectStore('multFactStats', { keyPath: ['studentId', 'key'] });
                    database.createObjectStore('quizSessions', { keyPath: 'id' });
                    database.createObjectStore('mathAnswerEvents', { keyPath: 'id' });
                    database.createObjectStore('learningGoals', { keyPath: 'id' });
                    database.createObjectStore('goalEvents', { keyPath: 'id' });
                    database.createObjectStore('goalEvaluations', { keyPath: 'id' });
                };
                request.onsuccess = () => {
                    const database = request.result;
                    const tx = database.transaction('itemStates', 'readwrite');
                    tx.objectStore('itemStates').put({
                        studentId: 'legacy-student', itemId: 'MUL_7x8', skillId: 'g3-mul-tables-basic',
                        attemptCount: 9, correctCount: 7, lastAnswer: '56', lastCorrect: true,
                        lastLatencyMs: 1200, medianLatencyMs: 1400, personalBestMs: 900,
                        ease: 2.5, stabilityDays: 12, difficulty: 0.3, fsrsDifficulty: 4.2,
                        reps: 8, lapses: 1, masteryLevel: 'strong',
                        lastSeenAt: '2025-12-20T00:00:00.000Z', nextDueAt: '2026-01-20T00:00:00.000Z',
                        mistakePatterns: ['mul_add_instead'],
                    });
                    tx.oncomplete = () => { database.close(); resolve(); };
                    tx.onerror = () => reject(tx.error);
                };
                request.onerror = () => reject(request.error);
            });
        }"""
    )
    page.unroute(seed_url)
    page.goto(BASE_URL, wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Welcome to MathFan")).to_be_visible()
    migrated = page.evaluate(
        """async () => new Promise((resolve, reject) => {
            const request = indexedDB.open('mathfan');
            request.onsuccess = () => {
                const database = request.result;
                const tx = database.transaction(['itemStates', 'dataMigrationRuns'], 'readonly');
                const stateRequest = tx.objectStore('itemStates').get(['legacy-student', 'fact:mul:7x8']);
                const runsRequest = tx.objectStore('dataMigrationRuns').getAll();
                tx.oncomplete = () => { database.close(); resolve({ state: stateRequest.result, runs: runsRequest.result }); };
                tx.onerror = () => reject(tx.error);
            };
            request.onerror = () => reject(request.error);
        })"""
    )
    state = migrated["state"]
    if not state or state.get("reps") != 8 or state.get("lastItemId") != "MUL_7x8":
        raise AssertionError(f"Legacy scheduler state was not preserved: {state!r}")
    if not any(run.get("status") == "completed" and run.get("coverage", {}).get("legacyFallbackCount") == 1 for run in migrated["runs"]):
        raise AssertionError(f"Migration coverage was not persisted: {migrated['runs']!r}")


def distinct_same_name_learners(page: Page) -> None:
    """Different learner keys with the same display name remain selectable profiles."""
    create_profile(page, "SameName", "issue-41-multi-profile")
    page.evaluate(
        """async () => {
            const database = await new Promise((resolve, reject) => {
                const request = indexedDB.open('mathfan');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const original = await new Promise((resolve, reject) => {
                const request = database.transaction('students').objectStore('students').getAll();
                request.onsuccess = () => resolve(request.result[0]);
                request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
                const tx = database.transaction('students', 'readwrite');
                tx.objectStore('students').put({
                    ...original,
                    id: 'same-name-second-profile',
                    learnerKey: 'different-stable-learner-key',
                    createdAt: '2026-01-02T00:00:00.000Z',
                });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            database.close();
            localStorage.removeItem('mathfan.activeLearnerKey');
        }"""
    )
    page.reload(wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Welcome back to MathFan")).to_be_visible()
    profiles = page.get_by_role("button", name="SameName (Grade 3)", exact=True)
    expect(profiles).to_have_count(2)
    profiles.first.click()
    expect(page.get_by_role("heading", name="Hi, SameName!", exact=True)).to_be_visible()


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
    if not metadata.get("modelVersions", {}).get("fsrsConfig"):
        raise AssertionError("JSON export is missing scheduling model versions")
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
    if not any(event.get("schedulingTelemetry", {}).get("version") == 1 for event in snapshot["mathAnswerEvents"]):
        raise AssertionError("JSON export did not include versioned scheduling telemetry")

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
        f"{root}/csv/scheduling-telemetry.csv",
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


def legacy_downloaded_backup_restore(page: Page) -> None:
    """Import a v1 downloaded backup and begin review from its legacy itemId state."""
    create_profile(page, "RestoreTester", "e2e-legacy-backup")
    student = page.evaluate("""async () => {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('mathfan'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const rows = await new Promise((resolve, reject) => { const request = db.transaction('students').objectStore('students').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        db.close(); return rows[0];
    }""")
    legacy_state = {
        "studentId": student["id"], "itemId": "MUL_8x7", "skillId": "g3-mul-tables-basic",
        "attemptCount": 3, "correctCount": 2, "lastCorrect": True, "lastLatencyMs": 900,
        "medianLatencyMs": 1000, "ease": 2.5, "stabilityDays": 1, "difficulty": 0.2,
        "reps": 3, "lapses": 1, "masteryLevel": "learning",
        "nextDueAt": "2026-01-01T00:00:00.000Z", "mistakePatterns": [],
    }
    backup = {
        "appId": "mathfan", "snapshotVersion": 1, "snapshotAt": "2025-01-01T00:00:00.000Z",
        "students": [student], "itemStates": [legacy_state], "attempts": [], "sessions": [],
    }
    page.get_by_test_id("open-settings").click()
    page.get_by_label("Choose MathFan backup", exact=True).set_input_files({
        "name": "mathfan-backup-v1.json",
        "mimeType": "application/json",
        "buffer": json.dumps(backup).encode("utf-8"),
    })
    expect(page.get_by_text("Backup imported successfully. Your restored progress is ready.", exact=True)).to_be_visible()
    page.get_by_role("button", name="← Back", exact=True).click()
    review_tile = page.locator("button").filter(has_text=re.compile(r"Multiply.*1"))
    expect(review_tile).to_be_visible()
    review_tile.click()
    page.get_by_role("button", name="Start", exact=True).click()
    expect(page.locator(".drill-q")).to_be_visible()


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
    expect(page.locator(".drill-q")).to_be_visible()
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
            expected_places = {
                (703, 458): "regrouping",
                (900, 376): "ones",
                (804, 576): "regrouping",
            }
            place = expected_places[(a, b)]
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


def division_decomposition_lesson(page: Page) -> None:
    create_profile(page, "DivisionDecomposeTester", "e2e-division-decomposition")
    open_mastery_skill(page, "Decompose Two-Digit Division")
    found_target = False
    for _ in range(10):
        prompt = page.locator(".drill-q > div").first.inner_text()
        values = [int(value) for value in re.findall(r"\d+", prompt)]
        if prompt.startswith("Use"):
            dividend, divisor = values[-2:]
            expect(page.get_by_role("figure", name=re.compile(rf"decomposition model for {dividend} divided by {divisor}", re.I))).to_be_visible()
            page.get_by_label("Your answer", exact=True).fill(str(dividend // divisor))
            page.get_by_label("Your answer", exact=True).press("Enter")
            found_target = found_target or (dividend == 84 and divisor == 3)
        else:
            dividend, divisor, quotient = values[:3]
            page.get_by_role("button", name=f"{quotient} × {divisor} = {dividend}", exact=True).click()
        expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
        if found_target:
            break
        page.wait_for_timeout(1400)
    if not found_target:
        raise AssertionError("Decomposition lesson did not exercise 84 ÷ 3")


def division_model_choice_lesson(page: Page) -> None:
    create_profile(page, "DivisionModelTester", "e2e-division-model-choice")
    open_mastery_skill(page, "Division Word Problems")
    prompt = page.locator(".drill-q > div").first.inner_text()
    dividend, divisor = [int(value) for value in re.findall(r"\d+", prompt)][:2]
    interpretation = "grouping" if re.search(r"in each|groups of", prompt, re.I) else "sharing"
    expect(page.get_by_role("figure", name=re.compile(rf"{interpretation} model for {dividend} objects", re.I))).to_be_visible()
    page.get_by_role("button", name=f"{dividend} ÷ {divisor}", exact=True).click()
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()


def scaled_bar_graph_answer(page: Page, prompt: str) -> int:
    figure = page.get_by_role("figure", name=re.compile(r"scaled bar graph.*scale counts by", re.I))
    expect(figure).to_be_visible()
    label = figure.get_attribute("aria-label")
    scale = int(re.search(r"counts by (\d+)", label).group(1))
    expect(figure.locator("svg line")).to_have_count(int(re.search(r"from 0 to (\d+)", label).group(1)) // scale * 2 + 3)
    values = [int(value) for value in re.findall(r"(?:Mia|Leo|Ava): (\d+)", label)]
    if "missing" in prompt:
        expect(figure).to_have_attribute("aria-label", re.compile(r"Ava: missing", re.I))
        values.append(values[0] + scale)
    if "Mia and Leo" in prompt:
        return values[0] + values[1]
    elif "more" in prompt:
        return values[0] - values[1]
    elif "missing" in prompt:
        return values[2]
    return values[0]


def scaled_bar_graph_lesson(page: Page) -> None:
    create_profile(page, "BarGraphTester", "e2e-scaled-bar-graph")
    open_mastery_skill(page, "Scaled Bar Graphs")
    prompt = page.locator(".drill-q > div").first.inner_text()
    answer = scaled_bar_graph_answer(page, prompt)
    page.get_by_label("Your answer", exact=True).fill(str(answer))
    page.get_by_label("Your answer", exact=True).press("Enter")
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()


def fractional_line_plot_lesson(page: Page) -> None:
    create_profile(page, "LinePlotTester", "e2e-fractional-line-plot")
    open_mastery_skill(page, "Line Plots")
    for _ in range(10):
        figure = page.get_by_role("figure").last
        label = figure.get_attribute("aria-label") or ""
        prompt = page.locator(".drill-q > div").first.inner_text()
        if "halves" in label or "quarters" in label:
            target_tick = int(re.findall(r"\d+", prompt)[0])
            observation = page.locator(f'[aria-label$="observations at tick {target_tick}"]')
            count = int(re.findall(r"\d+", observation.get_attribute("aria-label"))[0])
            page.get_by_label("Your answer", exact=True).fill(str(count))
            page.get_by_label("Your answer", exact=True).press("Enter")
            expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
            return
        observations = figure.locator('[aria-label*=" observations at tick "]')
        total = 0
        observed_ticks = []
        for index in range(observations.count()):
            count, tick = [int(value) for value in re.findall(r"\d+", observations.nth(index).get_attribute("aria-label"))]
            total += count * tick
            if count:
                observed_ticks.append(tick)
        answer = max(observed_ticks) - min(observed_ticks) if "difference" in prompt else total
        page.get_by_label("Your answer", exact=True).fill(str(answer))
        page.get_by_label("Your answer", exact=True).press("Enter")
        expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
        page.wait_for_timeout(1400)
    raise AssertionError("Line-plot lesson did not include fractional ticks")


def elapsed_cross_hour_lesson(page: Page) -> None:
    create_profile(page, "ElapsedTester", "e2e-elapsed-cross-hour")
    open_mastery_skill(page, "Elapsed Time")
    for _ in range(10):
        figure = page.get_by_role("figure", name=re.compile(r"elapsed time line from", re.I))
        label = figure.get_attribute("aria-label")
        h1, m1, h2, m2 = [int(value) for value in re.findall(r"\d+", label)]
        answer = h2 * 60 + m2 - (h1 * 60 + m1)
        page.get_by_label("Your answer", exact=True).fill(str(answer))
        page.get_by_label("Your answer", exact=True).press("Enter")
        expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
        if h1 != h2:
            return
        page.wait_for_timeout(1400)
    raise AssertionError("Elapsed-time lesson did not cross an hour")


def two_step_tape_lesson(page: Page) -> None:
    create_profile(page, "TwoStepTester", "e2e-two-step-tape")
    open_mastery_skill(page, "Two-Step Word Problems")
    prompt = page.locator(".drill-q > div").first.inner_text()
    expect(page.get_by_role("figure", name=re.compile(r"tape diagram for two_step", re.I))).to_be_visible()
    a, b, c = [int(value) for value in re.findall(r"\d+", prompt)][:3]
    if "shared equally" in prompt or "each friend" in prompt:
        answer = a // b + c if "more" in prompt or "gets" in prompt else a // b - c
    elif "rows" in prompt or "more" in prompt:
        answer = a * b + c
    elif "uses" in prompt:
        answer = a * b - c
    elif "gets" in prompt:
        answer = a // b + c
    else:
        answer = a // b - c
    page.get_by_label("Your answer", exact=True).fill(str(answer))
    page.get_by_label("Your answer", exact=True).press("Enter")
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()


def overlapping_goal_portfolio(page: Page) -> None:
    create_profile(page, "GoalPortfolioTester", "e2e-goal-portfolio")
    page.evaluate("""async () => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('mathfan');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const student = await new Promise((resolve, reject) => {
            const tx = db.transaction('students', 'readonly');
            const request = tx.objectStore('students').getAll();
            request.onsuccess = () => resolve(request.result[0]);
            request.onerror = () => reject(request.error);
        });
        const baseline = { capturedAt: '2026-06-01T00:00:00.000Z', status: 'new', attemptCount: 0, distinctItemCount: 0, recentAccuracy: 0, dueItemCount: 0, mistakePatterns: [], hintRate: 0 };
        const makeGoal = (id, title, targetDate) => ({
            id, studentId: student.id, title, source: 'manual', status: 'active', portfolioRole: 'primary',
            durationDays: 14, startDate: '2026-06-01', targetDate,
            targets: [{ id: `target-${id}`, skillId: 'g3-mul-meaning', reason: 'needs_evaluation', baseline, targetAccuracy: .8, minFirstAttempts: 8, minDistinctItems: 4, minActiveDays: 2, maxHintRate: .25, misconceptionTargets: [], weight: 1 }],
            createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
        });
        await new Promise((resolve, reject) => {
            const tx = db.transaction('learningGoals', 'readwrite');
            tx.objectStore('learningGoals').put(makeGoal('goal-a', 'Multiplication Foundation', '2026-07-01'));
            tx.objectStore('learningGoals').put(makeGoal('goal-b', 'Array Practice', '2026-08-01'));
            tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
        });
        db.close();
    }""")
    page.reload(wait_until="domcontentloaded")
    page.get_by_role("button", name=re.compile(r"Goals")).click()
    expect(page.get_by_role("heading", name="Goals", exact=True)).to_be_visible()
    expect(page.get_by_role("region", name="Active plan")).to_contain_text("one shared daily quota")
    expect(page.get_by_text(re.compile(r"past its target date and remains active"))).to_be_visible()
    expect(page.get_by_text("Target date reached.", exact=True)).to_be_visible()

    page.get_by_role("button", name="Add Goal", exact=True).click()
    page.get_by_role("button", name="Next", exact=True).click()
    page.get_by_role("button", name="Browse all skills", exact=True).click()
    page.get_by_text("Meaning of Multiplication", exact=True).last.click()
    page.get_by_role("button", name="Next", exact=True).click()
    page.get_by_label("Goal title", exact=True).fill("Third Primary Goal")
    expect(page.get_by_text(re.compile(r"third primary goal"))).to_be_visible()
    page.get_by_role("button", name="Create anyway", exact=True).click()
    page.get_by_role("button", name="Save Goal", exact=True).click()
    expect(page.get_by_text("Third Primary Goal", exact=True)).to_be_visible()
    expect(page.get_by_text(re.compile(r"More than two primary goals"))).to_be_visible()


def adaptive_lesson_and_manual_fallback(page: Page) -> None:
    create_profile(page, "AdaptiveLessonTester", "e2e-adaptive-lesson")
    page.evaluate("""async () => {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('mathfan'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const student = await new Promise((resolve, reject) => { const request = db.transaction('students').objectStore('students').getAll(); request.onsuccess = () => resolve(request.result[0]); request.onerror = () => reject(request.error); });
        const goal = { id: 'adaptive-goal', studentId: student.id, title: 'Multiplication Focus', source: 'manual', status: 'active', portfolioRole: 'primary', durationDays: 14, startDate: '2026-07-10', targetDate: '2026-07-30', createdAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z', targets: [{ id: 'adaptive-target', skillId: 'g3-mul-tables-basic', reason: 'needs_evaluation', baseline: { capturedAt: '2026-07-10T00:00:00.000Z', status: 'new', attemptCount: 0, distinctItemCount: 0, recentAccuracy: 0, dueItemCount: 0, mistakePatterns: [], hintRate: 0 }, targetAccuracy: .8, minFirstAttempts: 8, minDistinctItems: 4, minActiveDays: 2, maxHintRate: .25, misconceptionTargets: [], weight: 1 }] };
        await new Promise((resolve, reject) => { const tx = db.transaction('learningGoals', 'readwrite'); tx.objectStore('learningGoals').put(goal); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
    }""")
    page.reload(wait_until="domcontentloaded")
    lesson = page.get_by_role("region", name="Start Today’s Lesson")
    expect(lesson).to_be_visible()
    lesson.get_by_role("button", name="See plan", exact=True).click()
    expect(lesson.get_by_text("Why this plan?", exact=True)).to_be_visible()
    lesson.get_by_role("button", name="Regenerate plan", exact=True).click()
    expect(lesson.get_by_text(re.compile(r"Plan date .* revision 2"))).to_be_visible()
    expect(lesson).to_contain_text("Focus: Times Tables 1–5")
    first_plan = page.evaluate("""async () => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('mathfan'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); const rows = await new Promise((resolve, reject) => { const r = db.transaction('dailyLessonPlans').objectStore('dailyLessonPlans').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); db.close(); return rows[0].items.map(entry => entry.item.id); }""")
    page.reload(wait_until="domcontentloaded")
    lesson = page.get_by_role("region", name="Start Today’s Lesson")
    expect(lesson).to_be_visible()
    resumed_plan = page.evaluate("""async () => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('mathfan'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); const rows = await new Promise((resolve, reject) => { const r = db.transaction('dailyLessonPlans').objectStore('dailyLessonPlans').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); db.close(); return rows[0].items.map(entry => entry.item.id); }""")
    assert resumed_plan == first_plan, "Today’s Lesson item order changed after reload"
    lesson.get_by_role("button", name="Start lesson", exact=True).click()
    for _ in range(30):
        if page.get_by_role("button", name="Home", exact=True).count():
            break
        answer_input = page.get_by_label("Your answer", exact=True)
        expect(answer_input).to_be_visible()
        prompt = page.locator(".drill-q > div").first.inner_text()
        values = [int(value) for value in re.findall(r"\d+", prompt)]
        is_bar_graph = "bar graph" in prompt
        if not is_bar_graph and len(values) < 2:
            page.wait_for_timeout(500)
            continue
        answer = scaled_bar_graph_answer(page, prompt) if is_bar_graph else values[0] * values[1]
        if not is_bar_graph and re.search(r"shared equally|among \d+", prompt, re.I):
            answer = values[0] // values[1]
        if not is_bar_graph and len(values) >= 3:
            change = values[2]
            answer = answer - change if re.search(r"left|removed|taken away|\buses\b", prompt, re.I) else answer + change
        answer_input.fill(str(answer))
        answer_input.press("Enter")
        expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
        page.wait_for_timeout(1200)
    expect(page.get_by_role("button", name="Home", exact=True)).to_be_visible()
    telemetry_summary = page.evaluate("""async () => {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('mathfan'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const events = await new Promise((resolve, reject) => { const request = db.transaction('mathAnswerEvents').objectStore('mathAnswerEvents').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close();
        const direct = events.filter(event => event.lessonPlanId && !event.relatedEvidence);
        return { count: direct.length, segments: [...new Set(direct.map(event => event.schedulingTelemetry?.selection?.lessonSegment))], complete: direct.every(event => {
            const telemetry = event.schedulingTelemetry;
            return telemetry?.cardKey && telemetry.selection && telemetry.before
                && telemetry.rating && telemetry.instance
                && event.schedulingApplied === telemetry.schedulingApplied
                && (telemetry.schedulingApplied ? Boolean(telemetry.after) : !telemetry.after);
        }) };
    }""")
    if telemetry_summary["count"] < 20 or set(telemetry_summary["segments"]) != {"focus", "transfer"} or not telemetry_summary["complete"]:
        raise AssertionError(f"Adaptive lesson telemetry is incomplete: {telemetry_summary}")
    page.get_by_role("button", name="Home", exact=True).click()
    page.get_by_role("button", name=re.compile(r"Multiply")).click()
    expect(page.get_by_role("heading", name="Multiplication", exact=True)).to_be_visible()


def daily_review_requested_rounds(page: Page) -> None:
    create_profile(page, "RoundsTester", "e2e-review-rounds")
    page.evaluate("""async () => {
        const db = await new Promise((resolve, reject) => { const r = indexedDB.open('mathfan'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        const student = await new Promise((resolve, reject) => { const r = db.transaction('students').objectStore('students').getAll(); r.onsuccess = () => resolve(r.result[0]); r.onerror = () => reject(r.error); });
        const rows = [['MUL_2x3', 'fact:mul:2x3'], ['MUL_4x5', 'fact:mul:4x5']].map(([lastItemId, cardKey]) => ({ studentId: student.id, cardKey, lastItemId, skillId: 'g3-mul-tables-basic', attemptCount: 2, correctCount: 1, lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1000, ease: 2.5, stabilityDays: 1, difficulty: .2, masteryLevel: 'learning', nextDueAt: '2026-01-01T00:00:00.000Z', mistakePatterns: [] }));
        await new Promise((resolve, reject) => { const tx = db.transaction('itemStates', 'readwrite'); rows.forEach(row => tx.objectStore('itemStates').put(row)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
    }""")
    page.reload(wait_until="domcontentloaded")
    page.locator("button").filter(has_text=re.compile(r"Multiply.*2")).click()
    expect(page.get_by_text(re.compile(r"Only the first presentation updates long-term review timing"))).to_be_visible()
    page.get_by_label("Number of rounds", exact=True).fill("3")
    expect(page.get_by_text(re.compile(r"2 × 3 =\s*6 questions"))).to_be_visible()
    page.get_by_role("button", name="Start", exact=True).click()
    for _ in range(6):
        prompt = page.locator(".drill-q > div").first.inner_text()
        values = [int(value) for value in re.findall(r"\d+", prompt)]
        page.get_by_label("Your answer", exact=True).fill(str(values[0] * values[1]))
        page.get_by_label("Your answer", exact=True).press("Enter")
        expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
        page.wait_for_timeout(1200)
    expect(page.get_by_role("heading", name="Session Complete!", exact=True)).to_be_visible()
    expect(page.get_by_text("You solved 6 problems.", exact=True)).to_be_visible()


def practice_save_failure_recovery(page: Page) -> None:
    create_profile(page, "SaveRecoveryTester", "e2e-save-recovery")
    page.get_by_role("button", name=re.compile(r"Multiply")).click()
    page.get_by_label("First number smallest", exact=True).fill("1")
    page.get_by_label("First number largest", exact=True).fill("1")
    page.get_by_label("Second number smallest", exact=True).fill("1")
    page.get_by_label("Second number largest", exact=True).fill("1")
    page.get_by_label("Number of questions", exact=True).fill("1")
    page.get_by_role("button", name=re.compile(r"Start — 1 questions")).click()
    page.evaluate("""() => {
        window.__mathfanOriginalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value, key) {
            if (this.name === 'mathAnswerEvents') throw new DOMException('Simulated storage failure', 'QuotaExceededError');
            return window.__mathfanOriginalPut.call(this, value, key);
        };
    }""")
    page.get_by_label("Your answer", exact=True).fill("1")
    page.get_by_label("Your answer", exact=True).press("Enter")
    expect(page.get_by_role("button", name="Retry saving", exact=True)).to_be_visible()
    expect(page.get_by_text("0/1 · 0 ✓", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name=re.compile(r"Next"))).to_have_count(0)
    page.evaluate("""() => { IDBObjectStore.prototype.put = window.__mathfanOriginalPut; }""")
    page.get_by_role("button", name="Retry saving", exact=True).click()
    expect(page.get_by_text(re.compile(r"Correct!|New personal best!"))).to_be_visible()
    expect(page.get_by_text("1/1 · 1 ✓", exact=True)).to_be_visible()


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
            ("legacy-downloaded-backup-restore", {"width": 1024, "height": 768}, legacy_downloaded_backup_restore, False),
            ("missing-side-lesson", {"width": 390, "height": 844}, area_perimeter_missing_side_lesson, False),
            ("area-perimeter-comparison", {"width": 1024, "height": 768}, area_perimeter_comparison_lesson, False),
            ("fraction-equivalence-visual", {"width": 390, "height": 844}, fraction_equivalence_visual_lesson, False),
            ("fraction-same-numerator", {"width": 1024, "height": 768}, fraction_same_numerator_lesson, False),
            ("subtraction-across-zero", {"width": 390, "height": 844}, subtraction_across_zero_lesson, False),
            ("division-decomposition", {"width": 390, "height": 844}, division_decomposition_lesson, False),
            ("division-model-choice", {"width": 820, "height": 1180}, division_model_choice_lesson, False),
            ("scaled-bar-graph", {"width": 390, "height": 844}, scaled_bar_graph_lesson, False),
            ("fractional-line-plot", {"width": 820, "height": 1180}, fractional_line_plot_lesson, False),
            ("elapsed-cross-hour", {"width": 390, "height": 844}, elapsed_cross_hour_lesson, False),
            ("two-step-tape", {"width": 820, "height": 1180}, two_step_tape_lesson, False),
            ("overlapping-goal-portfolio", {"width": 820, "height": 1180}, overlapping_goal_portfolio, False),
            ("adaptive-lesson-and-manual", {"width": 390, "height": 844}, adaptive_lesson_and_manual_fallback, False),
            ("daily-review-requested-rounds", {"width": 390, "height": 844}, daily_review_requested_rounds, False),
            ("practice-save-recovery", {"width": 390, "height": 844}, practice_save_failure_recovery, False),
            ("legacy-scheduler-upgrade", {"width": 1024, "height": 768}, legacy_scheduler_upgrade, False),
            ("distinct-same-name-learners", {"width": 1024, "height": 768}, distinct_same_name_learners, False),
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
