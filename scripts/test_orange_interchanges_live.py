import http.server
import socketserver
import threading
import time
import json
from playwright.sync_api import sync_playwright

PORT = 8097

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

    interchanges = [
        ("dwarka21", [77.0585, 28.5519], 18.0, 56, -20),
        ("dhaula_kuan", [77.1617, 28.5919], 17.5, 58, -32),
        ("new_delhi", [77.2231, 28.6425], 18.0, 56, -25)
    ]

    for name, center, zoom, pitch, bearing in interchanges:
        page.evaluate(f"""([lng, lat, z, p, b]) => {{
            const m = window.mapInstance || window.map;
            m.jumpTo({{ center: [lng, lat], zoom: z, pitch: p, bearing: b }});
        }}""", [center[0], center[1], zoom, pitch, bearing])
        time.sleep(2.5)
        path = f"shot_interchange_{name}.png"
        page.screenshot(path=path)
        print(f"Captured {path}")
