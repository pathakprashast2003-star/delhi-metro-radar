import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 8086

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

    targets = [
        ("01_yashobhoomi", [77.0453, 28.5508], 18.0, 55, -20),
        ("02_dwarka21", [77.0585, 28.5519], 18.0, 55, -20),
        ("03_track_d21_igi", [77.0720, 28.5540], 17.0, 55, -20),
        ("04_igi_airport", [77.0867, 28.5565], 18.0, 55, -20),
        ("05_aerocity", [77.1208, 28.5488], 18.0, 55, -20),
        ("06_portal_south_ramp", [77.1330, 28.5594], 17.5, 58, -32),
        ("07_dhaula_kuan", [77.1617, 28.5919], 17.5, 58, -32),
        ("08_portal_north_ramp", [77.1741, 28.6114], 17.5, 58, -32),
        ("09_shivaji_stadium", [77.2113, 28.6289], 18.0, 55, -20),
        ("10_new_delhi", [77.2231, 28.6425], 18.0, 55, -20)
    ]

    for name, center, zoom, pitch, bearing in targets:
        page.evaluate(f"""([lng, lat, z, p, b]) => {{
            const m = window.mapInstance || window.map;
            if (m) m.jumpTo({{ center: [lng, lat], zoom: z, pitch: p, bearing: b }});
        }}""", [center[0], center[1], zoom, pitch, bearing])
        time.sleep(2)
        page.screenshot(path=f"orange_shot_{name}.png")
        print(f"Captured orange_shot_{name}.png")
