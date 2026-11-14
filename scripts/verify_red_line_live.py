import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[ERROR] {err}"))

        print("Navigating to http://localhost:8080/index.html ...")
        await page.goto("http://localhost:8080/index.html", wait_until="networkidle")
        await page.wait_for_timeout(5000)

        # Check console for any errors
        errors = [l for l in console_logs if "[error]" in l.lower() or "[error]" in l]
        print(f"Console errors ({len(errors)}):")
        for e in errors[:10]:
            print("  ", e)

        # Take initial screenshot
        await page.screenshot(path="/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verify_initial_view.png")

        # Click Red Line button
        print("Clicking #btn-line-red ...")
        red_btn = await page.query_selector("#btn-line-red")
        if red_btn:
            await red_btn.click()
            await page.wait_for_timeout(3000)
            await page.screenshot(path="/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229/verify_red_line_clicked.png")
            print("Captured verify_red_line_clicked.png")
        else:
            print("ERROR: #btn-line-red not found!")

        # Evaluate Red Line variables in page
        eval_result = await page.evaluate("""() => {
            const w = window;
            return {
                hasRedCorridor: !!w.redCorridor,
                hasMetroLayer: !!w.metroLayer,
                corridorStations: w.metroLayer && w.metroLayer.getRedStations ? w.metroLayer.getRedStations().length : 'N/A'
            };
        }""")
        print("Page eval result:", eval_result)

        await browser.close()

asyncio.run(run())
