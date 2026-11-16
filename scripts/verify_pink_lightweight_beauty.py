import os
import sys
import time
from playwright.sync_api import sync_playwright

def run():
    artifacts_dir = '/Users/prashastpathak/.gemini/antigravity/brain/17c5f056-af02-4bf6-9437-39e6623ec229'
    errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl', '--use-gl=angle'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        page.on('console', lambda msg: logs.append(f'[{msg.type}] {msg.text}'))
        page.on('pageerror', lambda err: errors.append(str(err)))

        t0 = time.time()
        print('Navigating to http://localhost:8080...')
        page.goto('http://localhost:8080', wait_until='networkidle')
        t_load = time.time() - t0
        print(f'Page loaded in {t_load:.2f}s')

        # Wait for MetroWebGLLayer to be ready
        print('Waiting for MetroWebGLLayer...')
        page.wait_for_function('() => window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getCorridors === "function"')
        
        for _ in range(40):
            ready = page.evaluate('() => { const c = window.MetroWebGLLayer.getCorridors(); return Boolean(c && c.pink && c.pink.samples); }')
            if ready:
                break
            time.sleep(0.2)

        # Measure mesh and triangle counts
        stats = page.evaluate('''() => {
            const corr = window.MetroWebGLLayer.getCorridors();
            let meshCount = 0, totalTriangles = 0;
            const countObj = (obj) => {
                if (!obj) return;
                if (obj.isMesh) {
                    meshCount++;
                    if (obj.geometry) {
                        const pos = obj.geometry.attributes.position;
                        if (pos) {
                            const count = obj.geometry.index ? obj.geometry.index.count : pos.count;
                            totalTriangles += count / 3;
                        }
                    }
                }
                if (obj.children) obj.children.forEach(countObj);
            };
            const res = {};
            for (const [k, c] of Object.entries(corr)) {
                if (!c) continue;
                meshCount = 0; totalTriangles = 0;
                if (c._trackGroup) countObj(c._trackGroup);
                if (c._subwayGroup) countObj(c._subwayGroup);
                res[k] = { 
                    sampleCount: c.samples ? c.samples.length : 0,
                    meshCount, 
                    totalTriangles: Math.round(totalTriangles) 
                };
            }
            return res;
        }''')
        print('Optimized Corridor Mesh Stats:', stats)

        # Switch to Pink Line filter first
        print('Filtering to Pink Line...')
        page.click('#btn-line-pink')
        time.sleep(1.0)

        # 1. Test clicking South Campus Bookmark
        print('Testing Pink Line Bookmark: South Campus...')
        page.click('button[data-loc="southcampus"]')
        time.sleep(2.5)
        p_southcampus = os.path.join(artifacts_dir, 'pink_line_south_campus_beauty.png')
        page.screenshot(path=p_southcampus)
        print('Saved South Campus screenshot')

        # 2. Test clicking Majlis Park Bookmark
        print('Testing Pink Line Bookmark: Majlis Park...')
        page.click('button[data-loc="majlis"]')
        time.sleep(2.5)
        p_majlis = os.path.join(artifacts_dir, 'pink_line_majlis_park_beauty.png')
        page.screenshot(path=p_majlis)
        print('Saved Majlis Park screenshot')

        # 3. Test clicking Mayur Vihar Bookmark
        print('Testing Pink Line Bookmark: Mayur Vihar...')
        page.click('button[data-loc="mayurvihar"]')
        time.sleep(2.5)
        p_mayur = os.path.join(artifacts_dir, 'pink_line_mayur_vihar_beauty.png')
        page.screenshot(path=p_mayur)
        print('Saved Mayur Vihar screenshot')

        # 4. Test clicking Shiv Vihar Terminus Bookmark
        print('Testing Pink Line Bookmark: Shiv Vihar...')
        page.click('button[data-loc="shivvihar"]')
        time.sleep(2.5)
        p_shiv = os.path.join(artifacts_dir, 'pink_line_shiv_vihar_beauty.png')
        page.screenshot(path=p_shiv)
        print('Saved Shiv Vihar screenshot')

        # Check Active Line
        active_line = page.evaluate('() => window.MetroWebGLLayer.getActiveLine()')
        print('Active Line:', active_line)
        assert active_line == 'pink', f"Expected active line 'pink', got {active_line}"

        # Check errors
        print(f'Total errors: {len(errors)}')
        for err in errors:
            print('ERROR:', err)

        browser.close()

if __name__ == '__main__':
    run()
