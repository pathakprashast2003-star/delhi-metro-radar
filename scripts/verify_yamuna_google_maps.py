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

        page.click("#btn-line-blue")
        time.sleep(1.5)

        shots = [
            ("gm_01_river_ramp_west.png", [77.2615, 28.6223], 16.4, 52, -30),
            ("gm_02_depot_aerial.png", [77.2646, 28.6234], 15.85, 20, 0),
            ("gm_03_station_hall_oblique.png", [77.2679, 28.6232], 17.1, 55, 22),
            ("gm_04_east_braid_underpass.png", [77.2717, 28.6248], 17.6, 56, -32),
            ("gm_05_east_junction_overview.png", [77.2726, 28.6242], 15.9, 28, 0),
            ("gm_06_throat_crossovers_closeup.png", [77.2698, 28.6238], 18.2, 58, 55),
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
            time.sleep(2.6)
            out_path = os.path.join(ARTIFACT_DIR, fname)
            page.screenshot(path=out_path)
            print(f"Captured {out_path}")

        browser.close()

    print(f"Console errors ({len(console_errors)}):", console_errors[:10])
    print(f"Page errors ({len(page_errors)}):", page_errors[:10])
    if page_errors or any("SyntaxError" in e or "TypeError" in e or "ReferenceError" in e or "WebGL" in e for e in console_errors):
        raise SystemExit(1)


if __name__ == "__main__":
    run_verify()

