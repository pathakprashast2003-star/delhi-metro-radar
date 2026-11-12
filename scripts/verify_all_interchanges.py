#!/usr/bin/env python3
import os
import sys
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
            if (msg.type in ("error", "warning") and "webgl" in msg.text.lower()) or msg.type == "error"
            else None,
        )
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        page.goto("http://localhost:8080", wait_until="networkidle", timeout=45000)
        page.wait_for_function(
            "() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady",
            timeout=35000,
        )
        time.sleep(2.0)

        page.click("#btn-line-all")
        time.sleep(1.5)

        shots = [
            ("hub_01_kashmere_gate.png", [77.22845, 28.66785], 17.3, 58, 28),
            ("hub_02_central_secretariat.png", [77.21232, 28.61588], 17.7, 56, 35),
            ("hub_03_mandi_house.png", [77.23445, 28.62555], 17.7, 56, 25),
            ("hub_04_hauz_khas.png", [77.20590, 28.54381], 17.0, 56, -40),
            ("hub_05_new_delhi.png", [77.22290, 28.64295], 17.2, 54, 42),
            ("hub_06_janakpuri_west.png", [77.07795, 28.62925], 17.4, 56, -32),
            ("hub_07_rajouri_garden.png", [77.12352, 28.65015], 16.8, 56, 35),
            ("hub_08_haiderpur_badli_mor.png", [77.14887, 28.72992], 17.7, 58, -42),
            ("hub_09_botanical_garden.png", [77.33410, 28.56393], 17.4, 54, 40),
            ("hub_10_kirti_nagar.png", [77.15100, 28.65514], 17.0, 56, 25),
            ("hub_11_mayur_vihar_1.png", [77.29015, 28.60402], 17.0, 56, 45),
            ("hub_12_noida_sec52.png", [77.37405, 28.58625], 16.8, 54, 20),
            ("hub_13_karkarduma.png", [77.30576, 28.64887], 17.2, 56, 32),
            ("hub_14_anand_vihar_isbt.png", [77.31555, 28.64682], 17.4, 56, 20),
            ("hub_15_azadpur.png", [77.18116, 28.70642], 17.0, 56, -28),
            ("hub_16_dwarka_sec21.png", [77.05860, 28.55190], 17.3, 56, 32),
            ("hub_17_dilli_haat_ina.png", [77.20846, 28.57390], 17.0, 56, -30),
            ("hub_18_dwarka_grey.png", [77.02257, 28.61538], 17.3, 56, 30),
            ("hub_19_sikanderpur.png", [77.09372, 28.48112], 17.1, 56, 25),
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
            time.sleep(2.2)
            out_path = os.path.join(ARTIFACT_DIR, fname)
            page.screenshot(path=out_path)
            print(f"Captured {fname}")

        browser.close()

    print(f"Console errors ({len(console_errors)}):", console_errors)
    print(f"Page errors ({len(page_errors)}):", page_errors)
    if console_errors or page_errors:
        sys.exit(1)


if __name__ == "__main__":
    run_verify()

