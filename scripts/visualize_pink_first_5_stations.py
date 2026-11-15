import os
import time
from playwright.sync_api import sync_playwright

def run():
    artifacts_dir = '/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229'
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=swiftshader'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda err: errors.append(str(err)))

        print('Navigating to http://localhost:8080...')
        page.goto('http://localhost:8080', wait_until='networkidle')

        print('Waiting for MetroWebGLLayer...')
        page.wait_for_function('() => window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getCorridors === "function"')
        time.sleep(2)

        # Click Pink Line filter
        print('Activating Pink Line filter...')
        page.click('#btn-line-pink')
        time.sleep(1.5)

        # Verify active line is pink
        active_line = page.evaluate('() => window.MetroWebGLLayer.getActiveLine()')
        print('Active line:', active_line)
        assert active_line == 'pink', f"Expected activeLine 'pink', got '{active_line}'"

        # 1. Station 1: Majlis Park
        print('Capturing 1. Majlis Park...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Majlis Park")')
        time.sleep(2.0)
        p1 = os.path.join(artifacts_dir, 'pink_st1_majlis_park.png')
        page.screenshot(path=p1)
        print('Saved:', p1)

        # 2. Mukundpur Depot (Connected to Majlis Park)
        print('Capturing Mukundpur Depot...')
        page.evaluate('() => { const map = window.map; if (map) map.flyTo({ center: [77.1870, 28.7245], zoom: 16.2, pitch: 56, bearing: 25 }); }')
        time.sleep(2.0)
        p_depot = os.path.join(artifacts_dir, 'pink_mukundpur_depot_yard.png')
        page.screenshot(path=p_depot)
        print('Saved:', p_depot)

        # 3. Station 2: Azadpur (Interchange with Yellow Line)
        print('Capturing 2. Azadpur...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Azadpur")')
        time.sleep(2.0)
        az_info = page.evaluate('''() => {
            return {
                lineTag: document.getElementById("station-step-line-tag") ? document.getElementById("station-step-line-tag").innerText : null,
                stepCount: document.getElementById("station-step-count") ? document.getElementById("station-step-count").innerText : null,
                stepName: document.getElementById("station-step-name") ? document.getElementById("station-step-name").innerText : null,
                activeLine: window.MetroWebGLLayer.getActiveLine()
            };
        }''')
        print('Azadpur Stepper State:', az_info)
        assert az_info['lineTag'] == 'PL', f"Expected PL line tag, got {az_info['lineTag']}"
        assert az_info['activeLine'] == 'pink', f"Expected activeLine pink, got {az_info['activeLine']}"
        p2 = os.path.join(artifacts_dir, 'pink_st2_azadpur.png')
        page.screenshot(path=p2)
        print('Saved:', p2)

        # Also open station panel on Azadpur to check interchange pill
        page.evaluate('() => window.openStationPanel("Azadpur")')
        time.sleep(1.0)
        p2_panel = os.path.join(artifacts_dir, 'pink_st2_azadpur_panel.png')
        page.screenshot(path=p2_panel)
        print('Saved:', p2_panel)

        # 4. Station 3: Shalimar Bagh
        print('Capturing 3. Shalimar Bagh...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Shalimar Bagh")')
        time.sleep(2.0)
        sb_info = page.evaluate('''() => {
            return {
                lineTag: document.getElementById("station-step-line-tag") ? document.getElementById("station-step-line-tag").innerText : null,
                stepCount: document.getElementById("station-step-count") ? document.getElementById("station-step-count").innerText : null,
                stepName: document.getElementById("station-step-name") ? document.getElementById("station-step-name").innerText : null
            };
        }''')
        print('Shalimar Bagh Stepper State:', sb_info)
        p3 = os.path.join(artifacts_dir, 'pink_st3_shalimar_bagh.png')
        page.screenshot(path=p3)
        print('Saved:', p3)

        # 5. Station 4: Netaji Subhash Place (Interchange with Red Line)
        print('Capturing 4. Netaji Subhash Place...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Netaji Subhash Place")')
        time.sleep(2.0)
        nsp_info = page.evaluate('''() => {
            return {
                lineTag: document.getElementById("station-step-line-tag") ? document.getElementById("station-step-line-tag").innerText : null,
                stepCount: document.getElementById("station-step-count") ? document.getElementById("station-step-count").innerText : null,
                stepName: document.getElementById("station-step-name") ? document.getElementById("station-step-name").innerText : null
            };
        }''')
        print('NSP Stepper State:', nsp_info)
        p4 = os.path.join(artifacts_dir, 'pink_st4_netaji_subhash_place.png')
        page.screenshot(path=p4)
        print('Saved:', p4)

        # 6. Station 5: Shakurpur (Interchange with Shakurbasti Indian Railways)
        print('Capturing 5. Shakurpur...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Shakurpur")')
        time.sleep(2.0)
        sk_info = page.evaluate('''() => {
            return {
                lineTag: document.getElementById("station-step-line-tag") ? document.getElementById("station-step-line-tag").innerText : null,
                stepCount: document.getElementById("station-step-count") ? document.getElementById("station-step-count").innerText : null,
                stepName: document.getElementById("station-step-name") ? document.getElementById("station-step-name").innerText : null
            };
        }''')
        print('Shakurpur Stepper State:', sk_info)
        p5 = os.path.join(artifacts_dir, 'pink_st5_shakurpur.png')
        page.screenshot(path=p5)
        print('Saved:', p5)

        browser.close()
        real_errors = [e for e in errors if 'favicon' not in e.lower()]
        print(f'Total errors: {len(real_errors)}')
        assert len(real_errors) == 0, f'Found errors: {real_errors}'

if __name__ == '__main__':
    run()
