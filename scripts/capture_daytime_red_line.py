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

        print("Navigating to http://localhost:8080 ...")
        await page.goto("http://localhost:8080")
        print("Waiting for MetroWebGLLayer to be 100% ready...")
        await page.wait_for_function("""() => {
            return typeof window.MetroWebGLLayer !== 'undefined' && 
                   typeof window.MetroWebGLLayer.getDebugInfo === 'function' &&
                   window.MetroWebGLLayer.getDebugInfo().isReady;
        }""", timeout=25000)
        print("Scene is ready!")

        # Set time to 14:00 (midday daylight)
        print("Setting time to midday 14:00 IST...")
        await page.evaluate("""() => {
            window.MetroWebGLLayer.setTimeOfDay(14 * 3600, true);
            const btn = document.getElementById('btn-line-red');
            if (btn) btn.click();
        }""")
        await asyncio.sleep(4)

        # 1. SHASTRI PARK DEPOT & AT-GRADE STATION (Daylight close up)
        print("Capturing Shastri Park Depot closeup in daylight...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2485, 28.6695],
                zoom: 17.4,
                pitch: 58,
                bearing: 60
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_shastri_park_depot_closeup.png"))

        # 2. YAMUNA RIVER HISTORIC VIADUCT (Looking from Kashmere Gate ramp across river)
        print("Capturing Yamuna River Bridge crossing...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2380, 28.6680],
                zoom: 16.8,
                pitch: 62,
                bearing: 75
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_yamuna_river_bridge.png"))

        # 3. KASHMERE GATE TRI-CORRIDOR HUB (Daylight)
        print("Capturing Kashmere Gate Tri-Corridor Hub...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2285, 28.6675],
                zoom: 17.5,
                pitch: 60,
                bearing: -25
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_kashmere_gate_hub.png"))

        # 4. INDERLOK INTERCHANGE BI-LEVEL (Daylight)
        print("Capturing Inderlok Bi-Level Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1706, 28.6738],
                zoom: 17.6,
                pitch: 58,
                bearing: -35
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_inderlok_interchange.png"))

        # 5. WELCOME INTERCHANGE (Daylight)
        print("Capturing Welcome Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2778, 28.6720],
                zoom: 17.4,
                pitch: 55,
                bearing: 45
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_welcome_interchange.png"))

        # 6. RITHALA TERMINUS (Daylight)
        print("Capturing Rithala Terminus...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1072, 28.7208],
                zoom: 17.4,
                pitch: 56,
                bearing: -60
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_rithala_terminus.png"))

        # 7. BOTANICAL GARDEN CONNECTED INTERCHANGE (Verify user's previous issue)
        print("Capturing Botanical Garden 4-track connected interchange...")
        await page.evaluate("""() => {
            const btnM = document.getElementById('btn-line-magenta');
            if (btnM) btnM.click();
            window.map.jumpTo({
                center: [77.3340, 28.5642],
                zoom: 17.6,
                pitch: 58,
                bearing: -130
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_botanical_garden_interchange.png"))

        # 8. JASOLA VIHAR / KALINDI KUNJ DEPOT BRIDGE RAMP (Verify user's previous issue)
        print("Capturing Jasola Vihar bridge ramp to Kalindi Kunj depot...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.3005, 28.5418],
                zoom: 17.0,
                pitch: 60,
                bearing: 55
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_jasola_bridge_ramp.png"))

        print("All daytime screenshots captured successfully!")
        await browser.close()

asyncio.run(main())
