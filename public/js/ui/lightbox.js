/**
 * lightbox.js — walks ONLY the list it is opened with.
 * Every page computes its current result set via selectors.resultSet and
 * hands that array here, so after filtering to a series (and after a merge
 * recompute) prev/next never leave the current scope.
 */
let photos = [];
let index = 0;
let root = null;

function el() {
  if (root) return root;
  root = document.createElement("div");
  root.className = "lightbox";
  root.hidden = true;
  root.innerHTML = `
    <div class="lightbox__stage">
      <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous photo">‹</button>
      <img class="lightbox__img" alt="">
      <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next photo">›</button>
    </div>
    <div class="lightbox__bar">
      <span class="lightbox__counter"></span>
      <strong class="lightbox__title"></strong>
      <span class="caption"></span>
      <button class="btn btn--ghost btn--sm lightbox__close" type="button">Close ✕</button>
    </div>`;
  document.body.appendChild(root);

  root.querySelector(".lightbox__nav--prev").addEventListener("click", () => move(-1));
  root.querySelector(".lightbox__nav--next").addEventListener("click", () => move(1));
  root.querySelector(".lightbox__close").addEventListener("click", close);
  root.addEventListener("click", (e) => {
    if (e.target === root || e.target.classList.contains("lightbox__stage")) close();
  });
  return root;
}

function move(step) {
  if (!photos.length) return;
  index = (index + step + photos.length) % photos.length;
  render();
}

function onKey(e) {
  if (el().hidden) return;
  if (e.key === "Escape") close();
  if (e.key === "ArrowLeft") move(-1);
  if (e.key === "ArrowRight") move(1);
}

function render() {
  const box = el();
  const p = photos[index];
  if (!p) return;
  const img = box.querySelector(".lightbox__img");
  img.src = p.file;
  img.alt = p.altText || p.title;
  box.querySelector(".lightbox__counter").textContent = `${index + 1} / ${photos.length} · in current result set`;
  box.querySelector(".lightbox__title").textContent = p.title;
  box.querySelector(".caption").textContent = p.caption;
}

export function open(list, startId) {
  photos = list.slice();
  index = Math.max(0, photos.findIndex((p) => p.id === startId));
  render();
  el().hidden = false;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKey);
}

export function close() {
  el().hidden = true;
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onKey);
}
