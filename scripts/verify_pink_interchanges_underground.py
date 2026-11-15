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
        
        for _ in range(30):
            ready = page.evaluate('() => { const c = window.MetroWebGLLayer.getCorridors(); return Boolean(c && c.pink && c.pink.samples && c.pink.samples.length > 0); }')
            if ready:
                break
            time.sleep(0.5)

        # 1. Azadpur (Underground cutaway station)
        print('Flying to Azadpur (Underground)...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Azadpur")')
        time.sleep(2.5)
        p1 = os.path.join(artifacts_dir, 'verified_pink_azadpur_underground.png')
        page.screenshot(path=p1)
        print('Saved:', p1)

        # 2. Welcome (Interchange with Red Line)
        print('Flying to Welcome (Pink over Red)...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Welcome")')
        time.sleep(2.5)
        p2 = os.path.join(artifacts_dir, 'verified_pink_welcome_red_interchange.png')
        page.screenshot(path=p2)
        print('Saved:', p2)

        # 3. Rajouri Garden (Pink over Blue)
        print('Flying to Rajouri Garden...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Rajouri Garden")')
        time.sleep(2.5)
        p3 = os.path.join(artifacts_dir, 'verified_pink_rajouri_garden_interchange.png')
        page.screenshot(path=p3)
        print('Saved:', p3)

        # 4. Dilli Haat - INA (Underground)
        print('Flying to Dilli Haat - INA...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Dilli Haat - INA")')
        time.sleep(2.5)
        p4 = os.path.join(artifacts_dir, 'verified_pink_dilli_haat_ina_underground.png')
        page.screenshot(path=p4)
        print('Saved:', p4)

        # 5. Karkarduma (Pink + Blue)
        print('Flying to Karkarduma...')
        page.evaluate('() => window.MetroWebGLLayer.flyToStation("Karkarduma")')
        time.sleep(2.5)
        p5 = os.path.join(artifacts_dir, 'verified_pink_karkarduma_flyover.png')
        page.screenshot(path=p5)
        print('Saved:', p5)

        browser.close()
        real_errors = [e for e in errors if 'favicon' not in e.lower()]
        print(f'Total errors: {len(real_errors)}')
        assert len(real_errors) == 0, f'Found errors: {real_errors}'

if __name__ == '__main__':
    run()
