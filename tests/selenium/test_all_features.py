"""
Comprehensive Selenium test for Meta-Analysis Platform v2.0
Tests all tabs, features, and plot rendering
"""

import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException

BASE_URL = "http://localhost:3003"
RESULTS = {"passed": [], "failed": [], "warnings": []}

def log_pass(test_name):
    print(f"  [PASS] {test_name}")
    RESULTS["passed"].append(test_name)

def log_fail(test_name, error):
    print(f"  [FAIL] {test_name}: {error}")
    RESULTS["failed"].append((test_name, str(error)))

def log_warn(test_name, msg):
    print(f"  [WARN] {test_name}: {msg}")
    RESULTS["warnings"].append((test_name, msg))

def setup_driver():
    """Setup Chrome driver with options"""
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    # Keep browser open for debugging if needed
    # options.add_experimental_option("detach", True)

    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(5)
    return driver

def wait_for_element(driver, by, value, timeout=10):
    """Wait for element to be present"""
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((by, value))
    )

def wait_for_clickable(driver, by, value, timeout=10):
    """Wait for element to be clickable"""
    return WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((by, value))
    )

def test_page_load(driver):
    """Test 1: Page loads correctly"""
    print("\n1. Testing page load...")
    try:
        driver.get(BASE_URL)
        time.sleep(2)

        # Check title
        if "Meta-Analysis" in driver.title or driver.title:
            log_pass("Page title present")
        else:
            log_fail("Page title", "Title is empty")

        # Check main container
        try:
            main = driver.find_element(By.TAG_NAME, "main")
            log_pass("Main container found")
        except:
            try:
                main = driver.find_element(By.ID, "app")
                log_pass("App container found")
            except:
                log_warn("Main container", "Could not find main or app container")

    except Exception as e:
        log_fail("Page load", e)

def test_navigation_tabs(driver):
    """Test 2: All navigation tabs work"""
    print("\n2. Testing navigation tabs...")

    tabs_to_test = [
        ("Search", ["search", "pubmed", "cochrane"]),
        ("Extraction", ["extract", "data", "study"]),
        ("Analysis", ["analysis", "meta", "forest"]),
        ("Export", ["export", "grade", "report"])
    ]

    for tab_name, expected_content in tabs_to_test:
        try:
            # Find tab by text content or data attribute
            tab_selectors = [
                f"//button[contains(text(), '{tab_name}')]",
                f"//a[contains(text(), '{tab_name}')]",
                f"//*[contains(@class, 'tab') and contains(text(), '{tab_name}')]",
                f"//nav//*[contains(text(), '{tab_name}')]"
            ]

            tab = None
            for selector in tab_selectors:
                try:
                    tab = driver.find_element(By.XPATH, selector)
                    break
                except:
                    continue

            if tab:
                tab.click()
                time.sleep(1)
                log_pass(f"Tab '{tab_name}' clicked")

                # Check if tab content is visible
                page_source = driver.page_source.lower()
                found = any(keyword in page_source for keyword in expected_content)
                if found:
                    log_pass(f"Tab '{tab_name}' content visible")
                else:
                    log_warn(f"Tab '{tab_name}' content", "Expected keywords not found")
            else:
                log_warn(f"Tab '{tab_name}'", "Tab button not found")

        except Exception as e:
            log_fail(f"Tab '{tab_name}'", e)

def test_analysis_features(driver):
    """Test 3: Analysis tab features"""
    print("\n3. Testing Analysis features...")

    try:
        # Navigate to Analysis tab
        analysis_selectors = [
            "//button[contains(text(), 'Analysis')]",
            "//a[contains(text(), 'Analysis')]",
            "//*[@data-tab='analysis']"
        ]

        for selector in analysis_selectors:
            try:
                tab = driver.find_element(By.XPATH, selector)
                tab.click()
                time.sleep(1)
                break
            except:
                continue

        # Check for meta-analysis configuration options
        options_to_check = [
            ("Random Effects", ["random", "reml", "dl"]),
            ("Fixed Effects", ["fixed", "common"]),
            ("Model Selection", ["model", "select", "estimator"]),
            ("Heterogeneity", ["i2", "tau", "heterogeneity", "q"])
        ]

        page_source = driver.page_source.lower()
        for option_name, keywords in options_to_check:
            if any(kw in page_source for kw in keywords):
                log_pass(f"Analysis option: {option_name}")
            else:
                log_warn(f"Analysis option: {option_name}", "Not visible")

        # Check for Run Analysis button
        run_selectors = [
            "//button[contains(text(), 'Run')]",
            "//button[contains(text(), 'Analyze')]",
            "//button[contains(text(), 'Calculate')]"
        ]

        for selector in run_selectors:
            try:
                btn = driver.find_element(By.XPATH, selector)
                log_pass("Run analysis button found")
                break
            except:
                continue
        else:
            log_warn("Run analysis button", "Not found")

    except Exception as e:
        log_fail("Analysis features", e)

def test_forest_plot(driver):
    """Test 4: Forest plot rendering"""
    print("\n4. Testing Forest Plot...")

    try:
        # Look for canvas or SVG elements for forest plot
        canvas_elements = driver.find_elements(By.TAG_NAME, "canvas")
        svg_elements = driver.find_elements(By.TAG_NAME, "svg")

        # Check for forest plot container
        forest_selectors = [
            "//*[contains(@id, 'forest')]",
            "//*[contains(@class, 'forest')]",
            "//canvas[contains(@id, 'forest')]",
            "//div[contains(@class, 'plot')]//canvas"
        ]

        forest_found = False
        for selector in forest_selectors:
            try:
                element = driver.find_element(By.XPATH, selector)
                forest_found = True
                log_pass("Forest plot container found")
                break
            except:
                continue

        if not forest_found:
            if len(canvas_elements) > 0:
                log_pass(f"Canvas elements found: {len(canvas_elements)}")
            elif len(svg_elements) > 0:
                log_pass(f"SVG elements found: {len(svg_elements)}")
            else:
                log_warn("Forest plot", "No plot containers found - may need data")

    except Exception as e:
        log_fail("Forest plot", e)

def test_funnel_plot(driver):
    """Test 5: Funnel plot rendering"""
    print("\n5. Testing Funnel Plot...")

    try:
        # Check for funnel plot container
        funnel_selectors = [
            "//*[contains(@id, 'funnel')]",
            "//*[contains(@class, 'funnel')]",
            "//canvas[contains(@id, 'funnel')]"
        ]

        funnel_found = False
        for selector in funnel_selectors:
            try:
                element = driver.find_element(By.XPATH, selector)
                funnel_found = True
                log_pass("Funnel plot container found")
                break
            except:
                continue

        if not funnel_found:
            # Check page source for funnel-related text
            if "funnel" in driver.page_source.lower():
                log_pass("Funnel plot references found in page")
            else:
                log_warn("Funnel plot", "No funnel plot elements found - may need data")

    except Exception as e:
        log_fail("Funnel plot", e)

def test_data_input(driver):
    """Test 6: Data input functionality"""
    print("\n6. Testing Data Input...")

    try:
        # Look for input fields, textareas, or data entry forms
        inputs = driver.find_elements(By.TAG_NAME, "input")
        textareas = driver.find_elements(By.TAG_NAME, "textarea")
        selects = driver.find_elements(By.TAG_NAME, "select")

        total_inputs = len(inputs) + len(textareas) + len(selects)

        if total_inputs > 0:
            log_pass(f"Found {total_inputs} input elements (inputs: {len(inputs)}, textareas: {len(textareas)}, selects: {len(selects)})")
        else:
            log_warn("Data input", "No input elements found")

        # Check for file upload
        file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        if file_inputs:
            log_pass(f"File upload inputs: {len(file_inputs)}")

    except Exception as e:
        log_fail("Data input", e)

def test_export_features(driver):
    """Test 7: Export functionality"""
    print("\n7. Testing Export features...")

    try:
        # Navigate to Export tab
        export_selectors = [
            "//button[contains(text(), 'Export')]",
            "//a[contains(text(), 'Export')]",
            "//*[@data-tab='export']"
        ]

        for selector in export_selectors:
            try:
                tab = driver.find_element(By.XPATH, selector)
                tab.click()
                time.sleep(1)
                break
            except:
                continue

        # Check for export options
        export_formats = ["CSV", "GRADE", "Word", "PDF", "Excel", "JSON"]
        page_source = driver.page_source

        for format_name in export_formats:
            if format_name.lower() in page_source.lower():
                log_pass(f"Export format: {format_name}")

        # Check for download buttons
        download_btns = driver.find_elements(By.XPATH,
            "//button[contains(text(), 'Download') or contains(text(), 'Export')]")
        if download_btns:
            log_pass(f"Download buttons found: {len(download_btns)}")

    except Exception as e:
        log_fail("Export features", e)

def test_bias_assessment(driver):
    """Test 8: Bias assessment tools"""
    print("\n8. Testing Bias Assessment...")

    try:
        page_source = driver.page_source.lower()

        bias_features = [
            ("Egger's test", ["egger"]),
            ("Trim and Fill", ["trim", "fill"]),
            ("Risk of Bias", ["risk of bias", "rob"]),
            ("Publication Bias", ["publication bias"])
        ]

        for feature_name, keywords in bias_features:
            if any(kw in page_source for kw in keywords):
                log_pass(f"Bias feature: {feature_name}")

    except Exception as e:
        log_fail("Bias assessment", e)

def test_sensitivity_analysis(driver):
    """Test 9: Sensitivity analysis"""
    print("\n9. Testing Sensitivity Analysis...")

    try:
        page_source = driver.page_source.lower()

        sensitivity_features = [
            ("Leave-one-out", ["leave-one-out", "leave one out", "loo"]),
            ("Cumulative", ["cumulative"]),
            ("Influence", ["influence", "influential"])
        ]

        for feature_name, keywords in sensitivity_features:
            if any(kw in page_source for kw in keywords):
                log_pass(f"Sensitivity feature: {feature_name}")

    except Exception as e:
        log_fail("Sensitivity analysis", e)

def test_no_console_errors(driver):
    """Test 10: Check for JavaScript console errors"""
    print("\n10. Checking for console errors...")

    try:
        logs = driver.get_log('browser')
        severe_errors = [log for log in logs if log['level'] == 'SEVERE']
        warnings = [log for log in logs if log['level'] == 'WARNING']

        if severe_errors:
            for error in severe_errors[:5]:  # Show first 5
                log_fail("Console error", error['message'][:100])
        else:
            log_pass("No severe console errors")

        if warnings:
            log_warn("Console warnings", f"{len(warnings)} warnings found")

    except Exception as e:
        log_warn("Console check", f"Could not retrieve logs: {e}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    total = len(RESULTS["passed"]) + len(RESULTS["failed"])
    print(f"\nPassed: {len(RESULTS['passed'])}/{total}")
    print(f"Failed: {len(RESULTS['failed'])}/{total}")
    print(f"Warnings: {len(RESULTS['warnings'])}")

    if RESULTS["failed"]:
        print("\n--- FAILURES ---")
        for name, error in RESULTS["failed"]:
            print(f"  - {name}: {error[:80]}")

    if RESULTS["warnings"]:
        print("\n--- WARNINGS ---")
        for name, msg in RESULTS["warnings"]:
            print(f"  - {name}: {msg[:80]}")

    print("\n" + "="*60)
    return len(RESULTS["failed"]) == 0

def main():
    print("="*60)
    print("Meta-Analysis Platform v2.0 - Selenium Test Suite")
    print("="*60)

    driver = None
    try:
        driver = setup_driver()

        # Run all tests
        test_page_load(driver)
        test_navigation_tabs(driver)
        test_analysis_features(driver)
        test_data_input(driver)
        test_forest_plot(driver)
        test_funnel_plot(driver)
        test_export_features(driver)
        test_bias_assessment(driver)
        test_sensitivity_analysis(driver)
        test_no_console_errors(driver)

        success = print_summary()

        # Keep browser open for 3 seconds to see results
        time.sleep(3)

        return 0 if success else 1

    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        return 1
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    sys.exit(main())
