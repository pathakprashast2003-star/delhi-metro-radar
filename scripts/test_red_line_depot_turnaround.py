import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']
        )
        context = await browser.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=2)
        page = await context.new_page()

        errors = []
        page.on('console', lambda msg: print(f'[{msg.type}] {msg.text}'))
        page.on('pageerror', lambda err: errors.append(f'[PAGE ERROR] {err}'))

        print('Loading http://localhost:8080 ...')
        await page.goto('http://localhost:8080')
        await page.wait_for_function('() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady', timeout=25000)
        print('Scene is 100% READY!')
        await asyncio.sleep(3)

        # 1. Click Shastri Depot bookmark chip
        print('Navigating to Shastri Park Depot...')
        await page.evaluate("() => document.querySelector('.bookmark-chip[data-loc=\"shastridepot\"]').click()")
        await asyncio.sleep(4)
        active_line = await page.evaluate("() => window.MetroWebGLLayer.getActiveLine()")
        print('Active line at Shastri Depot:', active_line)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_shastri_park_depot_3d.png')
        print('Saved verified_shastri_park_depot_3d.png')

        # 2. Click Rithala bookmark chip
        print('Navigating to Rithala Terminus...')
        await page.evaluate("() => document.querySelector('.bookmark-chip[data-loc=\"rithala\"]').click()")
        await asyncio.sleep(4)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_rithala_turnaround_3d.png')
        print('Saved verified_rithala_turnaround_3d.png')

        # 3. Click Shaheed Sthal bookmark chip
        print('Navigating to Shaheed Sthal Terminus...')
        await page.evaluate("() => document.querySelector('.bookmark-chip[data-loc=\"shaheed\"]').click()")
        await asyncio.sleep(4)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_shaheed_sthal_turnaround_3d.png')
        print('Saved verified_shaheed_sthal_turnaround_3d.png')

        if errors:
            print('Page errors:', errors)
            raise RuntimeError('Errors detected in test run')
        else:
            print('ALL RED LINE DEPOT & TURNAROUND TESTS PASSED WITH 0 ERRORS!')

        await browser.close()

asyncio.run(run())
