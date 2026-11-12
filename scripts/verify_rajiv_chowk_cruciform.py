import os
import time
from playwright.sync_api import sync_playwright

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ARTIFACT_DIR = "/Users/prashastpathak/.gemini/antigravity/brain/8d990326-b6bb-447d-92c3-22070a55d6c4"


def run_verify():
    console_errors = []
    page_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=metal",
                "--enable-webgl",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type in ("error", "warning") and "webgl" in msg.text.lower() or msg.type == "error"
            else None,
        )
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        page.goto("http://localhost:8080", wait_until="networkidle", timeout=45000)
        page.wait_for_function(
            "() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady",
            timeout=30000,
        )
        time.sleep(2.0)

        page.click("#btn-line-all")
        time.sleep(1.5)

        shots = [
            ("rc_01_hero_isometric.png", [77.219424, 28.632742], 18.0, 56, 35),
            ("rc_02_opposite_portals.png", [77.219424, 28.632742], 18.1, 58, 215),
            ("rc_03_under_bridge_clearance.png", [77.21948, 28.63278], 18.7, 68, -55),
            ("rc_04_cp_aerial_overview.png", [77.21945, 28.63276], 16.6, 32, 0),
        ]

        for fname, center, zoom, pitch, bearing in shots:
            page.evaluate(
                """([c, z, p, b]) => {
                    if (window.map) {
                        window.map.jumpTo({ center: c, zoom: z, pitch: p, bearing: b });
                    }
                }""",
                [center, zoom, pitch, bearing],
            )
            time.sleep(2.5)
            out_path = os.path.join(ARTIFACT_DIR, fname)
            page.screenshot(path=out_path)
            print(f"Captured {out_path}")

        # Verify Rajiv Chowk unified hub remains visible on Blue Line toggle & capture Blue ramp check
        page.click("#btn-line-blue")
        time.sleep(1.8)
        page.evaluate(
            """() => {
                if (window.map) {
                    window.map.jumpTo({ center: [77.219424, 28.632742], zoom: 17.5, pitch: 54, bearing: 35 });
                }
            }"""
        )
        time.sleep(2.0)
        blue_shot = os.path.join(ARTIFACT_DIR, "rc_05_blue_mode_ramp.png")
        page.screenshot(path=blue_shot)
        print(f"Captured {blue_shot}")

        browser.close()

    print(f"Console errors ({len(console_errors)}):", console_errors[:10])
    print(f"Page errors ({len(page_errors)}):", page_errors[:10])
    if page_errors or any("SyntaxError" in e or "TypeError" in e or "ReferenceError" in e or "WebGL" in e for e in console_errors):
        raise SystemExit(1)


if __name__ == "__main__":
    run_verify()

