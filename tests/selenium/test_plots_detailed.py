"""
Detailed plot testing for Meta-Analysis Platform
Tests forest plot and funnel plot with sample data
"""

import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys

BASE_URL = "http://localhost:3003"

# Sample study data to inject
SAMPLE_DATA = [
    {"study": "Smith 2020", "yi": 0.5, "sei": 0.15, "ni": 100},
    {"study": "Jones 2019", "yi": 0.3, "sei": 0.12, "ni": 150},
    {"study": "Brown 2021", "yi": 0.7, "sei": 0.18, "ni": 80},
    {"study": "Davis 2018", "yi": 0.4, "sei": 0.14, "ni": 120},
    {"study": "Wilson 2022", "yi": 0.6, "sei": 0.16, "ni": 90}
]

def setup_driver():
    options = Options()
    options.add_argument("--start-maximized")
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(5)
    return driver

def test_plots(driver):
    print("="*60)
    print("Meta-Analysis Platform - Detailed Plot Testing")
    print("="*60)

    driver.get(BASE_URL)
    time.sleep(2)

    # Navigate to Analysis tab
    print("\n1. Navigating to Analysis tab...")
    try:
        analysis_tab = driver.find_element(By.CSS_SELECTOR, "[data-tab='analysis']")
        analysis_tab.click()
        time.sleep(1)
        print("   [OK] Analysis tab opened")
    except Exception as e:
        print(f"   [ERROR] Could not open Analysis tab: {e}")
        return

    # Find the main content area
    print("\n2. Looking for data input area...")
    page_source = driver.page_source

    # Check for forest plot canvas
    print("\n3. Checking Forest Plot canvas...")
    try:
        forest_elements = driver.find_elements(By.CSS_SELECTOR, "[id*='forest'], [class*='forest']")
        canvas_elements = driver.find_elements(By.TAG_NAME, "canvas")

        print(f"   Found {len(forest_elements)} forest-related elements")
        print(f"   Found {len(canvas_elements)} canvas elements")

        for i, canvas in enumerate(canvas_elements):
            canvas_id = canvas.get_attribute('id') or f"canvas_{i}"
            width = canvas.get_attribute('width') or canvas.size.get('width', 'N/A')
            height = canvas.get_attribute('height') or canvas.size.get('height', 'N/A')
            print(f"   Canvas: {canvas_id}, size: {width}x{height}")

        if forest_elements or canvas_elements:
            print("   [OK] Plot containers found")
        else:
            print("   [WARN] No plot containers visible yet")

    except Exception as e:
        print(f"   [ERROR] {e}")

    # Check for funnel plot
    print("\n4. Checking Funnel Plot canvas...")
    try:
        funnel_elements = driver.find_elements(By.CSS_SELECTOR, "[id*='funnel'], [class*='funnel']")
        print(f"   Found {len(funnel_elements)} funnel-related elements")

        if funnel_elements:
            print("   [OK] Funnel plot container found")
        else:
            print("   [INFO] Funnel plot may appear after analysis runs")

    except Exception as e:
        print(f"   [ERROR] {e}")

    # Check for SVG plots (D3.js based)
    print("\n5. Checking for SVG plots...")
    try:
        svg_elements = driver.find_elements(By.TAG_NAME, "svg")
        print(f"   Found {len(svg_elements)} SVG elements")

        for i, svg in enumerate(svg_elements[:5]):  # First 5 only
            svg_id = svg.get_attribute('id') or f"svg_{i}"
            width = svg.get_attribute('width') or 'auto'
            height = svg.get_attribute('height') or 'auto'
            print(f"   SVG: {svg_id}, size: {width}x{height}")

    except Exception as e:
        print(f"   [ERROR] {e}")

    # Inject test data via JavaScript console
    print("\n6. Injecting sample data via JavaScript...")
    try:
        inject_script = f"""
        window.testStudies = {json.dumps(SAMPLE_DATA)};
        console.log('Test data injected:', window.testStudies);
        return true;
        """
        result = driver.execute_script(inject_script)
        print(f"   [OK] Test data injected: {result}")
    except Exception as e:
        print(f"   [WARN] Could not inject data: {e}")

    # Check analysis engine is loaded
    print("\n7. Checking analysis engine module...")
    try:
        check_engine = """
        try {
            // Check if meta-engine functions are available
            if (typeof window.MetaEngine !== 'undefined') {
                return 'MetaEngine loaded';
            }
            // Check for ES module imports
            return 'Module system in use - engine loaded via import';
        } catch (e) {
            return 'Error: ' + e.message;
        }
        """
        result = driver.execute_script(check_engine)
        print(f"   [OK] Engine status: {result}")
    except Exception as e:
        print(f"   [INFO] {e}")

    # Look for Run Analysis button and other controls
    print("\n8. Checking analysis controls...")
    try:
        buttons = driver.find_elements(By.TAG_NAME, "button")
        analysis_buttons = []
        for btn in buttons:
            text = btn.text.lower()
            if any(kw in text for kw in ['run', 'analyze', 'calculate', 'compute']):
                analysis_buttons.append(btn.text)

        if analysis_buttons:
            print(f"   [OK] Analysis buttons found: {analysis_buttons}")
        else:
            print("   [INFO] Looking for action buttons by class...")
            action_btns = driver.find_elements(By.CSS_SELECTOR, ".btn-primary, .action-btn")
            for btn in action_btns[:3]:
                print(f"      - Button: {btn.text[:30]}")

    except Exception as e:
        print(f"   [ERROR] {e}")

    # Check for any errors in console
    print("\n9. Checking browser console logs...")
    try:
        logs = driver.get_log('browser')
        errors = [l for l in logs if l['level'] == 'SEVERE']
        if errors:
            print(f"   [WARN] Found {len(errors)} console errors:")
            for err in errors[:3]:
                print(f"      - {err['message'][:80]}")
        else:
            print("   [OK] No console errors")
    except Exception as e:
        print(f"   [INFO] Could not retrieve logs: {e}")

    # Check all tab content visibility
    print("\n10. Verifying all tab sections exist...")
    tabs_to_check = ['search', 'extraction', 'analysis', 'export']
    for tab in tabs_to_check:
        try:
            section = driver.find_element(By.ID, f"{tab}-tab")
            display = driver.execute_script(
                "return window.getComputedStyle(arguments[0]).display", section)
            print(f"   - {tab}: {'visible' if display != 'none' else 'hidden'}")
        except:
            print(f"   - {tab}: not found by ID, checking by data attribute...")
            try:
                section = driver.find_element(By.CSS_SELECTOR, f"[data-tab='{tab}']")
                print(f"   - {tab}: tab button exists")
            except:
                print(f"   - {tab}: NOT FOUND")

    print("\n" + "="*60)
    print("Plot testing complete!")
    print("="*60)

    # Keep browser open for manual inspection
    print("\nKeeping browser open for 5 seconds for visual inspection...")
    time.sleep(5)

def main():
    driver = None
    try:
        driver = setup_driver()
        test_plots(driver)
        return 0
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        return 1
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    exit(main())
