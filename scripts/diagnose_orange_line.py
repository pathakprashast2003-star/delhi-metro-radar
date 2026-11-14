import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8085

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # suppress access logs

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
time.sleep(1)

errors = []
logs = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args=[
            "--use-gl=angle",
            "--use-angle=metal",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--no-sandbox"
        ]
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    page.on("console", lambda msg: errors.append(f"CONSOLE {msg.type.upper()}: {msg.text}") if msg.type in ["error", "warning"] else logs.append(f"LOG: {msg.text}"))
    page.on("pageerror", lambda err: errors.append(f"PAGE ERROR: {err}"))

    print(f"Navigating to http://localhost:{PORT}...")
    page.goto(f"http://localhost:{PORT}", wait_until="networkidle", timeout=30000)

    print("Waiting for MetroWebGLLayer to finish loading...")
    page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady === true", timeout=20000)
    time.sleep(2)

    diag = page.evaluate("""() => {
        const layer = window.MetroWebGLLayer;
        const corridors = layer.getCorridors();
        const oc = corridors.orange;
        if (!oc) return { hasOrange: false };

        const stations = oc.stationsData.map(s => ({
            name: s.name,
            structure: s.structure,
            dist: s.dist,
            elevM: s.elevM,
            pos: { x: s.pos.x, y: s.pos.y, z: s.pos.z },
            hasGroup: Boolean(s._group),
            groupVisible: s._group ? s._group.visible : false,
            groupChildrenCount: s._group ? s._group.children.length : 0,
            posGroup: s._group ? { x: s._group.position.x, y: s._group.position.y, z: s._group.position.z } : null
        }));

        const scene = layer.getScene();
        const infra = layer.getInfraGroup();

        return {
            hasOrange: true,
            totalLen: oc.totalLen,
            samplesCount: oc.samples.length,
            portalDists: oc.portalDists,
            portalCoordsCount: oc.portalCoords.length,
            stations: stations,
            infraChildrenCount: infra ? infra.children.length : 0
        };
    }""")

    print("Orange Corridor Diagnostics:")
    print(json.dumps(diag, indent=2))

    if errors:
        print("\nConsole Errors/Warnings:")
        for e in errors[:10]:
            print(" ", e)

    # Now click Orange Line button
    print("\nClicking Orange Line...")
    page.click("#btn-line-orange")
    time.sleep(2)

    # Check stations visibility after filter
    vis_after_filter = page.evaluate("""() => {
        const layer = window.MetroWebGLLayer;
        const corridors = layer.getCorridors();
        const oc = corridors.orange;
        return oc.stationsData.map(s => ({
            name: s.name,
            visible: s._group ? s._group.visible : false,
            pos: s._group ? s._group.position : null
        }));
    }""")
    print("Stations visibility after Orange filter:")
    print(json.dumps(vis_after_filter, indent=2))

    # Fly to Dhaula Kuan
    print("\nFlying to Dhaula Kuan...")
    page.click("button.bookmark-chip[data-loc='dhaulakuan']")
    time.sleep(3)

    dk_info = page.evaluate("""() => {
        const layer = window.MetroWebGLLayer;
        const corridors = layer.getCorridors();
        const oc = corridors.orange;
        const dk = oc.stationsData.find(s => s.name === 'Dhaula Kuan');
        const cam = layer.getDebugInfo();
        return {
            stationGroupVisible: dk._group ? dk._group.visible : false,
            stationGroupChildren: dk._group ? dk._group.children.length : 0,
            pos: dk._group ? dk._group.position : null,
            detailVisible: dk._detail ? dk._detail.visible : false
        };
    }""")
    print("Dhaula Kuan station state when viewing Dhaula Kuan:")
    print(json.dumps(dk_info, indent=2))

    page.screenshot(path="diag_dhaula_kuan.png")
    print("Saved diag_dhaula_kuan.png")

