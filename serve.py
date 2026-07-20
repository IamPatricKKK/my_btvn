#!/usr/bin/env python3
"""Server nội bộ: serve trang tĩnh + nhận POST /save để ghi metadata (và nội dung
text) vào file, rồi sinh lại homework.json.
Chạy: python3 serve.py   -> http://localhost:8000/"""
import json, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import gen

ROOT = os.path.dirname(os.path.abspath(__file__))
META_FILE = os.path.join(ROOT, "meta.json")
TEXT_TYPES = {"markdown", "code"}


def load_meta():
    if os.path.exists(META_FILE):
        with open(META_FILE, encoding="utf-8") as fp:
            return json.load(fp)
    return {}


def safe_abs(rel):
    """Chặn path traversal: chỉ cho ghi trong BT/."""
    ap = os.path.realpath(os.path.join(ROOT, rel))
    bt = os.path.realpath(os.path.join(ROOT, "BT"))
    if ap != bt and not ap.startswith(bt + os.sep):
        raise ValueError("path ngoài BT/")
    return ap


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/save":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
            rel = data["path"]
            ap = safe_abs(rel)
            if not os.path.isfile(ap):
                raise ValueError("file không tồn tại")

            # metadata
            meta = load_meta()
            meta[rel] = {
                "title": data.get("title", ""),
                "de": data.get("de", ""),
                "ngay": data.get("ngay", ""),
                "nguoi_giao": data.get("nguoi_giao", ""),
            }
            with open(META_FILE, "w", encoding="utf-8") as fp:
                json.dump(meta, fp, ensure_ascii=False, indent=2)

            # nội dung (chỉ file text)
            if "content" in data and data.get("type") in TEXT_TYPES:
                with open(ap, "w", encoding="utf-8") as fp:
                    fp.write(data["content"])

            gen.main()  # sinh lại homework.json
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # luôn nạp bản mới
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    print("http://localhost:8000/  (Ctrl+C để dừng)")
    ThreadingHTTPServer(("", 8000), Handler).serve_forever()
