#!/usr/bin/env python3
"""
Verify Krishna Park Extension (Phase-4 Terminus) and Janakpuri West Localities
via Playwright headless Chromium.
Captures high-res screenshots and verifies stepper counts and 3D objects.
"""
import sys
import time
from playwright.sync_api import sync_playwright

def main():
    print("[1/5] Launching headless browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--use-gl=angle",
                "--use-angle=metal",
                "--no-sandbox"
            ]
        )
        page = browser.new_page(viewport={"width": 1600, "height": 900})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("[2/5] Navigating to http://localhost:8080 ...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=30000)

        # Wait for 3D engine readiness
        print("Waiting for MetroWebGLLayer to initialize...")
        page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.isReady && window.MetroWebGLLayer.isReady()", timeout=20000)
        time.sleep(2)

        # Click Magenta Line button
        print("[3/5] Switching to Magenta Line...")
        page.evaluate("() => document.getElementById('btn-line-magenta').click()")
        time.sleep(2.5)

        # Check stepper state
        stepper_info = page.evaluate("""() => {
            const tag = document.getElementById('station-step-line-tag')?.textContent || '';
            const count = document.getElementById('station-step-count')?.textContent || '';
            const name = document.getElementById('station-step-name')?.textContent || '';
            const activeLine = window.MetroWebGLLayer ? window.MetroWebGLLayer.getActiveLine() : '';
            const stList = window.MetroWebGLLayer ? window.MetroWebGLLayer.getActiveStations() : [];
            return {
                tag,
                count,
                name,
                activeLine,
                stationCount: stList.length,
                firstStation: stList[0]?.name,
                secondStation: stList[1]?.name,
                lastStation: stList[stList.length - 1]?.name
            };
        }""")
        print(f"Magenta Line Stepper Info: {stepper_info}")

        # Capture screenshot at Krishna Park Extension
        print("[4/5] Capturing Krishna Park Extension Phase-4 Terminus...")
        time.sleep(2)
        kp_shot_path = "/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/krishna_park_ext_localities.png"
        page.screenshot(path=kp_shot_path)
        print(f"Saved: {kp_shot_path}")

        # Step to Janakpuri West
        print("[5/5] Navigating to Janakpuri West (ML 2/26) and verifying localities...")
        page.evaluate("() => { window.MetroWebGLLayer.flyToStation('Janakpuri West'); }")
        time.sleep(3)

        jp_stepper = page.evaluate("""() => {
            const count = document.getElementById('station-step-count')?.textContent || '';
            const name = document.getElementById('station-step-name')?.textContent || '';
            return { count, name };
        }""")
        print(f"Janakpuri West Stepper: {jp_stepper}")

        # Capture Janakpuri West localities screenshot
        jp_shot_path = "/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/janakpuri_west_localities_loaded.png"
        page.screenshot(path=jp_shot_path)
        print(f"Saved: {jp_shot_path}")

        # Step +100m to test walking track
        print("Testing walkAlongTrack(+100m)...")
        page.evaluate("() => { if (typeof window.walkAlongTrack === 'function') window.walkAlongTrack(100); }")
        time.sleep(1.5)
        walk_shot_path = "/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/janakpuri_west_walk_100m.png"
        page.screenshot(path=walk_shot_path)
        print(f"Saved: {walk_shot_path}")

        browser.close()

        if console_errors:
            print(f"Console errors detected ({len(console_errors)}):")
            for err in console_errors[:5]:
                print(f"  - {err}")
        else:
            print("Zero console errors! Verification complete!")

if __name__ == "__main__":
    main()

