/* series.js — 系列列表页 */

const SeriesPage = {
  async init() {
    if (!Store.state) await Store.init().catch(() => {});
    this.render();
    window.addEventListener("store:changed", () => this.render());
  },

  render() {
    const el = document.querySelector("[data-series-list]");
    if (!el) return;
    const series = Store.series("working");
    const photos = Store.photos("working");
    el.innerHTML = series
      .map((s) => {
        const coverId = Store.seriesCoverId(s.id, "working");
        const cover = photos.find((p) => p.id === coverId);
        const count = photos.filter((p) => p.seriesId === s.id).length;
        return `<a class="series-row" href="series-detail.html?id=${encodeURIComponent(s.id)}">
          <div class="cover"><img src="${cover ? cover.file : ""}" alt="${s.title}" loading="lazy" /></div>
          <div class="info">
            <div class="eyebrow">${s.category}</div>
            <h3>${s.title}</h3>
            <p>${s.summary}</p>
            <div class="meta-row"><span><b>${count}</b> 张</span><span>查看系列 →</span></div>
          </div>
        </a>`;
      })
      .join("");
  },
};

document.addEventListener("DOMContentLoaded", () => SeriesPage.init());
