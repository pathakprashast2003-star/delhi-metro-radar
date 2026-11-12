import time
import os
from playwright.sync_api import sync_playwright

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ARTIFACT_DIR = "/Users/prashastpathak/.gemini/antigravity/brain/8d990326-b6bb-447d-92c3-22070a55d6c4"

def verify():
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
        print("Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=45000)
        
        print("Waiting for MetroWebGLLayer.isReady...")
        page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady", timeout=30000)
        time.sleep(2)

        # 1. Switch to Blue Line
        print("Selecting Blue Line...")
        page.click("#btn-line-blue")
        time.sleep(1.5)

        # 2. Go to Yamuna Bank via flyToStation
        print("Flying to Yamuna Bank...")
        page.evaluate("() => window.MetroWebGLLayer.flyToStation('Yamuna Bank')")
        time.sleep(3)

        # Angle 1: Station Overview from Southwest (Platforms, Concourse FOB, Tracks)
        page.evaluate("""() => {
            if (window.map) {
                window.map.setPitch(58);
                window.map.setBearing(-25);
                window.map.setZoom(16.5);
            }
        }""")
        time.sleep(2)
        shot1 = os.path.join(ARTIFACT_DIR, "yamuna_bank_station_overview_v2.png")
        page.screenshot(path=shot1)
        print(f"Saved {shot1}")

        # Angle 2: Station Throat & Flying Crossover looking Northeast
        page.evaluate("""() => {
            if (window.map) {
                window.map.setPitch(62);
                window.map.setBearing(45);
                window.map.setZoom(16.2);
            }
        }""")
        time.sleep(2)
        shot2 = os.path.join(ARTIFACT_DIR, "yamuna_bank_throat_flyover_v2.png")
        page.screenshot(path=shot2)
        print(f"Saved {shot2}")

        # Angle 3: Depot Yard on Western River Flank
        page.evaluate("""() => {
            if (window.map) {
                window.map.setPitch(52);
                window.map.setBearing(-85);
                window.map.setZoom(16.0);
            }
        }""")
        time.sleep(2)
        shot3 = os.path.join(ARTIFACT_DIR, "yamuna_bank_west_depot_v2.png")
        page.screenshot(path=shot3)
        print(f"Saved {shot3}")

        # 3. Go to Akshardham Station
        print("Flying to Akshardham...")
        page.evaluate("() => window.MetroWebGLLayer.flyToStation('Akshardham')")
        time.sleep(3)

        page.evaluate("""() => {
            if (window.map) {
                window.map.setPitch(56);
                window.map.setBearing(-60);
                window.map.setZoom(16.0);
            }
        }""")
        time.sleep(2)
        shot4 = os.path.join(ARTIFACT_DIR, "akshardham_mandir_landmark_v2.png")
        page.screenshot(path=shot4)
        print(f"Saved {shot4}")

        # Akshardham Mandir closer shot
        page.evaluate("""() => {
            if (window.map) {
                window.map.flyTo({
                    center: [77.2773, 28.6127],
                    zoom: 16.8,
                    pitch: 62,
                    bearing: -45,
                    duration: 1000
                });
            }
        }""")
        time.sleep(2.5)
        shot5 = os.path.join(ARTIFACT_DIR, "akshardham_temple_closeup_v2.png")
        page.screenshot(path=shot5)
        print(f"Saved {shot5}")

        browser.close()
        print("All verification captures completed successfully!")

if __name__ == "__main__":
    verify()
