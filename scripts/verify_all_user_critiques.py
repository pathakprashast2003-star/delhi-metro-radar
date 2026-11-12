import time
import os
from playwright.sync_api import sync_playwright

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ARTIFACT_DIR = "/Users/prashastpathak/.gemini/antigravity/brain/8d990326-b6bb-447d-92c3-22070a55d6c4"

def verify_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=metal",
                "--enable-webgl",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        print("1. Loading http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=45000)
        page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady", timeout=30000)
        time.sleep(2)

        # Switch to Blue Line
        print("2. Selecting Blue Line...")
        page.click("#btn-line-blue")
        time.sleep(1.5)

        # Fly to Yamuna Bank
        print("3. Flying to Yamuna Bank...")
        page.evaluate("() => window.MetroWebGLLayer.flyToStation('Yamuna Bank')")
        time.sleep(3)

        # TEST 1: River Bridge at -600m (Ghost track proof)
        print("4. Stepping to -600m (River bridge)...")
        for _ in range(6):
            page.evaluate("() => window.MetroWebGLLayer.stepAlongTrack(-100)")
            time.sleep(0.2)
        time.sleep(2.5)
        shot1 = os.path.join(ARTIFACT_DIR, "verified_minus_600m_no_ghost_track.png")
        page.screenshot(path=shot1)
        print(f"Saved: {shot1}")

        # TEST 2: Depot Yard & Connected Ladder Fan at -300m / -200m
        print("5. Stepping to -300m (Depot Yard & Ladder Fan)...")
        for _ in range(3):
            page.evaluate("() => window.MetroWebGLLayer.stepAlongTrack(100)")
            time.sleep(0.2)
        time.sleep(2.5)
        shot2 = os.path.join(ARTIFACT_DIR, "verified_minus_300m_depot_ladder_fan.png")
        page.screenshot(path=shot2)
        print(f"Saved: {shot2}")

        print("6. Stepping to -200m (Depot Throat Connection into Track 1)...")
        page.evaluate("() => window.MetroWebGLLayer.stepAlongTrack(100)")
        time.sleep(2.5)
        shot3 = os.path.join(ARTIFACT_DIR, "verified_minus_200m_connected_lead.png")
        page.screenshot(path=shot3)
        print(f"Saved: {shot3}")

        # Top-down / high angle view of the entire depot interlocking fan
        page.evaluate("""() => {
            if (window.map) {
                window.map.setPitch(54);
                window.map.setBearing(-75);
                window.map.setZoom(16.6);
            }
        }""")
        time.sleep(2.5)
        shot3b = os.path.join(ARTIFACT_DIR, "verified_depot_interlocking_aerial.png")
        page.screenshot(path=shot3b)
        print(f"Saved: {shot3b}")

        # TEST 3: Station Overview with 4 Continuous Railroads & Crossovers (0m)
        print("7. Stepping to 0m (Yamuna Bank Station Center)...")
        page.evaluate("() => window.MetroWebGLLayer.flyToStation('Yamuna Bank')")
        time.sleep(3)
        page.evaluate("""() => {
            if (window.map) {
                window.map.setPitch(58);
                window.map.setBearing(-28);
                window.map.setZoom(16.5);
            }
        }""")
        time.sleep(2.5)
        shot4 = os.path.join(ARTIFACT_DIR, "verified_yamuna_bank_4_continuous_tracks.png")
        page.screenshot(path=shot4)
        print(f"Saved: {shot4}")

        # TEST 4: Flyover Timing & Crossing (+300m and +500m)
        print("8. Stepping to +300m (Parallel East Corridor)...")
        for _ in range(3):
            page.evaluate("() => window.MetroWebGLLayer.stepAlongTrack(100)")
            time.sleep(0.2)
        time.sleep(2.5)
        shot5 = os.path.join(ARTIFACT_DIR, "verified_plus_300m_parallel_corridor.png")
        page.screenshot(path=shot5)
        print(f"Saved: {shot5}")

        print("9. Stepping to +500m (Ascent & Flying Overpass)...")
        for _ in range(2):
            page.evaluate("() => window.MetroWebGLLayer.stepAlongTrack(100)")
            time.sleep(0.2)
        time.sleep(2.5)
        page.evaluate("""() => {
            if (window.map) {
                window.map.setPitch(56);
                window.map.setBearing(-50);
                window.map.setZoom(16.2);
            }
        }""")
        time.sleep(2.5)
        shot6 = os.path.join(ARTIFACT_DIR, "verified_plus_500m_flying_crossing.png")
        page.screenshot(path=shot6)
        print(f"Saved: {shot6}")

        browser.close()
        print("ALL VERIFICATION SHOTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    verify_all()

