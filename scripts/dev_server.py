import http.server
import socketserver
import os

PORT = 8080
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT_DIR)

class DevHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        path = self.path.split('?')[0]
        if path.endswith(('.jpg', '.png', '.webp', '.woff2')):
            self.send_header('Cache-Control', 'public, max-age=3600')
        else:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    with ThreadingTCPServer(("", PORT), DevHandler) as httpd:
        print(f"Serving HTTP on 0.0.0.0:{PORT} from {ROOT_DIR} ...", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
