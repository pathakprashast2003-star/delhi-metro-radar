import os
import sys
import time
from playwright.sync_api import sync_playwright

def run():
    artifacts_dir = '/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229'
    errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=swiftshader'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        page.on('console', lambda msg: logs.append(f'[{msg.type}] {msg.text}'))
        page.on('pageerror', lambda err: errors.append(str(err)))

        t0 = time.time()
        print('Navigating to http://localhost:8080...')
        page.goto('http://localhost:8080', wait_until='networkidle')
        t_load = time.time() - t0
        print(f'Page loaded (networkidle) in {t_load:.2f}s')

        # Wait for MetroWebGLLayer to be ready
        print('Waiting for MetroWebGLLayer...')
        page.wait_for_function('() => window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getCorridors === "function"')
        
        # Wait for pink corridor
        for _ in range(40):
            ready = page.evaluate('() => { const c = window.MetroWebGLLayer.getCorridors(); return Boolean(c && c.pink && c.pink.samples && c.pink.samples.length > 0); }')
            if ready:
                break
            time.sleep(0.2)

        # Click Pink Line filter
        print('Filtering to Pink Line...')
        page.click('#btn-line-pink')
        time.sleep(1.0)

        # Fly to Shakurpur
        print('Flying to Shakurpur...')
        page.evaluate('''() => {
            if (window.MetroWebGLLayer && typeof window.MetroWebGLLayer.flyToStation === 'function') {
                window.MetroWebGLLayer.flyToStation("Shakurpur");
            } else if (window.map) {
                window.map.flyTo({
                    center: [77.149664, 28.685676],
                    zoom: 16.5,
                    pitch: 62,
                    bearing: -35,
                    duration: 0
                });
            }
        }''')
        time.sleep(2.5)

        # Check building layer opacity and visibility
        b_info = page.evaluate('''() => {
            const map = window.map;
            if (!map) return { noMap: true };
            const bLayer = map.getLayer('building-3d');
            const dmrcCasing = map.getLayer('dmrc-metro-casing');
            return {
                hasBuilding3D: !!bLayer,
                buildingOpacity: bLayer ? map.getPaintProperty('building-3d', 'fill-extrusion-opacity') : null,
                buildingColor: bLayer ? map.getPaintProperty('building-3d', 'fill-extrusion-color') : null,
                hasDmrcCasing: !!dmrcCasing,
                dmrcFilter: dmrcCasing ? map.getFilter('dmrc-metro-casing') : null
            };
        }''')
        print('Map layers info at Shakurpur:', b_info)

        # Capture Shakurpur screenshot
        shakurpur_path = os.path.join(artifacts_dir, 'shakurpur_fixed.png')
        page.screenshot(path=shakurpur_path)
        print(f'Saved Shakurpur screenshot to {shakurpur_path}')

        # Test Gurugram fly
        print('Testing fly to Gurugram...')
        page.click('#btn-line-all')
        time.sleep(0.5)
        page.evaluate('''() => {
            const map = window.map;
            if (map) {
                map.flyTo({
                    center: [77.0727, 28.4595],
                    zoom: 15.5,
                    pitch: 55,
                    bearing: -20,
                    duration: 0
                });
            }
        }''')
        time.sleep(2.0)
        page.screenshot(path=os.path.join(artifacts_dir, 'gurugram_speed_check.png'))

        # Check console errors
        print(f'Total errors: {len(errors)}')
        for err in errors:
            print('ERROR:', err)

        browser.close()

if __name__ == '__main__':
    run()
