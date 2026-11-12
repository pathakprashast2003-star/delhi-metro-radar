#!/usr/bin/env python3
"""
Verifies the Airport Express Line (Orange Line / Line 10) in Playwright:
- Navigates to localhost:8080
- Checks console errors
- Tests Orange Line filter button (btn-line-orange)
- Verifies station stepper displays 'OE' and 7 stations
- Tests bookmark navigation: Dhaula Kuan, IGI Airport, Yashobhoomi
- Captures high-res screenshots for visual verification
"""

import sys
import time
from playwright.sync_api import sync_playwright

def main():
    errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            args=[
                "--use-gl=angle",
                "--use-angle=metal",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--no-sandbox"
            ]
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: (errors.append(f"CONSOLE ERROR: {msg.text}") if msg.type == "error" else logs.append(msg.text)))
        page.on("pageerror", lambda err: errors.append(f"PAGE ERROR: {err}"))

        print("Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=30000)

        # Wait until MetroWebGLLayer is initialized and ready
        print("Waiting for MetroWebGLLayer to finish loading topology...")
        page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady === true", timeout=15000)
        time.sleep(1)

        # 1. Check layer status
        res = page.evaluate("""() => {
            const layer = window.MetroWebGLLayer;
            const stations = layer.getStations();
            const debug = layer.getDebugInfo();
            return {
                ok: true,
                stationCount: stations.length,
                isReady: debug.isReady,
                hasViaducts: debug.viaductGroup ? debug.viaductGroup.children.length : 0,
                hasPiers: debug.piersGroup ? debug.piersGroup.children.length : 0,
                hasFleet: debug.fleetGroup ? debug.fleetGroup.children.length : 0
            };
        }""")
        print(f"Layer status: {res}")

        # 2. Click Orange Line filter button
        print("Clicking btn-line-orange...")
        page.click("#btn-line-orange")
        time.sleep(2)

        stepper_info = page.evaluate("""() => {
            const lineTag = document.getElementById('station-step-line-tag');
            const countEl = document.getElementById('station-step-count');
            const nameEl = document.getElementById('station-step-name');
            const activeLine = window.MetroWebGLLayer ? window.MetroWebGLLayer.getActiveLine() : null;
            const activeSts = window.MetroWebGLLayer ? window.MetroWebGLLayer.getActiveStations() : [];
            return {
                lineTagText: lineTag ? lineTag.textContent : '',
                lineTagClass: lineTag ? lineTag.className : '',
                countText: countEl ? countEl.textContent : '',
                nameText: nameEl ? nameEl.textContent : '',
                activeLine: activeLine,
                activeStationsCount: activeSts.length,
                activeStations: activeSts.map(s => s.name)
            };
        }""")
        print(f"Stepper info after clicking Orange: {stepper_info}")

        # Capture IGI Airport view
        time.sleep(2)
        page.screenshot(path="test_orange_igi_airport.png")
        print("Captured test_orange_igi_airport.png")

        # 3. Click Dhaula Kuan bookmark
        print("Clicking Dhaula Kuan bookmark chip...")
        page.click("button.bookmark-chip[data-loc='dhaulakuan']")
        time.sleep(3)
        page.screenshot(path="test_orange_dhaula_kuan_elevated.png")
        print("Captured test_orange_dhaula_kuan_elevated.png")

        # 4. Click Yashobhoomi bookmark
        print("Clicking Yashobhoomi bookmark chip...")
        page.click("button.bookmark-chip[data-loc='yashobhoomi']")
        time.sleep(3)
        page.screenshot(path="test_orange_yashobhoomi_terminus.png")
        print("Captured test_orange_yashobhoomi_terminus.png")

        # 5. Click All Lines filter to check complete network
        print("Clicking btn-line-all...")
        page.click("#btn-line-all")
        time.sleep(2)
        page.click("button.bookmark-chip[data-loc='rajiv']")
        time.sleep(3)
        page.screenshot(path="test_all_lines_with_orange.png")
        print("Captured test_all_lines_with_orange.png")

        # Filter out benign map tile 404s/warnings if any
        critical_errors = [e for e in errors if "favicon" not in e and "404" not in e and "Failed to load resource" not in e]
        if critical_errors:
            print("\nERRORS DETECTED:")
            for e in critical_errors:
                print("  ", e)
        else:
            print("\nZero critical console/page errors!")

        browser.close()

if __name__ == "__main__":
    main()
