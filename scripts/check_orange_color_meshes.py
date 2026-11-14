import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8091

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
        const infra = layer.getInfraGroup();
        const results = [];
        infra.traverse(obj => {
            if (obj.isMesh && obj.material) {
                const hex = obj.material.color ? obj.material.color.getHexString().toLowerCase() : '';
                const emHex = obj.material.emissive ? obj.material.emissive.getHexString().toLowerCase() : '';
                if (hex.includes('f97316') || hex.includes('ea580c') || emHex.includes('f97316') || emHex.includes('ea580c')) {
                    const count = obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 0;
                    if (obj.geometry) obj.geometry.computeBoundingBox();
                    const bb = obj.geometry ? obj.geometry.boundingBox : null;
                    results.push({
                        type: obj.type,
                        count,
                        parentType: obj.parent ? obj.parent.type : null,
                        parentVisible: obj.parent ? obj.parent.visible : null,
                        visible: obj.visible,
                        min: bb ? { x: Math.round(bb.min.x), y: Math.round(bb.min.y), z: Math.round(bb.min.z) } : null,
                        max: bb ? { x: Math.round(bb.max.x), y: Math.round(bb.max.y), z: Math.round(bb.max.z) } : null
                    });
                }
            }
        });
        return results;
    }""")

    print(f"Total orange-colored meshes: {len(diag)}")
    for i, m in enumerate(diag):
        print(f"Orange Mesh {i}: {m}")
