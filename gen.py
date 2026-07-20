#!/usr/bin/env python3
"""Quét thư mục BT/ -> homework.json cho UI kho lưu trữ BTVN.
Chạy: python3 gen.py   (chạy lại mỗi khi thêm/xoá bài)"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "BT")

TYPES = {
    "md": "markdown", "markdown": "markdown",
    "png": "image", "jpg": "image", "jpeg": "image", "gif": "image", "webp": "image",
    "pdf": "pdf",
}
# còn lại coi như code/text
IGNORE = {".DS_Store"}


def entry_type(ext):
    return TYPES.get(ext.lower(), "code")


def main():
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
            items.append({
                "title": f.rsplit(".", 1)[0] if "." in f else f,
                "path": rel,
                "type": entry_type(ext),
                "ext": ext.lower(),
                "category": cat,
                "mtime": int(os.path.getmtime(full)),
            })
    items.sort(key=lambda x: x["mtime"], reverse=True)
    out = os.path.join(ROOT, "homework.json")
    with open(out, "w", encoding="utf-8") as fp:
        json.dump(items, fp, ensure_ascii=False, indent=2)
    print(f"{len(items)} bài -> homework.json")


if __name__ == "__main__":
    main()
