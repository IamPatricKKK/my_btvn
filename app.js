const grid = document.getElementById("grid");
const cats = document.getElementById("cats");
const search = document.getElementById("search");
const empty = document.getElementById("empty");
const viewer = document.getElementById("viewer");
const viewerBody = document.getElementById("viewer-body");

const ICON = { markdown: "📝", image: "🖼️", pdf: "📄", code: "💻" };
let items = [];
let activeCat = "Tất cả";

fetch("homework.json")
  .then((r) => (r.ok ? r.json() : []))
  .then((data) => {
    items = data;
    empty.hidden = items.length > 0;
    renderCats();
    render();
  })
  .catch(() => (empty.hidden = false));

function renderCats() {
  const list = ["Tất cả", ...new Set(items.map((i) => i.category))];
  cats.innerHTML = "";
  for (const c of list) {
    const b = document.createElement("button");
    b.textContent = c;
    b.className = c === activeCat ? "active" : "";
    b.onclick = () => {
      activeCat = c;
      renderCats();
      render();
    };
    cats.append(b);
  }
}

function render() {
  const q = search.value.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      (activeCat === "Tất cả" || i.category === activeCat) &&
      i.title.toLowerCase().includes(q)
  );
  grid.innerHTML = "";
  for (const i of shown) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="ico">${ICON[i.type] || "📎"}</div>
      <h3>${i.title}</h3>
      <div class="meta"><span>${i.category}</span><span>.${i.ext}</span></div>`;
    card.onclick = () => open(i);
    grid.append(card);
  }
}

search.oninput = render;

async function open(item) {
  viewerBody.innerHTML = "Đang tải...";
  viewer.showModal();
  if (item.type === "image") {
    viewerBody.innerHTML = `<img src="${item.path}" alt="${item.title}">`;
  } else if (item.type === "pdf") {
    viewerBody.innerHTML = `<iframe src="${item.path}"></iframe>`;
  } else {
    const text = await fetch(item.path).then((r) => r.text());
    if (item.type === "markdown") {
      viewerBody.innerHTML = `<div class="md">${marked.parse(text)}</div>`;
    } else {
      const pre = document.createElement("pre");
      pre.textContent = text; // textContent -> tự escape, an toàn
      viewerBody.innerHTML = "";
      viewerBody.append(pre);
    }
  }
}

document.getElementById("close").onclick = () => viewer.close();
viewer.onclick = (e) => {
  if (e.target === viewer) viewer.close(); // click nền để đóng
};
