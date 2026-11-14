import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 8093

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

    # Yashobhoomi
    page.evaluate("""() => {
        const m = window.mapInstance || window.map;
        m.jumpTo({ center: [77.0453, 28.5508], zoom: 17.5, pitch: 55, bearing: -20 });
    }""")
    time.sleep(2)
    page.screenshot(path="test_yasho_continuous.png")

    # IGI Airport
    page.evaluate("""() => {
        const m = window.mapInstance || window.map;
        m.jumpTo({ center: [77.0867, 28.5565], zoom: 17.5, pitch: 55, bearing: -20 });
    }""")
    time.sleep(2)
    page.screenshot(path="test_igi_continuous.png")
    print("Captured test_yasho_continuous.png and test_igi_continuous.png")

