import time
from playwright.sync_api import sync_playwright

def main():
    print("Launching Playwright Chromium...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Listen to console logs
        page.on("console", lambda msg: print(f"[Browser Console {msg.type}] {msg.text}"))

        print("Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=30000)

        # Wait for MapLibre & Metro WebGL layer to initialize
        time.sleep(3)

        print("Focusing Magenta Line...")
        # Click the Magenta Line filter button
        btn_magenta = page.locator("#btn-line-magenta")
        if btn_magenta.is_visible():
            btn_magenta.click()
            time.sleep(1)

        print("Flying to Jasola Vihar Shaheen Bagh...")
        # Use MetroWebGLLayer to fly directly to Jasola Vihar Shaheen Bagh
        page.evaluate("""() => {
            if (window.MetroWebGLLayer && window.MetroWebGLLayer.flyToStation) {
                window.MetroWebGLLayer.flyToStation('Jasola Vihar Shaheen Bagh');
            }
        }""")

        time.sleep(4)

        # Let's adjust camera pitch and bearing for a dramatic cinematic view of the elevated depot
        page.evaluate("""() => {
            const map = window._dmrcMap || window.map;
            if (map) {
                map.setPitch(62);
                map.setBearing(-45);
                map.setZoom(16.5);
            }
        }""")

        time.sleep(3)

        # Take screenshot
        out_shot = "/Users/prashastpathak/Desktop/delhi-metro-radar/verification_jasola_vihar_depot_live.png"
        page.screenshot(path=out_shot)
        print(f"Screenshot captured: {out_shot}")

        # Also copy to brain artifact dir
        brain_shot = "/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verification_jasola_vihar_depot_live.png"
        import shutil
        shutil.copyfile(out_shot, brain_shot)
        print(f"Copied to brain: {brain_shot}")

        browser.close()

if __name__ == '__main__':
    main()

