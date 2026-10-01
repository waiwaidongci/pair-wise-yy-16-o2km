import { init, getState, subscribe } from "../app/store.js";
import { photosOfSeries, seriesCover, resultSet } from "../app/selectors.js";
import { mountChrome } from "../ui/chrome.js";
import { mountPhotoGrid } from "../ui/photo-grid.js";

await init();
mountChrome("home");

const host = document.getElementById("home-featured");

function render() {
  const { catalog } = getState();
  const all = catalog.photos;
  const selected = all.filter((p) => p.selected);
  document.querySelector("[data-stat-photos]").textContent = all.length;
  document.querySelector("[data-stat-series]").textContent = catalog.series.length;
  document.querySelector("[data-stat-selected]").textContent = selected.length;

  host.innerHTML = catalog.series
    .map((s) => {
      const cover = seriesCover(catalog, s.id);
      const picks = photosOfSeries(catalog, s.id).filter((p) => p.selected).slice(0, 3);
      return `
        <div style="margin-bottom:2.4rem">
          <div style="display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
            <h3 style="font-size:1.4rem">${s.title}
              <span class="zh muted" style="font-size:.85rem;font-weight:400">${s.titleZh || ""}</span>
            </h3>
            <a href="series.html?sid=${s.id}" class="muted" style="font-size:.85rem">Series page →</a>
            <a href="works.html?sid=${s.id}" class="muted" style="font-size:.85rem">Open in lightbox scope →</a>
            <span class="tag" style="margin-left:auto">Cover: ${cover ? cover.title : "—"}</span>
          </div>
          <div class="photo-grid" data-series-grid="${s.id}"></div>
        </div>`;
    })
    .join("");

  // Render with the CURRENT result sets (per-series picks here), and the
  // lightbox walks only whichever grid the photo belongs to.
  for (const s of catalog.series) {
    const picks = photosOfSeries(catalog, s.id).filter((p) => p.selected).slice(0, 3);
    const node = host.querySelector(`[data-series-grid="${s.id}"]`);
    if (node) mountPhotoGrid(node, picks);
  }

  // resultSet is shared logic — touch it so home stays an honest consumer
  void resultSet(catalog, { selectedOnly: true });
}

subscribe(render);
render();
