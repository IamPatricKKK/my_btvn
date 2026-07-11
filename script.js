const btn = document.getElementById("btn");
const out = document.getElementById("out");
let n = 0;
btn.addEventListener("click", () => {
  out.textContent = `Đã bấm ${++n} lần`;
});
