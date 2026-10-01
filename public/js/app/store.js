/**
 * store.js — single shared state for all five pages.
 *
 * Persistence (localStorage, so the disconnected venue keeps working):
 *   portfolio.baseline  — the touring draft catalog ("原底稿")
 *   portfolio.catalog   — the current working copy with offline edits
 *   portfolio.scope     — active filter scope (survives navigation & back)
 *   portfolio.sync      — last sync status/activity log
 *
 * The catalog is the only data source every page reads. Merge never mutates
 * it in place: on failure the working copy is left byte-identical and the
 * merge retries from the baseline; on confirmed commit baseline + working
 * copy advance together and every derived view is recomputed downstream.
 */

import { mergeCatalogs, resolveConflicts, MergeError, normalizeOrders } from "./merge.js";
import { cloneCatalog } from "./selectors.js";

const LS = {
  baseline: "portfolio.baseline",
  catalog: "portfolio.catalog",
  scope: "portfolio.scope",
  sync: "portfolio.sync",
};

const listeners = new Set();
let state = null;

function emit() {
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

function persist() {
  if (!state) return;
  localStorage.setItem(LS.catalog, JSON.stringify(state.catalog));
  localStorage.setItem(LS.baseline, JSON.stringify(state.baseline));
  localStorage.setItem(LS.scope, JSON.stringify(state.scope));
  localStorage.setItem(LS.sync, JSON.stringify(state.sync));
}

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch ${path} failed: ${res.status}`);
  return res.json();
}

function readSyncLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.sync) || "null");
    return raw?.log || [];
  } catch {
    return [];
  }
}

export async function init() {
  if (state) return state;

  let baseline = null;
  try {
    baseline = JSON.parse(localStorage.getItem(LS.baseline) || "null");
  } catch {
    baseline = null;
  }
  if (!baseline) {
    baseline = await loadJson("data/baseline.json");
  }

  let catalog = null;
  try {
    catalog = JSON.parse(localStorage.getItem(LS.catalog) || "null");
  } catch {
    catalog = null;
  }
  if (!catalog) catalog = cloneCatalog(baseline);

  let scope = { categoryId: null, seriesId: null, selectedOnly: false };
  try {
    scope = { ...scope, ...(JSON.parse(localStorage.getItem(LS.scope) || "{}")) };
  } catch {
    /* keep default scope */
  }

  const simOffline = localStorage.getItem("portfolio.simOffline") === "1";

  state = {
    ready: true,
    baseline,
    catalog,
    scope,
    simOffline, // venue mode toggle for the demo
    online: navigator.onLine,
    sync: {
      phase: "idle", // idle | fetched | merging | conflicts | ready | failed | done
      pendingMerge: null,
      remote: null,
      message: "",
      log: readSyncLog(),
    },
  };
  window.addEventListener("online", () => {
    state.online = true;
    emit();
  });
  window.addEventListener("offline", () => {
    state.online = false;
    emit();
  });
  persist();
  emit();
  return state;
}

function log(line, kind = "info") {
  state.sync.log.unshift({ at: new Date().toISOString(), kind, line });
  state.sync.log = state.sync.log.slice(0, 40);
}

// ---- Filter scope (persisted; "筛选到系列再返回仍保留范围") ---------------
export function setScope(patch) {
  state.scope = { ...state.scope, ...patch };
  persist();
  emit();
}

export function clearScope() {
  state.scope = { categoryId: null, seriesId: null, selectedOnly: false };
  persist();
  emit();
}

// ---- Offline edits -------------------------------------------------------
function findPhoto(id) {
  return state.catalog.photos.find((p) => p.id === id);
}

function findSeries(id) {
  return state.catalog.series.find((s) => s.id === id);
}

export function toggleSelect(id) {
  const p = findPhoto(id);
  if (!p) return;
  p.selected = !p.selected;
  log(`Offline edit: ${p.id} ${p.selected ? "selected" : "dropped"}`, "local");
  persist();
  emit();
}

export function editPhoto(id, patch) {
  const p = findPhoto(id);
  if (!p) return;
  Object.assign(p, patch);
  log(`Offline edit: ${id} fields updated`, "local");
  persist();
  emit();
}

/** Move a photo one slot within its series order. */
export function movePhoto(id, dir) {
  const p = findPhoto(id);
  if (!p) return;
  const s = findSeries(p.seriesId);
  const ids = s.photoIds
    .map((pid) => state.catalog.photos.find((x) => x.id === pid))
    .sort((a, b) => a.order - b.order);
  const i = ids.findIndex((x) => x.id === id);
  const j = i + (dir === "up" ? -1 : 1);
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  ids.forEach((ph, n) => {
    ph.order = n + 1;
  });
  s.photoIds = ids.map((ph) => ph.id);
  log(`Offline edit: ${id} moved ${dir} in ${s.id}`, "local");
  persist();
  emit();
}

/** Move a whole series one slot (this is what "系列顺序乱掉" is resolved with). */
export function moveSeries(id, dir) {
  const i = state.catalog.series.findIndex((s) => s.id === id);
  const j = i + (dir === "up" ? -1 : 1);
  if (j < 0 || j >= state.catalog.series.length) return;
  const arr = state.catalog.series;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  log(`Offline edit: series ${id} moved ${dir}`, "local");
  persist();
  emit();
}

export function setSimOffline(v) {
  state.simOffline = v;
  localStorage.setItem("portfolio.simOffline", v ? "1" : "0");
  emit();
}

// ---- Sync ----------------------------------------------------------------
export function resetWorkingCopy() {
  state.catalog = cloneCatalog(state.baseline);
  state.sync.phase = "idle";
  state.sync.pendingMerge = null;
  state.sync.remote = null;
  state.sync.message = "";
  log("Working copy reset to the touring baseline.", "info");
  persist();
  emit();
}

export async function fetchRemote({ forceFail = false, broken = false } = {}) {
  state.sync.phase = "merging";
  state.sync.message = "Contacting station…";
  emit();

  const networkDown = state.simOffline || !navigator.onLine;
  try {
    if (networkDown || forceFail) {
      throw new Error("network unavailable (venue mode / forced failure)");
    }
    const remote = await loadJson(broken ? "data/remote-broken.json" : "data/remote.json");
    state.sync.remote = remote;
    state.sync.phase = "fetched";
    state.sync.message = "Station catalog received.";
    log("Fetched station catalog over the network.", "info");
    persist();
    emit();
  } catch (err) {
    // Failure path: do NOT touch baseline or working copy.
    state.sync.phase = "failed";
    state.sync.message = `Fetch failed: ${err.message}. Draft untouched — retry from the baseline.`;
    log(`Sync failed before merge: ${err.message}`, "error");
    persist();
    emit();
  }
}

/**
 * Run the three-way merge. On structural failure the working copy stays on
 * the original draft and the user retries from that baseline.
 */
export function runMerge() {
  const { baseline, catalog, sync } = state;
  if (!sync.remote) return;
  try {
    const result = mergeCatalogs(baseline, catalog, sync.remote);
    sync.pendingMerge = result;
    if (result.conflicts.length) {
      sync.phase = "conflicts";
      sync.message = `${result.conflicts.length} conflict candidate(s) need a choice.`;
      log(`Merge produced ${result.conflicts.length} candidate conflict(s).`, "warn");
    } else {
      sync.phase = "ready";
      sync.message = "Clean merge — ready to confirm.";
      log(`Merge clean (${result.stats.auto} auto-applied).`, "info");
    }
    persist();
    emit();
  } catch (err) {
    if (err instanceof MergeError) {
      // Roll back: discard any provisional state, keep the original draft.
      sync.phase = "failed";
      sync.pendingMerge = null;
      sync.message = `Merge rejected: ${err.message}. Reverted to the original draft; retry from baseline.`;
      log(`Merge failure, rolled back to draft: ${err.message}`, "error");
      state.catalog = cloneCatalog(state.baseline); // "失败后回到原底稿重试"
      persist();
      emit();
    } else {
      throw err;
    }
  }
}

export function discardMerge() {
  state.sync.pendingMerge = null;
  state.sync.phase = "idle";
  state.sync.message = "Merge discarded; offline edits kept.";
  log("Pending merge discarded; kept offline edits.", "info");
  persist();
  emit();
}

/**
 * Confirm a merge. `resolutions` chooses local/remote for every candidate.
 * Afterwards: baseline and working copy both become the merged catalog,
 * scope stays, and all derived views (covers, lightbox order, result sets)
 * are recomputed by the selectors on next render.
 */
export function commitMerge(resolutions) {
  const pending = state.sync.pendingMerge;
  if (!pending) return;
  try {
    const merged = pending.conflicts.length
      ? resolveConflicts(pending, resolutions)
      : pending.catalog;
    normalizeOrders(merged.photos, merged.series);
    state.catalog = merged;
    state.baseline = cloneCatalog(merged); // new baseline for future syncs
    state.sync.phase = "done";
    state.sync.pendingMerge = null;
    state.sync.remote = null;
    state.sync.message = "Merge confirmed. Covers, lightbox order and result set recomputed.";
    log(
      `Confirmed merge: ${pending.stats.auto} auto, ${pending.stats.conflicts} resolved, ` +
        `${pending.stats.localOnly} local-only, ${pending.stats.remoteOnly} station-only.`,
      "ok"
    );
    persist();
    emit();
  } catch (err) {
    state.sync.phase = "conflicts";
    state.sync.message = err.message;
    log(`Confirm blocked: ${err.message}`, "error");
    emit();
  }
}

export function fullReset() {
  localStorage.removeItem(LS.baseline);
  localStorage.removeItem(LS.catalog);
  localStorage.removeItem(LS.scope);
  localStorage.removeItem("portfolio.simOffline");
  state.simOffline = false;
  state.sync.phase = "idle";
  state.sync.pendingMerge = null;
  state.sync.remote = null;
  state.sync.message = "";
  log("Full reset: reloaded the original touring draft.", "info");
  state = null; // force init() to re-read the freshly cleared storage
  return init();
}

// ---- Contact queue (offline form) ---------------------------------------
const LS_QUEUE = "portfolio.contactQueue";

export function queueMessage(entry) {
  const q = JSON.parse(localStorage.getItem(LS_QUEUE) || "[]");
  q.push({ ...entry, at: new Date().toISOString(), status: "queued" });
  localStorage.setItem(LS_QUEUE, JSON.stringify(q));
  return q.length;
}

export function queuedMessages() {
  return JSON.parse(localStorage.getItem(LS_QUEUE) || "[]");
}

export function flushQueue() {
  const q = queuedMessages();
  const sent = q.length;
  localStorage.removeItem(LS_QUEUE);
  return sent;
}
