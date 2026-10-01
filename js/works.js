/* works.js — 作品页：筛选、返回保留范围、灯箱只走当前结果、离线改片 */

const Works = {
  filter: { cat: "all", series: "all" },

  async init() {
    if (!Store.state) await Store.init().catch(() => {});
    this.restoreFilter();
    this.renderFilters();
    this.render();
    this.bindEdit();
    window.addEventListener("store:changed", () => this.render());
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) {
        this.restoreFilter();
        this.renderFilters();
        this.render();
      }
    });
  },

  restoreFilter() {
    try {
      const saved = sessionStorage.getItem("works-filter");
      if (saved) this.filter = JSON.parse(saved);
    } catch (e) {}
  },

  saveFilter() {
    sessionStorage.setItem("works-filter", JSON.stringify(this.filter));
  },

  /** Current result set (当前结果) — the lightbox walks exactly these. */
  resultSet() {
    const photos = Store.photos("working");
    return photos
      .filter((p) => (this.filter.cat === "all" ? true : p.category === this.filter.cat))
      .filter((p) => (this.filter.series === "all" ? true : p.seriesId === this.filter.series))
      .sort((a, b) => a.order - b.order);
  },

  renderFilters() {
    const catEl = document.querySelector("[data-filter-cat]");
    const seriesEl = document.querySelector("[data-filter-series]");
    const cats = [{ id: "all", label: "全部" }, ...Store.state ? [] : []];
    const catList = [{ id: "all", label: "全部" }, { id: "portrait", label: "肖像" }, { id: "landscape", label: "风光" }, { id: "pastoral", label: "牧野" }];
    const seriesList = [{ id: "all", label: "全部系列" }, ...Store.series("working").map((s) => ({ id: s.id, label: s.title }))];

    if (catEl) {
      catEl.innerHTML = catList
        .map((c) => `<button class="chip ${this.filter.cat === c.id ? "active" : ""}" data-cat="${c.id}">${c.label}</button>`)
        .join("");
      catEl.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.filter.cat = btn.dataset.cat;
          this.saveFilter();
          this.renderFilters();
          this.render();
        });
      });
    }
    if (seriesEl) {
      seriesEl.innerHTML = seriesList
        .map((s) => `<button class="chip ${this.filter.series === s.id ? "active" : ""}" data-series="${s.id}">${s.label}</button>`)
        .join("");
      seriesEl.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.filter.series = btn.dataset.series;
          this.saveFilter();
          this.renderFilters();
          this.render();
        });
      });
    }
  },

  render() {
    const el = document.querySelector("[data-works-grid]");
    const note = document.querySelector("[data-range-note]");
    const photos = this.resultSet();
    UI.mountGrid(el, photos);

    if (note) {
      const parts = [];
      if (this.filter.cat !== "all") parts.push("分类");
      if (this.filter.series !== "all") parts.push("系列");
      if (parts.length) {
        const s = Store.seriesById(this.filter.series, "working");
        const label = this.filter.series !== "all" ? `系列「${s ? s.title : ""}」` : "";
        const catLabel = this.filter.cat !== "all" ? `分类「${this.filter.cat}」` : "";
        note.style.display = "flex";
        note.innerHTML = `当前范围：${catLabel}${catLabel && label ? " · " : ""}${label} · 共 ${photos.length} 张 <button class="clear" data-clear-range>清除筛选</button>`;
        note.querySelector("[data-clear-range]").addEventListener("click", () => {
          this.filter = { cat: "all", series: "all" };
          this.saveFilter();
          this.renderFilters();
          this.render();
        });
      } else {
        note.style.display = "none";
      }
    }

    // Offline editing affordances.
    const singleSeries = this.filter.series !== "all";
    document.body.classList.toggle("works-single-series", singleSeries);
    if (document.body.classList.contains("is-offline")) {
      this.enableInlineEdits(el, photos);
      if (singleSeries) {
        UI.enableReorder(el, this.filter.series, () => this.render());
      }
    }
  },

  enableInlineEdits(container, photos) {
    container.querySelectorAll(".card").forEach((card) => {
      const id = card.dataset.id;
      const p = photos.find((x) => x.id === id);
      const titleEl = card.querySelector(".meta .t");
      if (!titleEl || !p) return;
      titleEl.setAttribute("contenteditable", "true");
      titleEl.spellcheck = false;
      titleEl.addEventListener("click", (e) => e.stopPropagation());
      titleEl.addEventListener("blur", () => {
        const text = titleEl.textContent.trim();
        if (text && text !== p.title) {
          Store.editPhoto(id, { title: text });
          App.toast("标题已保存到本地草稿", "ok");
        }
      });
      titleEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          titleEl.blur();
        }
      });
    });
  },

  bindEdit() {
    const bar = document.querySelector("[data-edit-bar]");
    if (!bar) return;
    const update = () => {
      const offline = document.body.classList.contains("is-offline");
      bar.classList.toggle("show", offline);
      const single = this.filter.series !== "all";
      const hint = bar.querySelector("[data-edit-hint]");
      if (hint) {
        hint.textContent = single
          ? "离线模式：可拖动卡片调整顺序，点击标题可改名，改动保存在本地草稿。"
          : "离线模式：选择一个系列后可拖动排序；点击卡片标题可改名。";
      }
    };
    update();
    new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  },
};

document.addEventListener("DOMContentLoaded", () => Works.init());
