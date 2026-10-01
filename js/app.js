/* ============================================================
   app.js — shared shell: nav, online/offline, toast, Sync Center
   ============================================================ */

const App = {
  online: true,
  syncOpen: false,
  mergeResult: null,   // last computed merge { mergedPhotos, conflicts, clean }
  resolutions: {},     // { [id]: 'local' | 'remote' }
  simulateFailure: false,

  async init() {
    if (this._initialized) return;
    this._initialized = true;
    try {
      await Store.init();
    } catch (e) {
      console.error(e);
    }
    this.online = navigator.onLine !== false;
    this.renderNav();
    this.bindNet();
    this.bindMenu();
    this.registerSW();
    this.bindSyncModal();
    this.renderSync();
    window.addEventListener("store:changed", () => this.renderNav());
  },

  bindMenu() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const nav = document.querySelector("[data-nav]");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  },

  /* ---------- nav ---------- */
  renderNav() {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return;
    const page = document.body.dataset.page || "";
    const links = [
      { href: "index.html", label: "首页", key: "home" },
      { href: "works.html", label: "作品", key: "works" },
      { href: "series.html", label: "系列", key: "series" },
      { href: "about.html", label: "关于", key: "about" },
      { href: "contact.html", label: "联系", key: "contact" },
    ];
    nav.innerHTML = links
      .map(
        (l) =>
          `<a href="${l.href}" class="${page === l.key ? "active" : ""}">${l.label}</a>`
      )
      .join("");

    const syncBtn = document.querySelector("[data-sync-btn]");
    if (syncBtn) {
      const dirty = Store.dirtyPhotoCount();
      syncBtn.classList.toggle("has-changes", dirty > 0);
      syncBtn.innerHTML =
        (this.online ? "同步中心" : "离线草稿") +
        (dirty > 0 ? `<span class="badge">${dirty}</span>` : "");
    }
  },

  /* ---------- online / offline ---------- */
  bindNet() {
    const pill = document.querySelector("[data-net]");
    const apply = () => {
      if (pill) {
        pill.classList.toggle("online", this.online);
        pill.classList.toggle("offline", !this.online);
        pill.innerHTML = `<span class="dot"></span>${this.online ? "在线" : "离线"}`;
        pill.title = this.online ? "当前在线，可同步底稿" : "当前离线，改动保存在本地草稿";
      }
      document.body.classList.toggle("is-offline", !this.online);
      document.body.classList.toggle("editing", !this.online);
      this.renderSync();
    };
    window.addEventListener("online", () => {
      this.online = true;
      apply();
      this.toast("网络已恢复，可以同步断网改动", "ok");
    });
    window.addEventListener("offline", () => {
      this.online = false;
      apply();
      this.toast("已进入离线模式，改动保存在本地", "fail");
    });
    if (pill) pill.addEventListener("click", () => {
      // Manual toggle for demo/testing.
      this.online = !this.online;
      apply();
      this.toast(this.online ? "已切换到在线模式" : "已切换到离线模式（可改片）", "ok");
    });
    this.online = navigator.onLine !== false;
    apply();
  },

  /* ---------- toast ---------- */
  toast(msg, type = "") {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 2800);
  },

  /* ---------- service worker ---------- */
  registerSW() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW 注册失败", e));
    });
  },

  /* ---------- sync modal ---------- */
  bindSyncModal() {
    const openBtn = document.querySelector("[data-sync-btn]");
    const overlay = document.querySelector("[data-sync-overlay]");
    if (!overlay) return;
    const close = () => {
      overlay.classList.remove("open");
      this.syncOpen = false;
    };
    if (openBtn) openBtn.addEventListener("click", () => {
      this.syncOpen = true;
      this.mergeResult = null;
      this.resolutions = {};
      this.renderSync();
      overlay.classList.add("open");
    });
    overlay.querySelector("[data-sync-close]").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.syncOpen) close();
    });

    overlay.querySelector("[data-btn-remote]").addEventListener("click", () => {
      Store.seedRemoteScenario();
      this.toast("已模拟工作室在线改片", "ok");
      this.renderSync();
    });
    overlay.querySelector("[data-btn-offline]").addEventListener("click", () => {
      Store.seedOfflineScenario();
      this.toast("已模拟一次断网改片", "ok");
      this.renderSync();
      window.dispatchEvent(new CustomEvent("store:changed"));
    });
    overlay.querySelector("[data-btn-simfail]").addEventListener("click", () => {
      this.simulateFailure = !this.simulateFailure;
      this.renderSync();
    });
    overlay.querySelector("[data-btn-sync]").addEventListener("click", () => this.doSync());
    overlay.querySelector("[data-btn-confirm]").addEventListener("click", () => this.doConfirm());
    // Event delegation: conflict version buttons are re-rendered on each renderSync.
    overlay.querySelector("[data-conflicts]").addEventListener("click", (e) => {
      const ver = e.target.closest(".ver");
      if (!ver) return;
      this.resolutions[ver.dataset.id] = ver.dataset.pick;
      this.renderSync();
    });
    overlay.querySelector("[data-btn-reset]").addEventListener("click", () => {
      if (confirm("确定要清空本地草稿并重新载入底稿吗？")) {
        Store.resetAll();
        location.reload();
      }
    });
  },

  async doSync() {
    const overlay = document.querySelector("[data-sync-overlay]");
    const banner = overlay.querySelector("[data-sync-banner]");
    banner.className = "sync-banner info show";
    banner.textContent = this.simulateFailure
      ? "正在同步…（模拟网络中断）"
      : "正在与工作室底稿同步…";
    const res = await Store.attemptSync({ simulateFailure: this.simulateFailure });
    if (!res.ok) {
      banner.className = "sync-banner fail show";
      banner.innerHTML =
        "同步失败：网络中断，未合并任何改动，已回到原底稿。<button class='mini-btn' data-btn-retry style='margin-left:10px'>重试</button>";
      banner.querySelector("[data-btn-retry]").addEventListener("click", () => this.doSync());
      this.mergeResult = null;
      this.renderSync();
      return;
    }
    this.mergeResult = res.result;
    this.resolutions = {};
    banner.className = "sync-banner ok show";
    const c = res.result.clean;
    banner.textContent = `同步完成：仅本地改 ${c.local} 张，仅工作室改 ${c.remote} 张，双方都改 ${c.both} 张（需确认候选）。`;
    this.renderSync();
  },

  doConfirm() {
    if (!this.mergeResult) return;
    const unresolved = this.mergeResult.conflicts.filter((cf) => !this.resolutions[cf.id]);
    if (unresolved.length) {
      this.toast(`还有 ${unresolved.length} 个候选未选择`, "fail");
      return;
    }
    Store.confirmMerge(this.resolutions);
    this.mergeResult = null;
    this.resolutions = {};
    const banner = document.querySelector("[data-sync-banner]");
    if (banner) {
      banner.className = "sync-banner ok show";
      banner.textContent = "已确认合并：系列封面、灯箱顺序与结果集已一起重算。";
    }
    this.toast("已确认合并，封面 / 顺序 / 结果集已重算", "ok");
    this.renderSync();
    window.dispatchEvent(new CustomEvent("store:changed"));
  },

  renderSync() {
    const overlay = document.querySelector("[data-sync-overlay]");
    if (!overlay) return;
    const dirty = Store.dirtyPhotoCount();
    const remote = Store.remoteChangeCount();
    const meta = Store.state.meta;

    overlay.querySelector("[data-stat-dirty]").textContent = dirty;
    overlay.querySelector("[data-stat-remote]").textContent = remote;
    overlay.querySelector("[data-stat-syncs]").textContent = meta.syncCount || 0;
    overlay.querySelector("[data-stat-online]").textContent = this.online ? "在线" : "离线";

    // failure toggle label
    const failBtn = overlay.querySelector("[data-btn-simfail]");
    if (failBtn) {
      failBtn.textContent = this.simulateFailure ? "模拟中断：开" : "模拟中断：关";
      failBtn.classList.toggle("danger", this.simulateFailure);
    }

    // conflicts
    const confWrap = overlay.querySelector("[data-conflicts]");
    const confirmBtn = overlay.querySelector("[data-btn-confirm]");
    if (this.mergeResult && this.mergeResult.conflicts.length) {
      confWrap.innerHTML =
        `<div class="sync-section"><h4>冲突候选（双方都改过，请选择保留版本）</h4>` +
        this.mergeResult.conflicts.map((cf) => this.conflictHTML(cf)).join("") +
        `</div>`;
      confWrap.querySelectorAll(".ver").forEach((ver) => {
        ver.addEventListener("click", () => {
          const id = ver.dataset.id;
          const pick = ver.dataset.pick;
          this.resolutions[id] = pick;
          this.renderSync();
        });
      });
      confirmBtn.disabled = false;
    } else if (this.mergeResult) {
      confWrap.innerHTML =
        `<div class="sync-section"><h4>合并结果</h4>
         <div class="merge-summary">无冲突，所有改动可自动合并。
           <div class="leg">
             <span><span class="dot local"></span>仅本地 ${this.mergeResult.clean.local}</span>
             <span><span class="dot remote"></span>仅工作室 ${this.mergeResult.clean.remote}</span>
             <span><span class="dot conflict"></span>双方 ${this.mergeResult.clean.both}</span>
           </div>
         </div></div>`;
      confirmBtn.disabled = false;
    } else {
      confWrap.innerHTML =
        `<div class="sync-section"><h4>合并说明</h4>
         <div class="merge-summary">
           断网改动按 <b>照片基线</b> 与工作室底稿三路合并：仅一方改动则采用该方版本；
           双方都改动同一张时<b>留下候选</b>，由你选择，不会覆盖任何一方。
           合并失败会回到原底稿，可重试；确认后系列封面、灯箱顺序与结果集一起重算。
         </div></div>`;
      confirmBtn.disabled = true;
    }

    // reflect selected state (click handling is delegated)
    confWrap.querySelectorAll(".ver").forEach((ver) => {
      const id = ver.dataset.id;
      ver.classList.toggle("selected", this.resolutions[id] === ver.dataset.pick);
    });
  },

  conflictHTML(cf) {
    const fields = cf.fields.length ? cf.fields.join("、") : "顺序/字段";
    const ver = (v, pick, tag, cls) => {
      const img = v.file
        ? `<img class="thumb" src="${v.file}" alt="" />`
        : "";
      return `<div class="ver ${cls}" data-id="${cf.id}" data-pick="${pick}">
        <div class="tag ${cls}">${tag}</div>
        ${img}
        <dl>
          <dt>标题</dt><dd>${v.title || "—"}</dd>
          <dt>说明</dt><dd>${v.caption || "—"}</dd>
          <dt>顺序</dt><dd>${v.order ?? "—"}</dd>
          <dt>系列</dt><dd>${v.seriesId || "—"}</dd>
        </dl>
      </div>`;
    };
    return `<div class="conflict">
      <div class="c-title">${cf.id}</div>
      <div class="c-sub">双方都改动了这张照片（冲突字段：${fields}），请选择保留哪一版：</div>
      <div class="c-versions">
        ${ver(cf.local, "local", "断网改片版", "local")}
        ${ver(cf.remote, "remote", "工作室在线版", "remote")}
      </div>
    </div>`;
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
