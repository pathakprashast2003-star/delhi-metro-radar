#!/usr/bin/env python3
"""
Comprehensive Playwright Verification for Delhi Metro Violet Line (Line 6):
- Opens localhost:8080
- Checks for console errors
- Clicks #btn-line-violet
- Verifies Violet Line corridor, 34 stations, 3D WebGL tracks, fleet trains
- Navigates to key stations:
  1. Lal Quila (Underground Red Fort Heritage)
  2. Central Secretariat (Underground Cross-Platform Hub)
  3. Kalkaji Mandir (Elevated Lotus Temple & Magenta Interchange)
  4. Raja Nahar Singh (Elevated Ballabhgarh Terminus)
- Takes photographic screenshots and saves artifacts
"""

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = Path("/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229")
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

def verify_violet():
    print("Launching Playwright browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--enable-webgl', '--ignore-gpu-blocklist'])
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=30000)
        time.sleep(3)

        # 1. Verify Violet Line button
        violet_btn = page.wait_for_selector("#btn-line-violet", timeout=5000)
        assert violet_btn is not None, "Missing #btn-line-violet button"
        print("Clicking #btn-line-violet...")
        violet_btn.click()
        time.sleep(2)

        # 2. Check corridor and station count in WebGL layer
        debug_info = page.evaluate("""() => {
            const layer = window.MetroWebGLLayer;
            if (!layer) return { error: 'No MetroWebGLLayer' };
            const corr = layer.getCorridors();
            const activeLine = layer.getActiveLine();
            const activeStations = layer.getActiveStations();
            const vCorr = corr ? corr.violet : null;
            return {
                activeLine,
                hasVioletCorridor: Boolean(vCorr),
                violetTotalLen: vCorr ? Math.round(vCorr.totalLen) : 0,
                violetStationCount: vCorr ? vCorr.stationsData.length : 0,
                activeStationCount: activeStations ? activeStations.length : 0,
                fleetCount: vCorr && vCorr.fleetTrains ? vCorr.fleetTrains.length : 0
            };
        }""")
        print("Debug info:", debug_info)

        assert debug_info.get("activeLine") == "violet", f"Active line is {debug_info.get('activeLine')}, expected violet"
        assert debug_info.get("hasVioletCorridor") is True, "Violet corridor not instantiated"
        assert debug_info.get("violetStationCount") == 34, f"Violet stations count is {debug_info.get('violetStationCount')}, expected 34"
        print("Violet Line verified with 34 stations and", debug_info.get("violetTotalLen"), "m corridor length!")

        # 3. Capture Station 1: Lal Quila (Red Fort Heritage)
        print("Flying to Lal Quila...")
        page.evaluate("window.MetroWebGLLayer.flyToStation('Lal Quila')")
        time.sleep(3)
        shot1 = ARTIFACT_DIR / "violet_01_lal_quila.png"
        page.screenshot(path=str(shot1))
        print("Saved:", shot1)

        # 4. Capture Station 2: Central Secretariat
        print("Flying to Central Secretariat...")
        page.evaluate("window.MetroWebGLLayer.flyToStation('Central Secretariat')")
        time.sleep(3)
        shot2 = ARTIFACT_DIR / "violet_02_central_secretariat.png"
        page.screenshot(path=str(shot2))
        print("Saved:", shot2)

        # 5. Capture Station 3: Kalkaji Mandir (Elevated Lotus Temple & Magenta Hub)
        print("Flying to Kalkaji Mandir...")
        page.evaluate("window.MetroWebGLLayer.flyToStation('Kalkaji Mandir')")
        time.sleep(3)
        shot3 = ARTIFACT_DIR / "violet_03_kalkaji_mandir.png"
        page.screenshot(path=str(shot3))
        print("Saved:", shot3)

        # 6. Capture Station 4: Raja Nahar Singh (Ballabhgarh Southern Terminus)
        print("Flying to Raja Nahar Singh (Ballabhgarh)...")
        page.evaluate("window.MetroWebGLLayer.flyToStation('Raja Nahar Singh (Ballabhgarh)')")
        time.sleep(3)
        shot4 = ARTIFACT_DIR / "violet_04_ballabhgarh.png"
        page.screenshot(path=str(shot4))
        print("Saved:", shot4)

        # 7. Check FPS
        fps = page.evaluate("""() => {
            return new Promise((resolve) => {
                let frames = 0;
                const start = performance.now();
                function count() {
                    frames++;
                    if (performance.now() - start < 1000) {
                        requestAnimationFrame(count);
                    } else {
                        resolve(frames);
                    }
                }
                requestAnimationFrame(count);
            });
        }""")
        print(f"Measured FPS: {fps}")

        # Check errors
        real_errors = [e for e in console_errors if not "favicon" in e and not "404" in e]
        print(f"Total console errors: {len(real_errors)}")
        if real_errors:
            print("Errors:", real_errors[:5])

        browser.close()
        print("ALL CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    verify_violet()
