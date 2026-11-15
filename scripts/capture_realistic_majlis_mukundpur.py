#!/usr/bin/env python3
"""
capture_realistic_majlis_mukundpur.py
Captures the updated realistic Majlis Park and Mukundpur Depot views
matching the user's screenshot angle and verifying 0 errors.
"""

import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(line_buffering=True)

def run():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = context.new_page()

        page.on('console', lambda msg: errors.append(f"Console {msg.type}: {msg.text}") if msg.type == 'error' else None)
        page.on('pageerror', lambda exc: errors.append(f"PageError: {exc}"))

        print("Navigating to http://localhost:8080/ ...")
        page.goto('http://localhost:8080/', wait_until='networkidle', timeout=60000)
        time.sleep(3)

        print("Activating Pink Line filter...")
        page.evaluate("""() => {
            const btn = document.getElementById('btn-line-pink');
            if (btn) btn.click();
        }""")
        time.sleep(2)

        # 1. Exact viewpoint matching the user's uploaded screenshot
        print("Setting camera to match user's viewpoint over Majlis Park toward Mukundpur...")
        page.evaluate("""() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.1832, 28.7258],
                    zoom: 16.6,
                    pitch: 64,
                    bearing: 20,
                    duration: 0
                });
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/realistic_majlis_park_depot_viewpoint.png')
        print("Saved realistic_majlis_park_depot_viewpoint.png")

        # 2. Closer perspective on the realistic flyover ramps & hammerhead piers
        print("Capturing close-up of realistic flyover ramps & hammerhead piers...")
        page.evaluate("""() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.1845, 28.7275],
                    zoom: 17.4,
                    pitch: 62,
                    bearing: 42,
                    duration: 0
                });
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/realistic_flyover_ramps_closeup.png')
        print("Saved realistic_flyover_ramps_closeup.png")

        # 3. Wide perspective of Mukundpur Depot ground ballast slab and workshops
        print("Capturing Mukundpur Depot ground ballast slab and workshops...")
        page.evaluate("""() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.1870, 28.7245],
                    zoom: 16.4,
                    pitch: 58,
                    bearing: -25,
                    duration: 0
                });
            }
        }""")
        time.sleep(3)
        page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/realistic_mukundpur_depot_ballast_ground.png')
        print("Saved realistic_mukundpur_depot_ballast_ground.png")

        real_errors = [e for e in errors if 'favicon' not in e]
        if real_errors:
            print(f"Errors detected: {real_errors}")
            sys.exit(1)
        else:
            print("PASS: 0 console errors, 0 page errors!")

        browser.close()

if __name__ == '__main__':
    run()
