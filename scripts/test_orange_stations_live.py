import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 8098

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

    page.on("console", lambda msg: print(f"[Browser Console {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[Browser PageError] {err}"))

    page.goto(f"http://localhost:{PORT}", wait_until="networkidle", timeout=30000)
    page.wait_for_function("() => window.MetroWebGLLayer && window.MetroWebGLLayer.getDebugInfo && window.MetroWebGLLayer.getDebugInfo().isReady === true", timeout=20000)
    time.sleep(2)

    page.click("#btn-line-orange")
    time.sleep(1)

    stations = [
        ("yashobhoomi", [77.0453, 28.5508], 17.8, 56, -20),
        ("igi_airport", [77.0867, 28.5565], 17.6, 58, -35),
        ("aerocity", [77.1208, 28.5488], 17.8, 56, -25),
        ("shivaji_stadium", [77.2113, 28.6289], 17.8, 56, -20)
    ]

    for name, center, zoom, pitch, bearing in stations:
        page.evaluate(f"""([lng, lat, z, p, b]) => {{
            const m = window.mapInstance || window.map;
            m.jumpTo({{ center: [lng, lat], zoom: z, pitch: p, bearing: b }});
        }}""", [center[0], center[1], zoom, pitch, bearing])
        time.sleep(2.5)
        path = f"shot_station_{name}.png"
        page.screenshot(path=path)
        print(f"Captured {path}")

