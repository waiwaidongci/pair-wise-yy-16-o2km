/* home.js — 首页：共用照片数据 */

const Home = {
  async init() {
    if (!Store.state) await Store.init().catch(() => {});
    this.renderHero();
    this.renderFeatured();
    this.renderSeries();
    window.addEventListener("store:changed", () => {
      this.renderHero();
      this.renderFeatured();
      this.renderSeries();
    });
  },

  renderHero() {
    const frame = document.querySelector("[data-hero-frame]");
    if (!frame) return;
    const photos = Store.photos("working");
    // Pick a landscape for the hero.
    const hero = photos.find((p) => p.category === "landscape") || photos[0];
    if (!hero) return;
    frame.innerHTML = `
      <img src="${hero.file}" alt="${hero.altText || hero.title}" />
      <div class="tag">${hero.title} · ${hero.caption || ""}</div>`;
  },

  renderFeatured() {
    const el = document.querySelector("[data-home-featured]");
    if (!el) return;
    // One representative per series, then fill to 6.
    const photos = Store.photos("working");
    const series = Store.series("working");
    const picks = [];
    for (const s of series) {
      const cover = Store.seriesCoverId(s.id, "working");
      const p = photos.find((x) => x.id === cover);
      if (p) picks.push(p);
    }
    for (const p of photos) {
      if (picks.length >= 6) break;
      if (!picks.includes(p)) picks.push(p);
    }
    UI.mountGrid(el, picks.slice(0, 6));
  },

  renderSeries() {
    const el = document.querySelector("[data-home-series]");
    if (!el) return;
    const series = Store.series("working");
    const photos = Store.photos("working");
    el.innerHTML = series
      .map((s) => {
        const coverId = Store.seriesCoverId(s.id, "working");
        const cover = photos.find((p) => p.id === coverId);
        const count = photos.filter((p) => p.seriesId === s.id).length;
        return `<a class="series-row" href="series-detail.html?id=${s.id}">
          <div class="cover"><img src="${cover ? cover.file : ""}" alt="${s.title}" loading="lazy" /></div>
          <div class="info">
            <div class="eyebrow">${s.category}</div>
            <h3>${s.title}</h3>
            <p>${s.summary}</p>
            <div class="meta-row"><span><b>${count}</b> 张</span><span>系列 →</span></div>
          </div>
        </a>`;
      })
      .join("");
  },
};

document.addEventListener("DOMContentLoaded", () => Home.init());
