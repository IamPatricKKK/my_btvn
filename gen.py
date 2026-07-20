#!/usr/bin/env python3
"""Quét BT/ + gộp meta.json -> homework.json cho UI kho lưu trữ BTVN.
Chạy: python3 gen.py   (serve.py tự gọi lại sau mỗi lần lưu)."""
import json, os, time

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "BT")
META_FILE = os.path.join(ROOT, "meta.json")

TYPES = {
    "md": "markdown", "markdown": "markdown",
    "png": "image", "jpg": "image", "jpeg": "image", "gif": "image", "webp": "image",
    "pdf": "pdf",
}
IGNORE = {".DS_Store"}


def entry_type(ext):
    return TYPES.get(ext.lower(), "code")


def load_meta():
    if os.path.exists(META_FILE):
        with open(META_FILE, encoding="utf-8") as fp:
            return json.load(fp)
    return {}


def main():
    meta = load_meta()
    items = []
    for dirpath, _, files in os.walk(SRC):
        for f in files:
            if f in IGNORE or f.startswith("."):
                continue
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            ext = f.rsplit(".", 1)[-1] if "." in f else ""
            cat = os.path.relpath(dirpath, SRC).replace(os.sep, "/")
            cat = "chung" if cat == "." else cat
            m = meta.get(rel, {})
            items.append({
                "title": m.get("title") or (f.rsplit(".", 1)[0] if "." in f else f),
                "path": rel,
                "type": entry_type(ext),
                "ext": ext.lower(),
                "category": cat,
                "de": m.get("de", ""),
                "ngay": m.get("ngay") or time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(full))),
                "nguoi_giao": m.get("nguoi_giao", ""),
                "mtime": int(os.path.getmtime(full)),
            })
    items.sort(key=lambda x: (x["ngay"], x["mtime"]), reverse=True)
    with open(os.path.join(ROOT, "homework.json"), "w", encoding="utf-8") as fp:
        json.dump(items, fp, ensure_ascii=False, indent=2)
    print(f"{len(items)} bài -> homework.json")


if __name__ == "__main__":
    main()
