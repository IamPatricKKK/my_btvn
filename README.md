# my_btvn — Kho lưu trữ BTVN

UI web tĩnh để sắp xếp và xem bài tập về nhà (markdown, ảnh, code, pdf).

Mỗi bài có: tên, đề, nội dung, ngày, người giao — **chỉnh sửa trực tiếp trên web** (nút ✏️ Sửa), lưu thẳng vào file.

## Dùng

1. Bỏ file bài tập vào thư mục `BT/` (có thể chia thư mục con làm danh mục, vd `BT/transaction/`).
2. Chạy `python3 serve.py` rồi vào http://localhost:8000/
3. Bấm vào thẻ bài để xem; nút **✏️ Sửa** để chỉnh tên/đề/ngày/người giao/nội dung → **Lưu** ghi vào file + `meta.json`.

> Chỉnh sửa cần chạy `serve.py` (server nội bộ). Xem online (GitHub Pages) chỉ đọc, không sửa.
> Metadata lưu ở `meta.json`; nội dung bài text lưu ngay trong file gốc.

## Cấu trúc

- `index.html`, `app.js`, `style.css` — giao diện (gallery + tìm kiếm + lọc danh mục + viewer).
- `gen.py` — quét `BT/` sinh manifest `homework.json`.
- `BT/` — chứa bài tập; thư mục con = danh mục.
- `assets/marked.min.js` — render markdown (vendored).

Loại file: `.md` render markdown, ảnh (`png/jpg/gif/webp`) xem trực tiếp, `.pdf` nhúng iframe, còn lại hiện dạng code.
