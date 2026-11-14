import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8090

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

        const infra = layer.getInfraGroup();
        // find buriedSubwayGroup and its lineSubwayGroup children
        const results = [];
        infra.traverse(obj => {
            if (obj.isMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
                const count = obj.geometry.attributes.position.count;
                if (count > 500) {
                    obj.geometry.computeBoundingBox();
                    const bb = obj.geometry.boundingBox;
                    results.push({
                        name: obj.name || obj.material.type,
                        matColor: obj.material.color ? obj.material.color.getHexString() : null,
                        matOpacity: obj.material.opacity,
                        transparent: obj.material.transparent,
                        count,
                        min: { x: Math.round(bb.min.x), y: Math.round(bb.min.y), z: Math.round(bb.min.z) },
                        max: { x: Math.round(bb.max.x), y: Math.round(bb.max.y), z: Math.round(bb.max.z) }
                    });
                }
            }
        });
        return results;
    }""")

    print(f"Total large meshes found: {len(diag)}")
    
orange_meshes = [m for m in diag if m['min']['x'] < -14000]
print(f'Total meshes with min.x < -14000: {len(orange_meshes)}')
for i, m in enumerate(orange_meshes[:15]):

        print(f"Mesh {i}: {m}")
