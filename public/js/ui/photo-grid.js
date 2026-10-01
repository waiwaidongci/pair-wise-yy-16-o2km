/**
 * photo-grid.js — renders photo cards from the shared catalog.
 * Aspect-ratio boxes use each photo's real width/height (intrinsic ratio),
 * so the grid never jumps when the JPEG decodes.
 */
import { getState, toggleSelect, movePhoto } from "../app/store.js";
import { categoryById, seriesById } from "../app/selectors.js";
import { open } from "./lightbox.js";

export function photoCardHtml(p, { editable = false } = {}) {
  const ratio = (p.height / p.width) * 100;
  const cat = categoryById(getState().catalog, p.category);
  return `
  <article class="photo-card ${p.selected ? "" : "is-dropped"}" data-photo-id="${p.id}">
    <div class="frame" data-open="${p.id}" style="padding-top:${ratio.toFixed(3)}%" role="button" tabindex="0"
         aria-label="Open ${p.title} in lightbox">
      <img src="${p.file}" alt="${p.altText || p.title}" width="${p.width}" height="${p.height}" loading="lazy">
      <span class="order-badge">#${p.order}</span>
    </div>
    <div class="body">
      <span class="tag">${cat?.label ?? p.category}</span>
      <span class="title">${p.title} <span class="zh muted" style="font-size:.8rem">${p.titleZh || ""}</span></span>
      <span class="caption">${p.caption}</span>
      ${
        editable
          ? `<div class="tools">
              <button class="btn btn--sm ${p.selected ? "btn--danger" : "btn--accent"}" data-toggle="${p.id}" type="button">
                ${p.selected ? "Drop" : "Re-select"}
              </button>
              <button class="btn btn--ghost btn--sm" data-move="up" data-id="${p.id}" type="button">↑ Earlier</button>
              <button class="btn btn--ghost btn--sm" data-move="down" data-id="${p.id}" type="button">↓ Later</button>
              <span class="tag ${p.selected ? "" : "is-out"}">${p.selected ? "Selected" : "Dropped"}</span>
            </div>`
          : `<div class="tools"><span class="tag ${p.selected ? "" : "is-out"}">${p.selected ? "Selected" : "Dropped"}</span></div>`
      }
    </div>
  </article>`;
}

export function mountPhotoGrid(container, list, { editable = false } = {}) {
  container.innerHTML = list.map((p) => photoCardHtml(p, { editable })).join("");
  // Delegated listeners are bound ONCE per container; re-rendering only swaps
  // innerHTML, so repeated store updates never stack duplicate handlers.
  if (!container.__gridBound) {
    container.__gridBound = true;

    container.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-toggle]");
      const moveBtn = e.target.closest("[data-move]");
      if (toggle) {
        toggleSelect(toggle.dataset.toggle);
        return;
      }
      if (moveBtn) {
        movePhoto(moveBtn.dataset.id, moveBtn.dataset.move);
        return;
      }
      const frame = e.target.closest("[data-open]");
      if (frame) {
        // Lightbox walks exactly the list currently rendered ("只走当前结果").
        open(container.__gridList || [], frame.dataset.open);
      }
    });
    container.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const frame = e.target.closest?.("[data-open]");
      if (frame) {
        e.preventDefault();
        open(container.__gridList || [], frame.dataset.open);
      }
    });
  }
  container.__gridList = list;
}

/** Small series summary used in the scope banner etc. */
export function describeScope(scope) {
  const { catalog } = getState();
  if (scope.seriesId) {
    const s = seriesById(catalog, scope.seriesId);
    return s ? `Series filter: ${s.title}` : "Series";
  }
  if (scope.categoryId) {
    const c = categoryById(catalog, scope.categoryId);
    return c ? `Category filter: ${c.label}` : "Category";
  }
  return "All works";
}
