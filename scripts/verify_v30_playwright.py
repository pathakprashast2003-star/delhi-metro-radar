import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1400, 'height': 900})
        page = await context.new_page()

        console_errors = []
        page.on('console', lambda msg: console_errors.append(f'[{msg.type}] {msg.text}') if msg.type in ['error', 'warn'] else None)
        page.on('pageerror', lambda err: console_errors.append(f'[UNCAUGHT] {err}'))

        print('Navigating to http://localhost:8080/index.html ...')
        await page.goto('http://localhost:8080/index.html', wait_until='domcontentloaded')

        # Wait for MapLibre map and MetroWebGLLayer
        print('Waiting for MetroWebGLLayer...')
        await page.wait_for_function('() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady', timeout=20000)

        debug_info = await page.evaluate('() => window.MetroWebGLLayer.getDebugInfo()')
        print('Debug info:', debug_info)

        # 1. Inspect Samaypur Badli
        print('Flying to Samaypur Badli...')
        await page.evaluate("() => window.MetroWebGLLayer.flyToStation('Samaypur Badli')")
        await asyncio.sleep(2.5)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_samaypur_badli_v30.png')
        print('Captured verified_samaypur_badli_v30.png')

        # 2. Click Red Line filter button
        print('Switching to Red line...')
        red_btn = page.locator('#filter-red, [data-line="red"], button:has-text("Red")')
        if await red_btn.count() > 0:
            await red_btn.first.click()
            await asyncio.sleep(1.5)

        # 3. Inspect Shastri Park Depot
        print('Inspecting Shastri Park Depot...')
        await page.evaluate("() => window.MetroWebGLLayer.flyToStation('Shastri Park Depot')")
        await asyncio.sleep(3)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_shastri_depot_v30.png')
        print('Captured verified_shastri_depot_v30.png')

        # 4. Inspect Rithala turnaround
        print('Inspecting Rithala turnaround...')
        await page.evaluate("""() => {
            const map = window.__metroMap;
            if (map) map.flyTo({ center: [77.1045, 28.7215], zoom: 18.0, pitch: 56, bearing: -65, duration: 600 });
        }""")
        await asyncio.sleep(2.5)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_rithala_turnaround_v30.png')
        print('Captured verified_rithala_turnaround_v30.png')

        # 5. Inspect Shaheed Sthal turnaround
        print('Inspecting Shaheed Sthal turnaround...')
        await page.evaluate("""() => {
            const map = window.__metroMap;
            if (map) map.flyTo({ center: [77.4110, 28.6715], zoom: 18.0, pitch: 56, bearing: 75, duration: 600 });
        }""")
        await asyncio.sleep(2.5)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_shaheed_sthal_turnaround_v30.png')
        print('Captured verified_shaheed_sthal_turnaround_v30.png')

        # Filter out harmless warnings (like favicon or webgl info)
        errors = [e for e in console_errors if '[error]' in e or '[UNCAUGHT]' in e]
        print(f'Total errors: {len(errors)}')
        for err in errors:
            print('ERROR:', err)

        await browser.close()
        assert len(errors) == 0, f'Found {len(errors)} errors: {errors}'
        print('ALL TESTS PASSED CLEANLY WITH ZERO ERRORS!')

if __name__ == '__main__':
    asyncio.run(main())
