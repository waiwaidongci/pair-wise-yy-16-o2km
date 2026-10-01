import { init, getState, subscribe, setScope } from "../app/store.js";
import { resultSet, categoryById, seriesById } from "../app/selectors.js";
import { mountChrome } from "../ui/chrome.js";
import { mountFilterBar } from "../ui/filterbar.js";
import { mountPhotoGrid, describeScope } from "../ui/photo-grid.js";

await init();
mountChrome("works");

// Deep links such as works.html?sid=gaze adopt the scope once, then the
// persisted scope governs navigation (back from a series keeps the range).
const params = new URLSearchParams(location.search);
if (params.has("sid") || params.has("cat")) {
  const { catalog } = getState();
  const sid = params.get("sid");
  const cat = params.get("cat");
  if (sid && catalog.series.some((s) => s.id === sid)) {
    setScope({ seriesId: sid, categoryId: seriesById(catalog, sid)?.category ?? null });
  } else if (cat && catalog.categories.some((c) => c.id === cat)) {
    setScope({ categoryId: cat, seriesId: null });
  }
  history.replaceState(null, "", location.pathname);
}

let editMode = false;
document.getElementById("edit-mode").addEventListener("change", (e) => {
  editMode = e.target.checked;
  render();
});

const fbHost = document.getElementById("filterbar");
const rerenderFilter = mountFilterBar(fbHost, { onChange: render });
const gridHost = document.getElementById("photo-grid");

function render() {
  rerenderFilter();
  const { catalog, scope } = getState();
  const list = resultSet(catalog, scope);

  document.querySelector("[data-result-title]").textContent = describeScope(scope);
  document.querySelector("[data-result-count]").textContent =
    `${list.length} photo${list.length === 1 ? "" : "s"} in the current result set`;
  document.getElementById("empty").hidden = list.length > 0;

  // Scope banner explains the retained range + how to leave it.
  const banner = document.getElementById("scope-banner");
  if (scope.seriesId || scope.categoryId || scope.selectedOnly) {
    const sName = scope.seriesId ? seriesById(catalog, scope.seriesId)?.title : null;
    const cName = !sName && scope.categoryId ? categoryById(catalog, scope.categoryId)?.label : null;
    banner.innerHTML = `
      <div class="wrap" style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap;width:100%">
        <span>Showing: <strong>${sName || cName || "All works"}</strong>
          ${scope.selectedOnly ? " · selected only" : ""}
          — this range is kept when you navigate away and back.</span>
      </div>`;
  } else {
    banner.innerHTML = "";
  }

  mountPhotoGrid(gridHost, list, { editable: editMode });
}

subscribe(render);
render();
