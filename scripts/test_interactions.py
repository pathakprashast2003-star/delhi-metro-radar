import os
import sys
import time
from playwright.sync_api import sync_playwright

def test_interactions():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl', '--use-gl=angle'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        page.goto('http://localhost:8080', wait_until='networkidle')
        page.wait_for_function('() => window.MetroWebGLLayer && window.map')
        time.sleep(1.0)

        # Measure 1: Line switching performance
        print("--- Testing Line Switching ---")
        lines = ['#btn-line-pink', '#btn-line-blue', '#btn-line-red', '#btn-line-magenta', '#btn-line-yellow', '#btn-line-all']
        for line_btn in lines:
            t0 = time.time()
            page.click(line_btn)
            # wait 3 frames
            page.evaluate('''() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))''')
            dt = (time.time() - t0) * 1000
            print(f"Click {line_btn}: {dt:.1f}ms")

        # Measure 2: Station navigation stepping
        print("--- Testing Rapid Station Next Navigation ---")
        page.click('#btn-line-yellow')
        time.sleep(0.5)
        for i in range(5):
            t0 = time.time()
            page.click('#btn-next-station')
            page.evaluate('''() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))''')
            dt = (time.time() - t0) * 1000
            st_text = page.inner_text('#station-step-name')
            print(f"Step {i+1} to {st_text}: {dt:.1f}ms")

        # Measure 3: Continuous Pan & Zoom frame stats
        print("--- Testing Pan & Zoom 100 frames ---")
        pan_stats = page.evaluate('''async () => {
            const map = window.map;
            const frameDts = [];
            let lastT = performance.now();
            return new Promise((resolve) => {
                let count = 0;
                function onFrame(now) {
                    const dt = now - lastT;
                    lastT = now;
                    frameDts.push(dt);
                    map.panBy([4, 2], { duration: 0 });
                    count++;
                    if (count < 100) {
                        requestAnimationFrame(onFrame);
                    } else {
                        frameDts.shift();
                        const avgDt = frameDts.reduce((a,b) => a+b, 0) / frameDts.length;
                        const maxDt = Math.max(...frameDts);
                        const drops = frameDts.filter(d => d > 33.3).length;
                        resolve({ avgDt, maxDt, drops, count: frameDts.length });
                    }
                }
                requestAnimationFrame(onFrame);
            });
        }''')
        print(f"Pan 100 frames: Avg = {pan_stats['avgDt']:.2f}ms, Max = {pan_stats['maxDt']:.2f}ms, Drops (>33ms) = {pan_stats['drops']}/{pan_stats['count']}")

        browser.close()

if __name__ == '__main__':
    test_interactions()
