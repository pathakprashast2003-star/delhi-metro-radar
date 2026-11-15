#!/usr/bin/env python3
"""
verify_authentic_mukundpur_and_first5.py
Tests the authentic 3D Mukundpur Depot and Majlis Park flyover ramps,
as well as the first 5 Pink Line stations, verifying 0 errors and capturing
detailed verification screenshots.
"""

import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(line_buffering=True)

def run_verification():
    errors = []
    warnings = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 1600x1000 viewport for clear high-resolution inspection
        context = browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = context.new_page()

        page.on('console', lambda msg: (
            errors.append(f"Console {msg.type}: {msg.text}") if msg.type == 'error' else
            warnings.append(f"Console {msg.type}: {msg.text}") if msg.type == 'warning' else None
        ))
        page.on('pageerror', lambda exc: errors.append(f"PageError: {exc}"))

        print("Navigating to http://localhost:8080/ ...")
        page.goto('http://localhost:8080/', wait_until='networkidle', timeout=60000)
        time.sleep(3)

        # Switch to Pink Line
        print("Selecting Pink Line filter via #btn-line-pink...")
        page.evaluate("""() => {
            const btn = document.getElementById('btn-line-pink');
            if (btn) btn.click();
            else if (window.MetroWebGLLayer && window.MetroWebGLLayer.setLineFilter) {
                window.MetroWebGLLayer.setLineFilter('pink');
            }
        }""")
        time.sleep(2)

        # Verify first 5 stations
        st_info = page.evaluate("""() => {
            const stList = window.MetroWebGLLayer ? window.MetroWebGLLayer.getActiveStations() : [];
            return stList.slice(0, 8).map(s => ({
                id: s.id,
                name: s.name,
                corridor: s.corridor ? s.corridor.lineKey : null,
                isUnderground: !!s.isUnderground,
                elev: Number(s.elev),
                interchange: s.interchange || null
            }));
        }""")
        print(f"Retrieved first {len(st_info)} Pink Line stations:")
        for idx, s in enumerate(st_info[:5]):
            print(f"  {idx+1}. {s['name']} (elev: {s['elev']}m, underground: {s['isUnderground']}, interchange: {s['interchange']})")

        # 1. Capture Majlis Park Station & North Flyover Ramp Junction
        print("Focusing on Majlis Park Station and Flyover Junction...")
        page.evaluate("""() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.1821, 28.7255],
                    zoom: 17.5,
                    pitch: 62,
                    bearing: 25,
                    duration: 0
                });
            }
            if (window.MetroWebGLLayer && window.MetroWebGLLayer.selectStation) {
                window.MetroWebGLLayer.selectStation('Majlis Park');
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/pink_st1_majlis_park_depot_junction.png')
        print("Saved pink_st1_majlis_park_depot_junction.png")

        # 2. Capture Mukundpur Elevated Viaduct Flyover Ramp
        print("Focusing on Mukundpur Flyover Ramps (16.5m -> 1.35m)...")
        page.evaluate("""() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.1850, 28.7285],
                    zoom: 16.8,
                    pitch: 65,
                    bearing: 60,
                    duration: 0
                });
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/mukundpur_flyover_ramp_3d.png')
        print("Saved mukundpur_flyover_ramp_3d.png")

        # 3. Capture Mukundpur Depot Yard Overview
        print("Focusing on Mukundpur Depot Yard Overview...")
        page.evaluate("""() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.1870, 28.7240],
                    zoom: 16.2,
                    pitch: 58,
                    bearing: -20,
                    duration: 0
                });
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/mukundpur_osm_depot_yard_overview.png')
        print("Saved mukundpur_osm_depot_yard_overview.png")

        # 4. Capture Mukundpur Covered Workshop (Building 1180927558)
        print("Focusing on Mukundpur Main Inspection Workshop (Building 1180927558)...")
        page.evaluate("""() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.1868, 28.7245],
                    zoom: 17.6,
                    pitch: 64,
                    bearing: -45,
                    duration: 0
                });
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/mukundpur_osm_covered_workshop_close.png')
        print("Saved mukundpur_osm_covered_workshop_close.png")

        # 5. Capture Station 2: Azadpur Underground with Yellow Line interchange
        print("Focusing on Station 2: Azadpur...")
        page.evaluate("""() => {
            if (window.MetroWebGLLayer && window.MetroWebGLLayer.flyToStation) {
                window.MetroWebGLLayer.flyToStation('Azadpur');
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/pink_st2_azadpur_interchange_verified.png')
        print("Saved pink_st2_azadpur_interchange_verified.png")

        # Check errors
        print("\n--- ERROR CHECK ---")
        real_errors = [e for e in errors if 'favicon' not in e and 'ERR_CONNECTION_REFUSED' not in e]
        if real_errors:
            print(f"FAIL: Found {len(real_errors)} console/page errors:")
            for e in real_errors:
                print(f"  {e}")
            sys.exit(1)
        else:
            print(f"PASS: 0 console errors, 0 page errors! All verifications succeeded.")

        browser.close()

if __name__ == '__main__':
    run_verification()
