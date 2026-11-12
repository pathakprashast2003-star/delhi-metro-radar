import time
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
        
        print("Waiting for MetroWebGLLayer.isReady...")
        page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo().isReady", timeout=30000)
        time.sleep(2)
        
        # 1. Test clicking station dropdown
        print("Opening station stepper dropdown...")
        page.click("#btn-station-step-info")
        time.sleep(1)
        
        dropdown_visible = page.is_visible("#station-stepper-dropdown")
        print(f"Dropdown visible: {dropdown_visible}")
        page.screenshot(path="test_dropdown_open.png")
        print("Saved test_dropdown_open.png")
        
        # 2. Search for Yamuna in dropdown and click it
        print("Searching 'Yamuna' in dropdown...")
        page.fill("#stepper-station-search", "Yamuna")
        time.sleep(0.5)
        page.screenshot(path="test_dropdown_search_yamuna.png")
        print("Saved test_dropdown_search_yamuna.png")
        
        print("Clicking Yamuna Bank item in dropdown...")
        page.click('.stepper-item[data-name="Yamuna Bank"]')
        time.sleep(2.5)
        
        stepper_name = page.eval_on_selector("#station-step-name", "el => el.textContent")
        stepper_tag = page.eval_on_selector("#station-step-line-tag", "el => el.textContent")
        print(f"Now at: {stepper_tag} {stepper_name}")
        
        # Orbit slightly for high-angle perspective
        page.evaluate("() => { if (window.map) { window.map.setPitch(56); window.map.setBearing(-28); } }")
        time.sleep(1.5)
        page.screenshot(path="test_yamuna_bank_at_grade_crossover.png")
        print("Saved test_yamuna_bank_at_grade_crossover.png")
        
        # 3. Test jumping to Noida Electronic City via dropdown
        print("Opening dropdown again and jumping to Noida Electronic City...")
        page.click("#btn-station-step-info")
        time.sleep(0.5)
        page.fill("#stepper-station-search", "Noida Electronic")
        time.sleep(0.5)
        page.click('.stepper-item[data-name="Noida Electronic City"]')
        time.sleep(2.5)
        
        # Walk +100m to inspect the extended turnaround viaduct, scissor crossover, buffer stops & future piers
        print("Walking +100m past station into turnaround facility...")
        page.click("#btn-step-ahead-100")
        time.sleep(1)
        page.evaluate("() => { if (window.map) { window.map.setPitch(54); window.map.setBearing(-42); } }")
        time.sleep(1.5)
        page.screenshot(path="test_noida_electronic_turnaround_extension.png")
        print("Saved test_noida_electronic_turnaround_extension.png")
        
        browser.close()
        print("Test complete!")

if __name__ == "__main__":
    run_test()

