# my_btvn — Kho lưu trữ BTVN

UI web tĩnh để sắp xếp và xem bài tập về nhà (markdown, ảnh, code, pdf).

## Dùng

1. Bỏ file bài tập vào thư mục `BT/` (có thể chia thư mục con làm danh mục, vd `BT/transaction/`).
2. Chạy `python3 gen.py` để sinh lại `homework.json`.
3. Mở giao diện: `python3 -m http.server 8000` rồi vào http://localhost:8000/

## Cấu trúc

- `index.html`, `app.js`, `style.css` — giao diện (gallery + tìm kiếm + lọc danh mục + viewer).
- `gen.py` — quét `BT/` sinh manifest `homework.json`.
- `BT/` — chứa bài tập; thư mục con = danh mục.
- `assets/marked.min.js` — render markdown (vendored).

Loại file: `.md` render markdown, ảnh (`png/jpg/gif/webp`) xem trực tiếp, `.pdf` nhúng iframe, còn lại hiện dạng code.
