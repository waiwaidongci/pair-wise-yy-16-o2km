/* about.js — 关于页：共用照片数据 */

const About = {
  async init() {
    if (!Store.state) await Store.init().catch(() => {});
    this.renderPortrait();
    window.addEventListener("store:changed", () => this.renderPortrait());
  },

  renderPortrait() {
    const el = document.querySelector("[data-about-portrait]");
    if (!el) return;
    const photos = Store.photos("working");
    const portrait = photos.find((p) => p.category === "portrait") || photos[0];
    if (!portrait) return;
    el.innerHTML = `<img src="${portrait.file}" alt="${portrait.altText || "摄影师肖像"}" />`;
  },
};

document.addEventListener("DOMContentLoaded", () => About.init());
