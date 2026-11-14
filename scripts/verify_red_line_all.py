import asyncio
import os
from playwright.async_api import async_playwright

ARTIFACT_DIR = "/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=metal",
                "--enable-webgl",
                "--ignore-gpu-blocklist"
            ]
        )
        context = await browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=2
        )
        page = await context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[ERROR] {err}"))

        print("Navigating to http://localhost:8080 ...")
        await page.goto("http://localhost:8080", wait_until="domcontentloaded")
        print("Waiting for #btn-line-red...")
        await page.wait_for_selector("#btn-line-red", timeout=15000)
        await asyncio.sleep(4)
        print("Page and controls loaded successfully!")

        # Check console errors
        errors = [l for l in console_logs if "[error]" in l.lower()]
        print(f"Console errors ({len(errors)}):")
        for e in errors:
            print("  ", e)

        # Click Red Line perspective button
        print("Activating Red Line filter...")
        await page.evaluate("""() => {
            const btn = document.getElementById('btn-line-red');
            if (btn) btn.click();
            else if (window.setLineFilter) window.setLineFilter('red');
        }""")
        await asyncio.sleep(3)

        # 1. RITHALA TERMINUS (Western Terminus - Scissor Crossover & Elevated Overrun)
        print("Viewing Rithala Terminus...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1072, 28.7208],
                zoom: 17.2,
                pitch: 58,
                bearing: -65
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_rithala_terminus.png"))
        print("Captured: verified_red_line_rithala_terminus.png")

        # 2. NETAJI SUBHASH PLACE (NSP) INTERCHANGE (Red Line x Pink Line Hub)
        print("Viewing Netaji Subhash Place Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1528, 28.6961],
                zoom: 17.0,
                pitch: 55,
                bearing: 30
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_nsp_interchange.png"))
        print("Captured: verified_red_line_nsp_interchange.png")

        # 3. INDERLOK INTERCHANGE (Red Line Upper Tier + Green Line Lower Tier Bi-level Hub)
        print("Viewing Inderlok Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1706, 28.6738],
                zoom: 17.4,
                pitch: 60,
                bearing: -45
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_inderlok_interchange.png"))
        print("Captured: verified_red_line_inderlok_interchange.png")

        # 4. KASHMERE GATE TRI-CORRIDOR MEGA-HUB (Red Line Elevated over Yellow & Violet Subterranean)
        print("Viewing Kashmere Gate Tri-Corridor Mega-Hub...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2285, 28.6675],
                zoom: 17.2,
                pitch: 62,
                bearing: -20
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_kashmere_gate_hub.png"))
        print("Captured: verified_red_line_kashmere_gate_hub.png")

        # 5. YAMUNA RIVER HISTORIC METRO BRIDGE (Viaduct crossing between Kashmere Gate and Shastri Park)
        print("Viewing Historic Yamuna River Metro Bridge...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2450, 28.6690],
                zoom: 16.5,
                pitch: 64,
                bearing: 70
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_yamuna_bridge.png"))
        print("Captured: verified_red_line_yamuna_bridge.png")

        # 6. SHASTRI PARK AT-GRADE STATION & YARD DEPOT (At-grade basin, stabling sidings, workshops)
        print("Viewing Shastri Park At-Grade Station & Depot...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2610, 28.6705],
                zoom: 16.8,
                pitch: 58,
                bearing: -80
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_shastri_park_depot.png"))
        print("Captured: verified_red_line_shastri_park_depot.png")

        # 7. WELCOME INTERCHANGE (Red Line Elevated crossing Pink Line Elevated)
        print("Viewing Welcome Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2778, 28.6720],
                zoom: 17.2,
                pitch: 56,
                bearing: 40
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_welcome_interchange.png"))
        print("Captured: verified_red_line_welcome_interchange.png")

        # 8. SHAHEED STHAL (NEW BUS ADDA) GHAZIABAD TERMINUS (Overrun Viaduct & Elevated Concourse)
        print("Viewing Shaheed Sthal Ghaziabad Terminus...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.4140, 28.6710],
                zoom: 17.0,
                pitch: 58,
                bearing: -75
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_red_line_shaheed_sthal_terminus.png"))
        print("Captured: verified_red_line_shaheed_sthal_terminus.png")

        # Summary telemetry
        telemetry = await page.evaluate("""() => {
            const w = window;
            return {
                redCorridorFound: !!w.redCorridor,
                redCorridorVisible: w.redCorridor ? w.redCorridor.visible : false,
                redTrainsActive: w.metroLayer && w.metroLayer.getRedTrains ? w.metroLayer.getRedTrains().length : 'N/A',
                allLinesActive: document.getElementById('tab-stepper-red') ? document.getElementById('tab-stepper-red').textContent : 'N/A'
            };
        }""")
        print("Red Line WebGL Telemetry:", telemetry)

        await browser.close()
        print("All Red Line screenshots captured successfully!")

asyncio.run(main())
