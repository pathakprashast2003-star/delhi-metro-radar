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
        context = await browser.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=2)
        page = await context.new_page()

        print("Navigating to http://localhost:8080 ...")
        await page.goto("http://localhost:8080")
        await page.wait_for_function("""() => {
            return typeof window.MetroWebGLLayer !== 'undefined' && 
                   typeof window.MetroWebGLLayer.getDebugInfo === 'function' &&
                   window.MetroWebGLLayer.getDebugInfo().isReady;
        }""", timeout=25000)
        print("Scene is 100% READY!")

        # Set to daylight mode and select Red Line
        await page.evaluate("""() => {
            const timeSlider = document.getElementById('time-scrubber');
            if (timeSlider) {
                timeSlider.value = 720; // 12:00 PM Midday
                timeSlider.dispatchEvent(new Event('input', { bubbles: true }));
                timeSlider.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const btnRed = document.getElementById('btn-line-red');
            if (btnRed) btnRed.click();
        }""")
        await asyncio.sleep(2)

        # 1. INDERLOK - Bi-Level Hub (Red Line Upper + Green Line Lower + Parsvnath Mall Concourse)
        print("Capturing Inderlok...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1699, 28.6732],
                zoom: 17.8,
                pitch: 55,
                bearing: -45
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_interchange_inderlok.png"))

        # 2. WELCOME - Elevated Cross & 110m Skywalk over Shahdara Flyover
        print("Capturing Welcome...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2772, 28.6721],
                zoom: 17.5,
                pitch: 58,
                bearing: 30
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_interchange_welcome.png"))

        # 3. NETAJI SUBHASH PLACE - Elevated Red Line & Pacific Mall Underground Cutaway
        print("Capturing Netaji Subhash Place...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1532, 28.6956],
                zoom: 17.5,
                pitch: 55,
                bearing: 45
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_interchange_nsp.png"))

        # 4. KASHMERE GATE - Elevated Red Line over Yellow & Violet Underground Tubes
        print("Capturing Kashmere Gate...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2281, 28.6675],
                zoom: 17.6,
                pitch: 55,
                bearing: -25
            });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daylight_interchange_kashmere_gate.png"))

        await browser.close()
        print("All 4 daylight interchange screenshots captured successfully!")

asyncio.run(main())
