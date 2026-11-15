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

        print('Navigating to http://localhost:8080...')
        page.goto('http://localhost:8080', wait_until='networkidle')

        # Wait for MetroWebGLLayer to be ready
        print('Waiting for MetroWebGLLayer...')
        page.wait_for_function('() => window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getCorridors === "function"')
        
        # Wait a bit for async data loading (pink, red, yellow, etc.)
        for _ in range(30):
            ready = page.evaluate('() => { const c = window.MetroWebGLLayer.getCorridors(); return Boolean(c && c.pink && c.pink.samples && c.pink.samples.length > 0); }')
            if ready:
                break
            time.sleep(0.5)

        pink_info = page.evaluate('''() => {
            const c = window.MetroWebGLLayer.getCorridors();
            if (!c || !c.pink) return null;
            return {
                sampleCount: c.pink.samples.length,
                stationCount: c.pink.stationsData.length,
                totalLen: c.pink.totalLen,
                firstStation: c.pink.stationsData[0].name,
                lastStation: c.pink.stationsData[c.pink.stationsData.length - 1].name
            };
        }''')
        print('Pink Corridor info:', pink_info)
        assert pink_info is not None, 'Pink corridor failed to load!'
        assert pink_info['stationCount'] == 38, f"Expected 38 stations, got {pink_info['stationCount']}"
        assert pink_info['sampleCount'] > 500, f"Expected >500 samples, got {pink_info['sampleCount']}"
        assert pink_info['firstStation'] == 'Majlis Park', f"Expected first station Majlis Park, got {pink_info['firstStation']}"
        assert pink_info['lastStation'] == 'Shiv Vihar', f"Expected last station Shiv Vihar, got {pink_info['lastStation']}"

        # Click Pink line filter
        print('Clicking Pink Line filter button...')
        page.click('#btn-line-pink')
        time.sleep(2.0)

        active_line = page.evaluate('() => window.MetroWebGLLayer.getActiveLine()')
        print('Active line:', active_line)
        assert active_line == 'pink', f"Expected active line 'pink', got {active_line}"

        # Screenshot 1: Pink Line Overview
        p1 = os.path.join(artifacts_dir, 'verified_pink_line_overview.png')
        page.screenshot(path=p1)
        print('Saved:', p1)

        # Fly to Majlis Park
        print('Flying to Majlis Park...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Majlis Park")')
        time.sleep(2.0)
        p2 = os.path.join(artifacts_dir, 'verified_pink_line_majlis_park_terminus.png')
        page.screenshot(path=p2)
        print('Saved:', p2)

        # Fly to South Campus (+23.6m viaduct)
        print('Flying to Durgabai Deshmukh South Campus...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Durgabai Deshmukh South Campus")')
        time.sleep(2.0)
        p3 = os.path.join(artifacts_dir, 'verified_pink_line_south_campus_viaduct.png')
        page.screenshot(path=p3)
        print('Saved:', p3)

        # Fly to Mayur Vihar-I
        print('Flying to Mayur Vihar-I...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Mayur Vihar-I")')
        time.sleep(2.0)
        p4 = os.path.join(artifacts_dir, 'verified_pink_line_mayur_vihar_1_interchange.png')
        page.screenshot(path=p4)
        print('Saved:', p4)

        # Fly to Shiv Vihar
        print('Flying to Shiv Vihar...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Shiv Vihar")')
        time.sleep(2.0)
        p5 = os.path.join(artifacts_dir, 'verified_pink_line_shiv_vihar_terminus.png')
        page.screenshot(path=p5)
        print('Saved:', p5)

        # Print page errors if any
        real_errors = [e for e in errors if 'favicon' not in e.lower()]
        print(f'Total errors: {len(real_errors)}')
        if real_errors:
            print('Errors:', real_errors)

        browser.close()
        assert len(real_errors) == 0, f'Found {len(real_errors)} console errors'

if __name__ == '__main__':
    run()
