import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8088

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

    page.click("#btn-line-orange")
    time.sleep(1)

    diag = page.evaluate("""() => {
        const layer = window.MetroWebGLLayer;
        const debug = layer.getDebugInfo();
        const subRailsVis = layer.isSubwayRailsVisible();
        const xray = layer.isUndergroundXRay();

        const infra = layer.getInfraGroup();
        // find buriedSubwayGroup
        let buriedGroup = null;
        infra.traverse(obj => {
            if (obj.children && obj.children.some(c => c.children && c.children.some(cc => cc.geometry && cc.geometry.attributes && cc.geometry.attributes.position && cc.geometry.attributes.position.count > 1000))) {
                // candidate
            }
        });

        // Let's inspect all groups in infra
        const children = infra.children.map(c => ({
            type: c.type,
            name: c.name,
            visible: c.visible,
            childrenCount: c.children ? c.children.length : 0
        }));

        return {
            subRailsVis,
            xray,
            infraDirectChildren: children
        };
    }""")

    print(json.dumps(diag, indent=2))

