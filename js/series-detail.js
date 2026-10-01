/* series-detail.js — 系列详情页：灯箱只走本系列结果 */

const SeriesDetail = {
  seriesId: null,

  async init() {
    if (!Store.state) await Store.init().catch(() => {});
    const params = new URLSearchParams(location.search);
    this.seriesId = params.get("id");
    if (!this.seriesId || !Store.seriesById(this.seriesId, "working")) {
      document.querySelector("[data-series-detail]").innerHTML =
        "<p>找不到该系列。</p>";
      return;
    }
    this.render();
    window.addEventListener("store:changed", () => this.render());
  },

  photosInSeries() {
    return Store.photos("working")
      .filter((p) => p.seriesId === this.seriesId)
      .sort((a, b) => a.order - b.order);
  },

  render() {
    const s = Store.seriesById(this.seriesId, "working");
    const photos = this.photosInSeries();
    const wrap = document.querySelector("[data-series-detail]");
    if (!s || !wrap) return;

    wrap.innerHTML = `
      <div class="series-hero">
        <a class="back" href="series.html">← 返回系列列表</a>
        <p class="eyebrow" style="margin-top:18px">${s.category}</p>
        <h1 class="title">${s.title}</h1>
        <p class="pull">“光落在恰好的位置，其余交给阴影。”</p>
        <p class="summary">${s.summary}</p>
        <div class="stats">
          <div class="stat">张数<b>${photos.length}</b></div>
          <div class="stat">封面<b>${photos[0] ? photos[0].title : "—"}</b></div>
          <div class="stat">排序<b>按基线重算</b></div>
        </div>
      </div>
      <div class="grid two" data-series-grid></div>`;

    const grid = wrap.querySelector("[data-series-grid]");
    UI.mountGrid(grid, photos);

    if (document.body.classList.contains("is-offline")) {
      grid.insertAdjacentHTML(
        "beforebegin",
        `<div class="edit-bar show"><span class="lbl">离线改片</span>
         <span class="sp">·</span><span>可拖动调整系列顺序，改动保存在本地草稿。</span></div>`
      );
      UI.enableReorder(grid, this.seriesId, () => this.render());
    }
  },
};

document.addEventListener("DOMContentLoaded", () => SeriesDetail.init());
