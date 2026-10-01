/* ============================================================
   store.js — offline draft store + three-way merge engine
   - baseline : the original draft (底稿) snapshot taken at checkout
   - working  : photographer's offline edits
   - remote   : studio (online) copy; may diverge concurrently
   Merge is per-photo (按照片基线): both sides changed the same
   photo -> a candidate is left for manual resolution (no clobber).
   ============================================================ */

const STORE_KEY = "lumina-portfolio-store-v1";
const DATA_URL = "data/photos.json";

const clone = (o) => JSON.parse(JSON.stringify(o));
const byId = (arr) => Object.fromEntries(arr.map((item) => [item.id, item]));

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return a === b;
  }
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}
const shallowEqual = deepEqual;

const Store = {
  state: null,
  _initPromise: null,

  init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  },

  async _doInit() {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        return this.state;
      } catch (e) {
        console.warn("corrupt store, reinitializing", e);
      }
    }
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("无法加载底稿数据");
    const data = await res.json();
    // Deep-clone three times so baseline / working / remote never share references.
    this.state = {
      baseline: { photos: byId(clone(data.photos)), series: byId(clone(data.series)) },
      working: { photos: byId(clone(data.photos)), series: byId(clone(data.series)) },
      remote: { photos: byId(clone(data.photos)), series: byId(clone(data.series)) },
      meta: {
        draftName: "巡展底稿",
        checkedOutAt: Date.now(),
        lastSyncAt: null,
        syncCount: 0,
      },
    };
    this.save();
    return this.state;
  },

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("保存失败", e);
    }
  },

  resetAll() {
    localStorage.removeItem(STORE_KEY);
    this.state = null;
    this._initPromise = null;
  },

  /* ---------- getters ---------- */
  photos(which = "working") {
    return Object.values(this.state[which].photos);
  },
  series(which = "working") {
    return Object.values(this.state[which].series);
  },
  photo(id, which = "working") {
    return this.state[which].photos[id];
  },
  seriesById(id, which = "working") {
    return this.state[which].series[id];
  },

  /** Ordered photo ids for a series (derived from photo.order). */
  seriesPhotoIds(seriesId, which = "working") {
    return this.photos(which)
      .filter((p) => p.seriesId === seriesId)
      .sort((a, b) => a.order - b.order)
      .map((p) => p.id);
  },
  /** Cover = first photo by order (derived). */
  seriesCoverId(seriesId, which = "working") {
    return this.seriesPhotoIds(seriesId, which)[0] || null;
  },

  /* ---------- offline edits (working copy) ---------- */
  editPhoto(id, changes) {
    const p = this.state.working.photos[id];
    if (!p) return;
    Object.assign(p, changes);
    this.save();
  },

  /** Reorder within a series: assign order 1..n in the given id list. */
  reorderSeries(seriesId, orderedIds) {
    orderedIds.forEach((pid, idx) => {
      const p = this.state.working.photos[pid];
      if (p && p.seriesId === seriesId) p.order = idx + 1;
    });
    this.save();
  },

  /** Move a photo to a new series (optionally at a position). */
  movePhoto(photoId, toSeriesId, atIndex) {
    const p = this.state.working.photos[photoId];
    if (!p) return;
    p.seriesId = toSeriesId;
    const ids = this.seriesPhotoIds(toSeriesId, "working").filter((id) => id !== photoId);
    if (typeof atIndex === "number") ids.splice(atIndex, 0, photoId);
    else ids.push(photoId);
    ids.forEach((id, i) => {
      const ph = this.state.working.photos[id];
      if (ph) ph.order = i + 1;
    });
    this.save();
  },

  editSeries(id, changes) {
    const s = this.state.working.series[id];
    if (!s) return;
    Object.assign(s, changes);
    this.save();
  },

  /* ---------- remote (studio online) mutations ---------- */
  applyRemoteMutations(muts) {
    for (const [id, ch] of Object.entries(muts.photos || {})) {
      const r = this.state.remote.photos[id];
      if (r) Object.assign(r, ch);
    }
    for (const [id, ch] of Object.entries(muts.series || {})) {
      const r = this.state.remote.series[id];
      if (r) Object.assign(r, ch);
    }
    this.save();
  },

  /* ---------- change detection ---------- */
  photoChanged(id, which) {
    const base = this.state.baseline.photos[id];
    const v = this.state[which].photos[id];
    if (!base || !v) return false;
    return !shallowEqual(base, v);
  },
  seriesChanged(id, which) {
    const base = this.state.baseline.series[id];
    const v = this.state[which].series[id];
    if (!base || !v) return false;
    return !shallowEqual(base, v);
  },

  dirtyPhotoCount() {
    return Object.keys(this.state.working.photos).filter((id) => this.photoChanged(id, "working")).length;
  },
  remoteChangeCount() {
    return Object.keys(this.state.remote.photos).filter((id) => this.photoChanged(id, "remote")).length;
  },

  /** Fields that differ between local and remote relative to baseline (for candidate display). */
  conflictingFields(id) {
    const base = this.state.baseline.photos[id];
    const local = this.state.working.photos[id];
    const remote = this.state.remote.photos[id];
    const fields = [];
    for (const k of Object.keys(base)) {
      if (!deepEqual(local[k], base[k]) && !deepEqual(remote[k], base[k])) fields.push(k);
    }
    return fields;
  },

  /* ---------- three-way merge ---------- */
  /**
   * Returns { mergedPhotos, mergedSeries, conflicts, clean }.
   * Does NOT mutate state — call confirmMerge to apply.
   */
  merge() {
    const mergedPhotos = {};
    const conflicts = [];
    const clean = { local: 0, remote: 0, both: 0, none: 0 };

    const photoIds = new Set([
      ...Object.keys(this.state.baseline.photos),
      ...Object.keys(this.state.working.photos),
      ...Object.keys(this.state.remote.photos),
    ]);

    for (const id of photoIds) {
      const base = this.state.baseline.photos[id];
      const local = this.state.working.photos[id];
      const remote = this.state.remote.photos[id];
      const lc = local && !shallowEqual(local, base);
      const rc = remote && !shallowEqual(remote, base);

      if (lc && rc) {
        // Both sides moved the same photo -> leave a candidate, don't clobber.
        conflicts.push({
          kind: "photo",
          id,
          base: clone(base),
          local: clone(local),
          remote: clone(remote),
          fields: this.conflictingFields(id),
        });
        mergedPhotos[id] = clone(local); // tentative; resolved by user
        clean.both++;
      } else if (lc) {
        mergedPhotos[id] = clone(local);
        clean.local++;
      } else if (rc) {
        mergedPhotos[id] = clone(remote);
        clean.remote++;
      } else {
        mergedPhotos[id] = clone(base || local || remote);
        clean.none++;
      }
    }

    // series metadata merge (title/summary); same three-way logic
    const mergedSeries = {};
    const seriesIds = new Set([
      ...Object.keys(this.state.baseline.series),
      ...Object.keys(this.state.working.series),
      ...Object.keys(this.state.remote.series),
    ]);
    for (const id of seriesIds) {
      const base = this.state.baseline.series[id];
      const local = this.state.working.series[id];
      const remote = this.state.remote.series[id];
      const lc = local && !shallowEqual(local, base);
      const rc = remote && !shallowEqual(remote, base);
      if (lc && rc) {
        conflicts.push({ kind: "series", id, base: clone(base), local: clone(local), remote: clone(remote), fields: ["title", "summary"] });
        mergedSeries[id] = clone(local);
      } else if (lc) mergedSeries[id] = clone(local);
      else if (rc) mergedSeries[id] = clone(remote);
      else mergedSeries[id] = clone(base || local || remote);
    }

    return { mergedPhotos, mergedSeries, conflicts, clean };
  },

  /**
   * Apply a merge result. resolutions: { [id]: 'local' | 'remote' }.
   * Recomputes derived data (series order/cover) together, then resets baseline.
   */
  confirmMerge(resolutions = {}) {
    const { mergedPhotos, mergedSeries, conflicts } = this.merge();

    for (const c of conflicts) {
      const pick = resolutions[c.id] === "remote" ? c.remote : c.local;
      if (c.kind === "photo") mergedPhotos[c.id] = clone(pick);
      else mergedSeries[c.id] = clone(pick);
    }

    // Apply to working copy.
    this.state.working.photos = mergedPhotos;
    this.state.working.series = mergedSeries;

    // Recompute derived series order + cover together (顺序与封面一起重算).
    this.recomputeSeries();

    // New baseline = merged result; remote now agrees.
    this.state.baseline.photos = clone(mergedPhotos);
    this.state.baseline.series = clone(mergedSeries);
    this.state.remote.photos = clone(mergedPhotos);
    this.state.remote.series = clone(mergedSeries);

    this.state.meta.lastSyncAt = Date.now();
    this.state.meta.syncCount = (this.state.meta.syncCount || 0) + 1;
    this.save();
  },

  /** Normalize order within every series and refresh cover/photoIds. */
  recomputeSeries() {
    for (const s of Object.values(this.state.working.series)) {
      const ids = this.photos("working")
        .filter((p) => p.seriesId === s.id)
        .sort((a, b) => a.order - b.order)
        .map((p) => p.id);
      ids.forEach((id, i) => {
        const p = this.state.working.photos[id];
        if (p) p.order = i + 1;
      });
      s.photoIds = ids;
      s.coverPhotoId = ids[0] || null;
    }
    this.save();
  },

  /* ---------- sync transaction with rollback ---------- */
  /**
   * Attempt a sync. On simulated failure, roll working copy back to the
   * original draft snapshot and report failure so the caller can retry.
   */
  async attemptSync({ simulateFailure = false } = {}) {
    const draftSnapshot = clone({
      photos: this.state.working.photos,
      series: this.state.working.series,
    });
    try {
      // Simulate a network round-trip.
      await new Promise((r) => setTimeout(r, 650));
      if (simulateFailure) {
        const err = new Error("NETWORK_INTERRUPTED");
        err.code = "NETWORK_INTERRUPTED";
        throw err;
      }
      const result = this.merge();
      return { ok: true, result };
    } catch (err) {
      // Failure -> return to the original draft (回到原底稿), keep baseline.
      this.state.working.photos = draftSnapshot.photos;
      this.state.working.series = draftSnapshot.series;
      this.save();
      return { ok: false, error: err };
    }
  },

  /* ---------- demo helpers ---------- */
  /** Scripted studio (remote) edits that create a realistic conflict mix. */
  seedRemoteScenario() {
    this.applyRemoteMutations({
      photos: {
        "portrait-02": { title: "遮蔽（工作室修订）" }, // title changed remotely
        "landscape-03": { caption: "工作室重写了这句说明，强调留白。" },
        "pastoral-01": { title: "独牛与木屋（在线版）" },
      },
      series: {},
    });
  },

  /** Scripted photographer (offline) edits to demonstrate local-only + conflict. */
  seedOfflineScenario() {
    // Reorder the gaze series (moves portrait-05 to the front).
    const gaze = this.seriesPhotoIds("gaze", "working");
    const reordered = ["portrait-05", ...gaze.filter((id) => id !== "portrait-05")];
    this.reorderSeries("gaze", reordered);
    // Rename landscape-01 locally.
    this.editPhoto("landscape-01", { title: "野花坡（断网改片版）" });
  },
};

window.Store = Store;
