/* ============================================================
   lightbox.js — full-screen viewer scoped to a given result set.
   Prev/next only walk the photos passed in (当前结果).
   ============================================================ */

const Lightbox = {
  el: null,
  photos: [],
  index: 0,

  init() {
    if (this.el) return;
    this.el = document.createElement("div");
    this.el.className = "lightbox";
    this.el.innerHTML = `
      <button class="lb-btn lb-close" aria-label="关闭">×</button>
      <button class="lb-btn lb-prev" aria-label="上一张">‹</button>
      <div class="stage">
        <img alt="" />
        <div class="cap">
          <div class="t"></div>
          <div class="c"></div>
          <div class="cnt"></div>
        </div>
      </div>
      <button class="lb-btn lb-next" aria-label="下一张">›</button>`;
    document.body.appendChild(this.el);

    this.img = this.el.querySelector("img");
    this.capT = this.el.querySelector(".cap .t");
    this.capC = this.el.querySelector(".cap .c");
    this.capCnt = this.el.querySelector(".cap .cnt");

    this.el.querySelector(".lb-close").addEventListener("click", () => this.close());
    this.el.querySelector(".lb-prev").addEventListener("click", () => this.prev());
    this.el.querySelector(".lb-next").addEventListener("click", () => this.next());
    this.el.addEventListener("click", (e) => {
      if (e.target === this.el) this.close();
    });
    document.addEventListener("keydown", (e) => {
      if (!this.el.classList.contains("open")) return;
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowLeft") this.prev();
      if (e.key === "ArrowRight") this.next();
    });
  },

  /** Open with a result set (array of photo objects) and starting index. */
  open(photos, index = 0) {
    this.init();
    this.photos = photos;
    this.index = index;
    this.render();
    this.el.classList.add("open");
    document.body.style.overflow = "hidden";
  },

  close() {
    this.el.classList.remove("open");
    document.body.style.overflow = "";
  },

  prev() {
    if (!this.photos.length) return;
    this.index = (this.index - 1 + this.photos.length) % this.photos.length;
    this.render();
  },

  next() {
    if (!this.photos.length) return;
    this.index = (this.index + 1) % this.photos.length;
    this.render();
  },

  render() {
    const p = this.photos[this.index];
    if (!p) return;
    this.img.src = p.file;
    this.img.alt = p.altText || p.title || "";
    // Preserve intrinsic aspect ratio to avoid layout shift.
    this.img.style.aspectRatio = `${p.width} / ${p.height}`;
    this.capT.textContent = p.title || "";
    this.capC.textContent = p.caption || "";
    this.capCnt.textContent = `${this.index + 1} / ${this.photos.length}`;
  },
};

window.Lightbox = Lightbox;
