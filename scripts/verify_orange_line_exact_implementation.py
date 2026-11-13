#!/usr/bin/env python3
import sys
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = "/Users/prashastpathak/.gemini/antigravity/brain/8d990326-b6bb-447d-92c3-22070a55d6c4"

SHOTS = [
    {
        "name": "orange_01_new_delhi_multimodal.png",
        "coords": [77.223095, 28.64249],
        "zoom": 17.2,
        "pitch": 54,
        "bearing": -40
    },
    {
        "name": "orange_02_shivaji_stadium_rotunda.png",
        "coords": [77.211311, 28.628914],
        "zoom": 17.4,
        "pitch": 52,
        "bearing": 35
    },
    {
        "name": "orange_03_dhaula_kuan_skywalk_ringroad.png",
        "coords": [77.161684, 28.591914],
        "zoom": 16.8,
        "pitch": 55,
        "bearing": -60
    },
    {
        "name": "orange_04_delhi_aerocity_worldmark.png",
        "coords": [77.120809, 28.5488],
        "zoom": 17.2,
        "pitch": 50,
        "bearing": 20
    },
    {
        "name": "orange_05_igi_airport_t3_hub.png",
        "coords": [77.086724, 28.55649],
        "zoom": 16.8,
        "pitch": 55,
        "bearing": 65
    },
    {
        "name": "orange_06_dwarka_sector_21_4track.png",
        "coords": [77.05856, 28.551922],
        "zoom": 17.0,
        "pitch": 52,
        "bearing": -45
    },
    {
        "name": "orange_07_yashobhoomi_iicc_expo.png",
        "coords": [77.045329, 28.550852],
        "zoom": 16.8,
        "pitch": 52,
        "bearing": 50
    }
]

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
        context = browser.new_context(viewport={"width": 1600, "height": 1000})
        page = context.new_page()

        page.on("console", lambda msg: (errors.append(f"CONSOLE ERROR: {msg.text}") if msg.type == "error" else logs.append(msg.text)))
        page.on("pageerror", lambda err: errors.append(f"PAGE ERROR: {err}"))

        print("Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=30000)
        page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady === true", timeout=20000)
        time.sleep(2)

        # Select Orange Line
        print("Selecting Orange Line...")
        page.click("#btn-line-orange")
        time.sleep(2)

        for s in SHOTS:
            print(f"Flying to {s['name']}...")
            page.evaluate(f"""([lng, lat, zoom, pitch, bearing]) => {{
                if (window.map) {{
                    window.map.flyTo({{
                        center: [lng, lat],
                        zoom: zoom,
                        pitch: pitch,
                        bearing: bearing,
                        duration: 1200
                    }});
                }}
            }}""", [s["coords"][0], s["coords"][1], s["zoom"], s["pitch"], s["bearing"]])
            
            time.sleep(3)
            outpath = f"{ARTIFACT_DIR}/{s['name']}"
            page.screenshot(path=outpath)
            print(f"Captured: {outpath}")

        browser.close()

    print("\nVerification Results:")
    print(f"Console errors: {len(errors)}")
    if errors:
        for e in errors:
            print(f"  {e}")
        sys.exit(1)
    print("SUCCESS: 0 console errors, all 7 station views captured!")

if __name__ == "__main__":
    main()
