import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()

        console_errors = []
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)

        print("Navigating to http://localhost:8080/ ...")
        await page.goto('http://localhost:8080/', wait_until='networkidle')
        await asyncio.sleep(2)

        # 1. Take Overview Screenshot
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520/verified_delhi_3d_master_overview.png')
        print("Captured master overview screenshot.")

        # 2. Test Station Search: Type "Hauz Khas" in search input
        search_input = page.locator('#station-search-input')
        await search_input.fill('Hauz Khas')
        await asyncio.sleep(0.5)

        # Ensure search dropdown appears
        results = page.locator('#station-search-results')
        is_visible = await results.is_visible()
        print(f"Search results visible: {is_visible}")

        # Click the first matching result
        first_item = results.locator('.search-result-item').first
        await first_item.click()
        await asyncio.sleep(1.5)

        # Capture station panel open screenshot
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520/verified_delhi_3d_station_search_fly.png')
        print("Captured station search fly-to screenshot.")

        # 3. Test Night Mode Toggle
        btn_night = page.locator('#btn-light-night')
        await btn_night.click()
        await asyncio.sleep(1.0)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520/verified_delhi_3d_midnight_trains.png')
        print("Captured midnight trains screenshot.")

        # 4. Test 2D Plan View Toggle
        tab_2d = page.locator('#tab-corridor')
        await tab_2d.click()
        await asyncio.sleep(1.2)
        await page.screenshot(path='/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520/verified_delhi_3d_2d_cartography.png')
        print("Captured 2D cartography screenshot.")

        print(f"Total console errors: {len(console_errors)}")
        for err in console_errors:
            print(f"  Error: {err}")

        await browser.close()

asyncio.run(run())
