import { init, getState, subscribe, moveSeries, setScope } from "../app/store.js";
import { photosOfSeries, seriesCover, selectedCount, categoryById } from "../app/selectors.js";
import { mountChrome } from "../ui/chrome.js";
import { mountPhotoGrid } from "../ui/photo-grid.js";
import { mountSyncPanel } from "../ui/sync-panel.js";

await init();
mountChrome("series");
mountSyncPanel(document.getElementById("sync-host"));

const gridHost = document.getElementById("series-grid");
const detailHost = document.getElementById("series-detail");

const params = new URLSearchParams(location.search);
if (params.get("sid")) {
  setScope({ seriesId: params.get("sid"), categoryId: null });
}

function renderSeriesGrid() {
  const { catalog } = getState();
  gridHost.innerHTML = catalog.series
    .map((s, i) => {
      const cover = seriesCover(catalog, s.id);
      const cat = categoryById(catalog, s.category);
      const ratio = cover ? (cover.height / cover.width) * 100 : 66;
      return `
      <article class="series-card" data-series-id="${s.id}">
        <a href="?sid=${s.id}" class="cover" style="padding-top:${ratio.toFixed(3)}%;display:block">
          ${cover ? `<img src="${cover.file}" alt="Cover: ${cover.altText || cover.title}" width="${cover.width}" height="${cover.height}">` : ""}
        </a>
        <div class="body">
          <span class="tag">${cat?.label ?? s.category}</span>
          <h3>${s.title} <span class="zh muted" style="font-size:.8rem;font-weight:400">${s.titleZh || ""}</span></h3>
          <p class="muted" style="font-size:.86rem;margin:0">${s.summary}</p>
          <p class="muted" style="font-size:.8rem;margin:.3rem 0 0">
            ${selectedCount(catalog, s.id)} selected · ${s.photoIds.length} photos ·
            cover: ${cover ? cover.title : "—"}
          </p>
          <div class="tools">
            <a class="btn btn--sm" href="works.html?sid=${s.id}">Open in Works</a>
            <button class="btn btn--ghost btn--sm" data-series-move="up" data-id="${s.id}" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="btn btn--ghost btn--sm" data-series-move="down" data-id="${s.id}" ${i === catalog.series.length - 1 ? "disabled" : ""}>↓</button>
          </div>
        </div>
      </article>`;
    })
    .join("");

  gridHost.querySelectorAll("[data-series-move]").forEach((b) =>
    b.addEventListener("click", () => moveSeries(b.dataset.id, b.dataset.seriesMove))
  );
}

function renderDetail() {
  const sid = new URLSearchParams(location.search).get("sid");
  if (!sid) {
    detailHost.hidden = true;
    detailHost.innerHTML = "";
    return;
  }
  const { catalog } = getState();
  const s = catalog.series.find((x) => x.id === sid);
  if (!s) {
    detailHost.hidden = true;
    return;
  }
  const list = photosOfSeries(catalog, s.id);
  detailHost.hidden = false;
  detailHost.innerHTML = `
    <a href="series.html" class="muted" style="font-size:.85rem">← All series</a>
    <h2 style="margin-top:.6rem">${s.title} <span class="zh muted" style="font-size:.7em;font-weight:400">${s.titleZh || ""}</span></h2>
    <p class="pull-quote">${s.summary}</p>
    <p class="muted" style="font-size:.88rem">Canonical order below is the lightbox order for this scope;
      selection edits and merges recompute it.</p>
    <div class="photo-grid" id="detail-grid"></div>`;
  mountPhotoGrid(detailHost.querySelector("#detail-grid"), list, { editable: true });
}

function render() {
  renderSeriesGrid();
  renderDetail();
}
subscribe(render);
render();
