import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8092

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

    res = page.evaluate("""() => {
        const layer = window.MetroWebGLLayer;
        const corridors = layer.getCorridors();
        const oc = corridors.orange;
        if (!oc) return { error: "No orange corridor" };

        const infra = layer.getInfraGroup();
        // find the orange rail web mesh or ballast mesh in parent
        const meshes = [];
        infra.traverse(obj => {
            if (obj.isMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
                const count = obj.geometry.attributes.position.count;
                if (count > 20000) {
                    obj.geometry.computeBoundingBox();
                    meshes.push({
                        count,
                        visible: obj.visible,
                        parentVisible: obj.parent ? obj.parent.visible : null,
                        bb: obj.geometry.boundingBox
                    });
                }
            }
        });

        return {
            totalLen: oc.totalLen,
            samplesCount: oc.samples.length,
            largeMeshes: meshes
        };
    }""")

    print("Orange Line Continuous Track Verification:")
    print(json.dumps(res, indent=2))
