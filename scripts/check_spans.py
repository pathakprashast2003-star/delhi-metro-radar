import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8089

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

threading.Thread(target=start_server, daemon=True).start()
time.sleep(1)

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args=["--use-gl=angle", "--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"]
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    page.goto(f"http://localhost:{PORT}", wait_until="networkidle", timeout=30000)
    page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady === true", timeout=20000)
    time.sleep(2)

    diag = page.evaluate("""() => {
        const layer = window.MetroWebGLLayer;
        const corridors = layer.getCorridors();
        const oc = corridors.orange;
        if (!oc) return { error: "No orange" };

        const cSamples = oc.samples;
        const cStations = oc.stationsData;
        const cLen = oc.totalLen;

        // Simulate extractSpans exactly as metro_webgl_layer.js does:
        function extractSpans(predicate, bridgeOverlap = false) {
            const spans = [];
            let cur = [];
            for (let i = 0; i < cSamples.length; i++) {
                if (predicate(cSamples[i])) {
                    if (bridgeOverlap && cur.length === 0 && i > 0) cur.push(cSamples[i - 1]);
                    cur.push(cSamples[i]);
                } else if (cur.length > 0) {
                    if (bridgeOverlap) cur.push(cSamples[i]);
                    if (cur.length > 1) spans.push(cur);
                    cur = [];
                }
            }
            if (cur.length > 1) spans.push(cur);
            return spans;
        }

        function isOpenCut(s) {
            if (s.elev > 0.28 + 0.35) return true;
            for (let i = 0; i < oc.portalDists.length; i++) {
                if (Math.abs(oc.portalDists[i] - s.dist) <= 10) return true;
            }
            for (let i = 0; i < cStations.length; i++) {
                const st = cStations[i];
                if (st.structure !== 'elevated' && Math.abs(st.dist - s.dist) <= 42.0) return true;
            }
            return false;
        }

        const surfSpans = extractSpans((s) => isOpenCut(s), false).map(sp => ({
            startDist: sp[0].dist,
            endDist: sp[sp.length - 1].dist,
            count: sp.length
        }));

        const burSpans = extractSpans((s) => !isOpenCut(s), true).map(sp => ({
            startDist: sp[0].dist,
            endDist: sp[sp.length - 1].dist,
            count: sp.length
        }));

        return {
            totalLen: cLen,
            portalDists: oc.portalDists,
            stations: cStations.map(s => ({ name: s.name, dist: s.dist, structure: s.structure })),
            surfSpans,
            burSpans
        };
    }""")

    print(json.dumps(diag, indent=2))

