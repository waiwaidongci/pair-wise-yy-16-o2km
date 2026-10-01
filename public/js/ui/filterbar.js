/**
 * filterbar.js — chips bound to the shared scope in the store.
 * The scope persists in localStorage, so filtering into a series and then
 * navigating to Works/Series/Home and back keeps the same range.
 */
import { getState, setScope, clearScope } from "../app/store.js";

export function mountFilterBar(container, { onChange } = {}) {
  const render = () => {
    const { catalog, scope } = getState();
    container.innerHTML = `
      <button class="chip" data-scope="all" aria-pressed="${!scope.categoryId && !scope.seriesId}">All</button>
      ${catalog.categories
        .map(
          (c) =>
            `<button class="chip" data-category="${c.id}" aria-pressed="${scope.categoryId === c.id && !scope.seriesId}">
              ${c.label}
            </button>`
        )
        .join("")}
      <span class="mover" style="width:1px;height:1.2rem;background:var(--line)"></span>
      ${catalog.series
        .map(
          (s) =>
            `<button class="chip" data-series="${s.id}" aria-pressed="${scope.seriesId === s.id}">
              ${s.title}
            </button>`
        )
        .join("")}
      <span class="spacer"></span>
      <label class="switch-label">
        <input type="checkbox" data-selected-only ${scope.selectedOnly ? "checked" : ""}>
        Selected only
      </label>
      <button class="chip" data-clear-scope ${scope.categoryId || scope.seriesId || scope.selectedOnly ? "" : "disabled"}>
        Clear ✕
      </button>`;

    container.querySelectorAll("[data-category]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.category;
        setScope({
          categoryId: getState().scope.categoryId === id ? null : id,
          seriesId: null,
        });
        onChange?.();
      })
    );
    container.querySelectorAll("[data-series]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.series;
        const s = catalog.series.find((x) => x.id === id);
        setScope({
          seriesId: getState().scope.seriesId === id ? null : id,
          categoryId: s ? s.category : null,
        });
        onChange?.();
      })
    );
    container.querySelector("[data-scope=all]").addEventListener("click", () => {
      clearScope();
      onChange?.();
    });
    container.querySelector("[data-clear-scope]").addEventListener("click", () => {
      clearScope();
      onChange?.();
    });
    container.querySelector("[data-selected-only]").addEventListener("change", (e) => {
      setScope({ selectedOnly: e.target.checked });
      onChange?.();
    });
  };
  render();
  return render;
}
