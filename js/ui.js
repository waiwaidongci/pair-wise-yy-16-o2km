/* ============================================================
   ui.js — shared rendering helpers
   ============================================================ */

const UI = {
  /** Card markup for a photo. Index is its position in the current result set. */
  cardHTML(p, index) {
    const num = String(index + 1).padStart(2, "0");
    return `<article class="card" data-id="${p.id}" data-index="${index}">
      <span class="num">${num}</span>
      <div class="ratio" style="aspect-ratio:${p.width} / ${p.height}">
        <img src="${p.file}" alt="${p.altText || p.title || ""}" loading="lazy" />
      </div>
      <div class="meta">
        <div class="t">${p.title || ""}</div>
        <div class="c">${p.caption || ""}</div>
      </div>
      <button class="drag-handle" data-drag="${p.id}" title="拖动调整顺序" aria-label="拖动调整顺序">⠿</button>
    </article>`;
  },

  /**
   * Render a grid of photos into container. Clicking a card opens the
   * lightbox scoped to exactly this result set (当前结果).
   */
  mountGrid(container, photos) {
    if (!container) return;
    container.innerHTML = photos.map((p, i) => this.cardHTML(p, i)).join("");
    container.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".drag-handle")) return; // dragging, don't open
        const idx = Number(card.dataset.index);
        Lightbox.open(photos, idx);
      });
    });
  },

  /** Enable drag-to-reorder within a series grid (offline editing). */
  enableReorder(container, seriesId, onChange) {
    let dragId = null;
    container.querySelectorAll(".card").forEach((card) => {
      card.setAttribute("draggable", "true");
      card.addEventListener("dragstart", (e) => {
        dragId = card.dataset.id;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        container.querySelectorAll(".card").forEach((c) => c.classList.remove("drop-target"));
      });
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        card.classList.add("drop-target");
      });
      card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const targetId = card.dataset.id;
        if (!dragId || dragId === targetId) return;
        const ids = Array.from(container.querySelectorAll(".card")).map((c) => c.dataset.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(targetId);
        ids.splice(from, 1);
        ids.splice(to, 0, dragId);
        Store.reorderSeries(seriesId, ids);
        if (onChange) onChange(ids);
      });
    });
  },
};

window.UI = UI;
