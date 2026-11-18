"""Run with python server.py. Only the standard library is required."""
import base64
import json
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlsplit

PAGE = Path(__file__).with_name("index.html").read_bytes()
rooms = dict.fromkeys(("Runners", "Music", "Announcements"), 0)
messages = deque()
lock = Lock()


class Radio(BaseHTTPRequestHandler):
    def reply(self, value, status=200, mime="application/json"):
        body = value if isinstance(value, bytes) else json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path)
        params = parse_qs(path.query)
        if path.path == "/":
            return self.reply(PAGE, mime="text/html; charset=utf-8")
        with lock:
            if path.path == "/channels":
                result = rooms.copy()
            elif path.path == "/listen":
                try:
                    after = int(params["after"][0])
                    room = params["room"][0]
                except (ValueError, KeyError):
                    return self.reply("Invalid channel request", 400)
                result = [msg for stamp, name, msg in messages
                          if name == room and msg["id"] > after
                          and stamp > time.monotonic() - 45][:3]
            else:
                return self.reply("Unknown path", 404)
        self.reply(result)

    def do_POST(self):
        path = urlsplit(self.path)
        params = parse_qs(path.query)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= (160 if path.path == "/channels" else 5000000):
                raise ValueError()
            body = self.rfile.read(size)
            with lock:
                if path.path == "/channels":
                    name = body.decode().strip()
                    if not 1 <= len(name) <= 40 or (name not in rooms and len(rooms) >= 64):
                        raise ValueError()
                    rooms.setdefault(name, 0)
                elif path.path == "/talk":
                    name = params["room"][0]
                    rate = int(params["rate"][0])
                    client = params["client"][0]
                    if name not in rooms or not 8000 <= rate <= 192000 or size % 2 or size > rate * 26:
                        raise ValueError()
                    rooms[name] += 1
                    now = time.monotonic()
                    while messages and (messages[0][0] < now - 45 or len(messages) >= 32):
                        messages.popleft()
                    messages.append((now, name, dict(id=rooms[name], rate=rate,
                                    client=client[:80], audio=base64.b64encode(body).decode())))
                else:
                    return self.reply("Unknown path", 404)
        except (ValueError, KeyError):
            return self.reply("Invalid request", 400)
        self.reply({"ok": True})


if __name__ == "__main__":
    print("RunE Talkie listening on port 8000", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8000), Radio).serve_forever()
