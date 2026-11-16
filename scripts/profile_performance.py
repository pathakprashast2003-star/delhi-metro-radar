import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

def profile():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl', '--use-gl=angle'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        t0 = time.time()
        page.goto('http://localhost:8080', wait_until='networkidle')
        t_load = time.time() - t0

        page.wait_for_function('() => window.MetroWebGLLayer && typeof window.MetroWebGLLayer.getCorridors === "function"')
        t_ready = time.time() - t0

        # Measure Three.js renderer metrics & heap
        metrics = page.evaluate('''() => {
            const dbg = window.MetroWebGLLayer ? window.MetroWebGLLayer.getDebugInfo() : null;
            const rInfo = dbg && dbg.renderStats ? dbg.renderStats : null;

            const mem = window.performance && window.performance.memory ? {
                usedMB: (window.performance.memory.usedJSHeapSize / 1048576).toFixed(1),
                totalMB: (window.performance.memory.totalJSHeapSize / 1048576).toFixed(1)
            } : null;

            return { rInfo, mem };
        }''')

        # Measure FPS during 360 camera orbit (100 frames)
        fps_data = page.evaluate('''async () => {
            const map = window.map;
            const frameDts = [];
            let lastT = performance.now();
            
            // Pan camera continuously for 120 frames
            return new Promise((resolve) => {
                let count = 0;
                function onFrame(now) {
                    const dt = now - lastT;
                    lastT = now;
                    frameDts.push(dt);
                    map.setBearing(map.getBearing() + 0.5);
                    count++;
                    if (count < 100) {
                        requestAnimationFrame(onFrame);
                    } else {
                        // calculate stats
                        frameDts.shift(); // drop first warm frame
                        const avgDt = frameDts.reduce((a,b) => a+b, 0) / frameDts.length;
                        const maxDt = Math.max(...frameDts);
                        const minDt = Math.min(...frameDts);
                        const fps = 1000 / avgDt;
                        const drops = frameDts.filter(d => d > 33.3).length; // drops below 30 fps
                        resolve({ avgDt, maxDt, minDt, fps, drops, sampleCount: frameDts.length });
                    }
                }
                requestAnimationFrame(onFrame);
            });
        }''')

        print(f"--- BASELINE PERFORMANCE ---")
        print(f"Page Load: {t_load:.2f}s | Ready: {t_ready:.2f}s")
        print(f"Renderer Info: {json.dumps(metrics['rInfo'], indent=2)}")
        print(f"Memory: {json.dumps(metrics['mem'], indent=2)}")
        print(f"FPS Orbit Test: Avg FPS = {fps_data['fps']:.1f}, Avg Frame = {fps_data['avgDt']:.2f}ms, Max Frame = {fps_data['maxDt']:.2f}ms, Drops (>33ms) = {fps_data['drops']}/{fps_data['sampleCount']}")

        browser.close()

if __name__ == '__main__':
    profile()
