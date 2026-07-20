const grid = document.getElementById("grid");
const cats = document.getElementById("cats");
const search = document.getElementById("search");
const empty = document.getElementById("empty");
const viewer = document.getElementById("viewer");
const viewerBody = document.getElementById("viewer-body");

const ICON = { markdown: "📝", image: "🖼️", pdf: "📄", code: "💻" };
const TEXT_TYPES = new Set(["markdown", "code"]);
let items = [];
let activeCat = "Tất cả";

const esc = (s) =>
  (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

load();

async function load() {
  items = await fetch("homework.json").then((r) => (r.ok ? r.json() : [])).catch(() => []);
  empty.hidden = items.length > 0;
  renderCats();
  render();
}

function renderCats() {
  const list = ["Tất cả", ...new Set(items.map((i) => i.category))];
  cats.innerHTML = "";
  for (const c of list) {
    const b = document.createElement("button");
    b.textContent = c;
    b.className = c === activeCat ? "active" : "";
    b.onclick = () => { activeCat = c; renderCats(); render(); };
    cats.append(b);
  }
}

function render() {
  const q = search.value.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      (activeCat === "Tất cả" || i.category === activeCat) &&
      (i.title.toLowerCase().includes(q) || (i.de || "").toLowerCase().includes(q))
  );
  grid.innerHTML = "";
  for (const i of shown) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="ico">${ICON[i.type] || "📎"}</div>
      <h3>${esc(i.title)}</h3>
      ${i.de ? `<p class="de">${esc(i.de)}</p>` : ""}
      <div class="meta">
        <span>📅 ${esc(i.ngay)}</span>
        ${i.nguoi_giao ? `<span>👤 ${esc(i.nguoi_giao)}</span>` : ""}
      </div>
      <div class="meta"><span>${esc(i.category)}</span><span>.${esc(i.ext)}</span></div>`;
    card.onclick = () => open(i);
    grid.append(card);
  }
}

search.oninput = render;

async function open(item) {
  viewer.showModal();
  viewerBody.innerHTML = "Đang tải...";
  let content = "";
  if (TEXT_TYPES.has(item.type)) content = await fetch(item.path).then((r) => r.text());
  renderView(item, content);
}

function renderView(item, content) {
  const body =
    item.type === "image"
      ? `<img src="${item.path}" alt="${esc(item.title)}">`
      : item.type === "pdf"
      ? `<iframe src="${item.path}"></iframe>`
      : item.type === "markdown"
      ? `<div class="md">${marked.parse(content)}</div>`
      : `<pre></pre>`;

  viewerBody.innerHTML = `
    <div class="head">
      <h2>${esc(item.title)}</h2>
      <button class="edit-btn">✏️ Sửa</button>
    </div>
    <div class="info">
      ${item.de ? `<p><b>Đề:</b> ${esc(item.de)}</p>` : ""}
      <p><b>Ngày:</b> ${esc(item.ngay)} &nbsp; <b>Người giao:</b> ${esc(item.nguoi_giao) || "—"} &nbsp; <b>Danh mục:</b> ${esc(item.category)}</p>
    </div>
    ${body}`;
  if (item.type === "code") viewerBody.querySelector("pre").textContent = content; // an toàn
  viewerBody.querySelector(".edit-btn").onclick = () => renderEdit(item, content);
}

function renderEdit(item, content) {
  const canEditBody = TEXT_TYPES.has(item.type);
  viewerBody.innerHTML = `
    <h2>Sửa bài</h2>
    <label>Tên<input id="f-title" value="${esc(item.title)}"></label>
    <label>Đề<textarea id="f-de" rows="2">${esc(item.de)}</textarea></label>
    <label>Ngày<input id="f-ngay" type="date" value="${esc(item.ngay)}"></label>
    <label>Người giao<input id="f-nguoi" value="${esc(item.nguoi_giao)}"></label>
    ${canEditBody ? `<label>Nội dung<textarea id="f-content" rows="14">${esc(content)}</textarea></label>` : ""}
    <div class="actions">
      <button id="save">💾 Lưu</button>
      <button id="cancel" class="ghost">Huỷ</button>
    </div>
    <p id="msg"></p>`;

  viewerBody.querySelector("#cancel").onclick = () => renderView(item, content);
  viewerBody.querySelector("#save").onclick = async () => {
    const payload = {
      path: item.path,
      type: item.type,
      title: val("#f-title"),
      de: val("#f-de"),
      ngay: val("#f-ngay"),
      nguoi_giao: val("#f-nguoi"),
    };
    if (canEditBody) payload.content = val("#f-content");
    const msg = viewerBody.querySelector("#msg");
    msg.textContent = "Đang lưu...";
    try {
      const r = await fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "lỗi");
      await load(); // nạp lại danh sách
      viewer.close();
    } catch (e) {
      msg.textContent = "Lưu lỗi: " + e.message + " (đang chạy python3 serve.py chưa?)";
    }
  };
}

const val = (sel) => viewerBody.querySelector(sel).value;

document.getElementById("close").onclick = () => viewer.close();
viewer.onclick = (e) => { if (e.target === viewer) viewer.close(); };
