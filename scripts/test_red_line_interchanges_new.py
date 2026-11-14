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

        page.on("console", lambda msg: print(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        print("Navigating to http://localhost:8080 ...")
        await page.goto("http://localhost:8080")
        await page.wait_for_function("""() => {
            return typeof window.MetroWebGLLayer !== 'undefined' && 
                   typeof window.MetroWebGLLayer.getDebugInfo === 'function' &&
                   window.MetroWebGLLayer.getDebugInfo().isReady;
        }""", timeout=25000)
        print("Scene is 100% READY!")

        # Click Red Line button
        await page.evaluate("""() => {
            document.getElementById('btn-line-red').click();
        }""")
        await asyncio.sleep(3)

        # 1. INDERLOK - Closeup of Bi-Level Hub (Red Line Upper + Green Line Lower)
        print("Viewing Inderlok Bi-Level Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1702, 28.6734],
                zoom: 17.6,
                pitch: 58,
                bearing: -50
            });
        }""")
        await asyncio.sleep(4)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_inderlok_bilevel_green_cross.png"))
        print("Captured verified_inderlok_bilevel_green_cross.png!")

        # 2. WELCOME - Elevated Red Line crossing Pink Line
        print("Viewing Welcome Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.2768, 28.6720],
                zoom: 17.5,
                pitch: 56,
                bearing: 35
            });
        }""")
        await asyncio.sleep(4)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_welcome_pink_cross.png"))
        print("Captured verified_welcome_pink_cross.png!")

        # 3. NETAJI SUBHASH PLACE - Elevated Red Line over Pink Line Underground Box
        print("Viewing Netaji Subhash Place Interchange...")
        await page.evaluate("""() => {
            window.map.jumpTo({
                center: [77.1534, 28.6955],
                zoom: 17.4,
                pitch: 58,
                bearing: 40
            });
        }""")
        await asyncio.sleep(4)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "verified_nsp_pink_cross.png"))
        print("Captured verified_nsp_pink_cross.png!")

        await browser.close()
        print("All interchange screenshots captured!")

asyncio.run(main())
