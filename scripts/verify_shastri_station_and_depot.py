import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1400, 'height': 900})

        console_errors = []
        page.on('console', lambda msg: console_errors.append(f'[{msg.type}] {msg.text}') if msg.type in ['error', 'warn'] else None)
        page.on('pageerror', lambda err: console_errors.append(f'[UNCAUGHT] {err}'))

        print('Navigating to http://localhost:8080/index.html ...')
        await page.goto('http://localhost:8080/index.html', wait_until='domcontentloaded')
        await page.wait_for_function('() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady', timeout=20000)

        # 1. Focus Red Line
        print('Selecting Red Line...')
        await page.evaluate("() => { const b = document.getElementById('btn-line-red'); if (b) b.click(); }")
        await asyncio.sleep(1.5)

        # 2. Inspect Shastri Park Station Close-Up
        print('Flying to Shastri Park Station...')
        await page.evaluate("() => window.MetroWebGLLayer.flyToStation('Shastri Park')")
        await asyncio.sleep(3)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_shastri_park_station_3d.png')
        print('Captured verified_shastri_park_station_3d.png')

        # 3. Inspect Shastri Park Depot Close-Up
        print('Flying to Shastri Park Depot...')
        await page.evaluate("() => window.MetroWebGLLayer.flyToStation('Shastri Park Depot')")
        await asyncio.sleep(3)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_shastri_park_depot_3d.png')
        print('Captured verified_shastri_park_depot_3d.png')

        # 4. Panoramic View of both Station and Depot Connected Together
        print('Capturing panoramic view of Station + Depot connection...')
        await page.evaluate("""() => {
            const map = window.__metroMap;
            if (map) map.flyTo({ center: [77.2475, 28.6698], zoom: 16.5, pitch: 58, bearing: -34, duration: 600 });
        }""")
        await asyncio.sleep(3)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_shastri_park_station_and_depot_panoramic.png')
        print('Captured verified_shastri_park_station_and_depot_panoramic.png')

        errors = [e for e in console_errors if '[error]' in e or '[UNCAUGHT]' in e]
        print(f'Total errors: {len(errors)}')
        for err in errors:
            print('ERROR:', err)

        await browser.close()
        assert len(errors) == 0, f'Found {len(errors)} errors: {errors}'
        print('ALL SHASTRI PARK CHECKS PASSED WITH ZERO ERRORS!')

if __name__ == '__main__':
    asyncio.run(main())
