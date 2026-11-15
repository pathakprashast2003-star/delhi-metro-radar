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

        # 1. Samaypur Badli default view
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_samaypur_badli_v28.png')
        print('Saved verified_samaypur_badli_v28.png')

        # 2. Click Red Line
        print('Clicking Red Line button...')
        await page.evaluate("() => document.getElementById('btn-line-red').click()")
        await asyncio.sleep(3)
        stepper_red = await page.inner_text('#station-stepper-pill')
        print('Stepper on Red:', stepper_red.replace('\n', ' '))
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_red_line_rithala_v28.png')
        print('Saved verified_red_line_rithala_v28.png')

        # 3. Click Samaypur bookmark chip WHILE Red Line is active!
        print('Clicking Samaypur bookmark chip while Red was active...')
        await page.evaluate("() => document.querySelector('.bookmark-chip[data-loc=\"samaypur\"]').click()")
        await asyncio.sleep(3)
        stepper_samaypur = await page.inner_text('#station-stepper-pill')
        print('Stepper after clicking Samaypur:', stepper_samaypur.replace('\n', ' '))
        active_line_now = await page.evaluate("() => window.MetroWebGLLayer.getActiveLine()")
        print('Active line after clicking Samaypur bookmark:', active_line_now)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_samaypur_after_red_v28.png')
        print('Saved verified_samaypur_after_red_v28.png')

        # 4. Click Inderlok bookmark chip
        print('Clicking Inderlok bookmark chip...')
        await page.evaluate("() => document.querySelector('.bookmark-chip[data-loc=\"inderlok\"]').click()")
        await asyncio.sleep(3)
        stepper_inderlok = await page.inner_text('#station-stepper-pill')
        print('Stepper after clicking Inderlok:', stepper_inderlok.replace('\n', ' '))
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_inderlok_v28.png')
        print('Saved verified_inderlok_v28.png')

        # 5. Click Welcome bookmark chip
        print('Clicking Welcome bookmark chip...')
        await page.evaluate("() => document.querySelector('.bookmark-chip[data-loc=\"welcome\"]').click()")
        await asyncio.sleep(3)
        stepper_welcome = await page.inner_text('#station-stepper-pill')
        print('Stepper after clicking Welcome:', stepper_welcome.replace('\n', ' '))
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verified_welcome_v28.png')
        print('Saved verified_welcome_v28.png')

        if errors:
            print('Page errors:', errors)
            raise RuntimeError('Page errors detected!')
        else:
            print('ALL TESTS PASSED WITH 0 ERRORS!')

        await browser.close()

asyncio.run(run())
