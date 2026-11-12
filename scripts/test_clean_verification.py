import time
import os
from playwright.sync_api import sync_playwright

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=metal",
                "--enable-webgl",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        print("Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle", timeout=45000)
        
        # Wait for MetroWebGLLayer to be ready
        print("Waiting for MetroWebGLLayer.isReady...")
        page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady", timeout=30000)
        time.sleep(2)
        
        # 1. Click Blue Line button
        print("Clicking Blue Line pill...")
        page.click("#btn-line-blue")
        time.sleep(2.5)
        
        # Check stepper pill text
        stepper_name = page.eval_on_selector("#station-step-name", "el => el.textContent")
        stepper_tag = page.eval_on_selector("#station-step-line-tag", "el => el.textContent")
        stepper_count = page.eval_on_selector("#station-step-count", "el => el.textContent")
        center = page.evaluate("() => window.map ? window.map.getCenter() : null")
        print(f"Blue Line activated: {stepper_tag} {stepper_count} {stepper_name}, Center: {center}")
        
        page.screenshot(path="test_blue_dwarka_clean.png")
        print("Saved test_blue_dwarka_clean.png")
        
        # 2. Fly to RK Ashram Marg and walk +700m (exact spot from user screenshot)
        print("Navigating to RK Ashram Marg...")
        page.evaluate("() => window.MetroWebGLLayer.flyToStation('RK Ashram Marg')")
        time.sleep(2)
        
        print("Walking +700m along Blue Line track...")
        for _ in range(7):
            page.click("#btn-step-ahead-100")
            time.sleep(0.3)
        time.sleep(2)
        
        offset_text = page.eval_on_selector("#station-step-offset", "el => el.textContent")
        rk_name = page.eval_on_selector("#station-step-name", "el => el.textContent")
        print(f"At {rk_name} with offset: {offset_text}")
        
        # Also switch to night view like user screenshot if desired, or test current daytime
        page.screenshot(path="test_blue_rk_ashram_700m_clean.png")
        print("Saved test_blue_rk_ashram_700m_clean.png")
        
        # Switch to night time 00:15 to test night visual harmony
        page.evaluate("() => window.MetroWebGLLayer.setTimeOfDay(15 * 60)")
        time.sleep(1.5)
        page.screenshot(path="test_blue_rk_ashram_700m_night_clean.png")
        print("Saved test_blue_rk_ashram_700m_night_clean.png")
        
        # 3. Test Rajiv Chowk under 'all' lines
        print("Switching to All Lines...")
        page.click("#btn-line-all")
        time.sleep(2.5)
        page.screenshot(path="test_all_lines_rajiv_chowk_clean.png")
        print("Saved test_all_lines_rajiv_chowk_clean.png")
        
        browser.close()
        print("Test complete!")

if __name__ == "__main__":
    run_test()

