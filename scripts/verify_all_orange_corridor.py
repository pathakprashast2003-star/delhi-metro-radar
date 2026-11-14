import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 8099

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

    console_errors = []
    page_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    page.goto(f"http://localhost:{PORT}", wait_until="networkidle", timeout=30000)
    page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady === true", timeout=20000)
    time.sleep(2)

    page.click("#btn-line-orange")
    time.sleep(1)

    shots = [
        ("01_yashobhoomi_iicc", [77.0453, 28.5508], 17.8, 56, -20),
        ("02_dwarka21_dual_hub", [77.0585, 28.5519], 18.0, 56, -20),
        ("03_tube_d21_to_igi", [77.0726, 28.5542], 17.5, 58, -30),
        ("04_igi_t3_terminal", [77.0867, 28.5565], 17.6, 58, -35),
        ("05_aerocity_worldmark", [77.1208, 28.5488], 17.8, 56, -25),
        ("06_south_portal_ramp", [77.1331, 28.5594], 17.5, 58, -30),
        ("07_dhaula_kuan_ridge", [77.1617, 28.5919], 17.5, 58, -32),
        ("08_north_portal_ramp", [77.1741, 28.6114], 17.5, 58, -30),
        ("09_shivaji_stadium_cp", [77.2113, 28.6289], 17.8, 56, -20),
        ("10_new_delhi_ndls_hub", [77.2231, 28.6425], 18.0, 56, -25)
    ]

    for name, center, zoom, pitch, bearing in shots:
        page.evaluate(f"""([lng, lat, z, p, b]) => {{
            const m = window.mapInstance || window.map;
            m.jumpTo({{ center: [lng, lat], zoom: z, pitch: p, bearing: b }});
        }}""", [center[0], center[1], zoom, pitch, bearing])
        time.sleep(2.5)
        path = f"verify_corridor_{name}.png"
        page.screenshot(path=path)
        print(f"Captured {path}")

    # Performance & debug checks
    debug_info = page.evaluate("() => window.MetroWebGLLayer.getDebugInfo()")
    print("Debug Info:", debug_info)
    print("Console Errors:", len(console_errors), console_errors)
    print("Page Errors:", len(page_errors), page_errors)

