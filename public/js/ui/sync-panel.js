/**
 * sync-panel.js — the "network is back" workflow.
 *
 *   fetch station catalog  ->  3-way merge on the photo baseline
 *      clean merge         ->  Confirm
 *      conflicting photo   ->  candidate cards (local vs station), one choice
 *                              per contested field / sequence, then Confirm
 *      fetch/merge failure ->  working copy untouched / rolled back to the
 *                              original draft; Retry runs from that baseline
 *   Confirm                ->  commit + recompute covers/order/result set
 */
import {
  getState, subscribe, fetchRemote, runMerge, commitMerge, discardMerge,
  resetWorkingCopy, setSimOffline, fullReset,
} from "../app/store.js";
import { photoById, seriesById } from "../app/selectors.js";

function fmt(v, field) {
  if (v === undefined || v === null) return "—";
  if (field === "selected") return v ? "Kept selected" : "Dropped";
  return String(v);
}

function seqLine(catalog, ids) {
  return ids
    .map((id, i) => {
      const p = photoById(catalog, id);
      return `${i + 1}. ${p ? p.title : id}`;
    })
    .join(" → ");
}

const resolutions = new Map();

export function mountSyncPanel(container) {
  const render = () => {
    const s = getState();
    if (!s) return;
    const { sync } = s;
    const pm = sync.pendingMerge;
    const offline = s.simOffline || !s.online;
    const busy = sync.phase === "merging";

    const stats = pm?.stats;
    container.innerHTML = `
      <section class="sync-panel" aria-live="polite">
        <div class="sync-panel__head">
          <h3 style="margin:0">Back at the station · sync desk</h3>
          <span class="net-pill ${offline ? "is-offline" : "is-online"}">
            <span class="dot"></span>${offline ? "Venue mode (offline)" : "Network available"}
          </span>
          <span class="spacer" style="margin-left:auto"></span>
          <label class="switch-label">
            <input type="checkbox" data-sim-offline ${s.simOffline ? "checked" : ""}>
            Simulate disconnected venue
          </label>
        </div>
        <div class="sync-panel__body">
          <p class="muted" style="margin:0;font-size:.86rem">
            The merge uses the touring draft as a per-photo baseline: edits only one side made
            fast-forward automatically; photos both sides edited differently produce candidates.
          </p>

          <div class="pill-row">
            <button class="btn btn--accent" data-fetch ${busy || offline ? "disabled" : ""}>
              ${busy ? "Contacting…" : "1 · Fetch station catalog"}
            </button>
            <button class="btn" data-merge ${sync.phase !== "fetched" ? "disabled" : ""}>
              2 · Merge on photo baseline
            </button>
            <button class="btn btn--ghost" data-retry-fail ${busy ? "disabled" : ""}>
              Retry while network down
            </button>
            <button class="btn btn--ghost" data-broken ${busy ? "disabled" : ""}>
              Fetch corrupted catalog
            </button>
            <button class="btn btn--danger" data-reset>Reset edits to draft</button>
            <button class="btn btn--danger btn--sm" data-full-reset>Restore original draft</button>
          </div>

          <p class="status-line ${
            sync.phase === "failed" ? "is-error" : sync.phase === "done" ? "is-ok" :
            sync.phase === "conflicts" ? "is-warn" : ""
          }">${sync.message || "No sync activity yet."}</p>

          ${stats ? `
            <div class="stats-row">
              <span><b>${stats.auto}</b>Auto-applied photos</span>
              <span><b>${stats.localOnly}</b>Venue-only</span>
              <span><b>${stats.remoteOnly}</b>Station-only</span>
              <span><b>${stats.agreed}</b>Same edit both sides</span>
              <span><b>${pm.conflicts.length}</b>Candidate conflicts</span>
            </div>` : ""}

          ${pm && pm.conflicts.length ? renderConflicts(pm) : ""}

          ${pm ? `
            <div class="pill-row">
              <button class="btn btn--accent" data-confirm ${pm.conflicts.length ? "disabled" : ""}>
                3 · Confirm merge & recompute
              </button>
              <button class="btn btn--ghost" data-discard>Discard merge, keep my edits</button>
              ${pm.conflicts.length ? `<span class="muted" style="font-size:.82rem;align-self:center">
                Pick one candidate for every card to enable Confirm.</span>` : ""}
            </div>` : ""}

          <details>
            <summary class="muted" style="cursor:pointer;font-size:.84rem">Activity log</summary>
            <ul class="logbox">
              ${(sync.log || []).map((l) => `<li class="is-${l.kind}">${new Date(l.at).toLocaleTimeString()} — ${l.line}</li>`).join("")}
            </ul>
          </details>
        </div>
      </section>`;

    container.querySelector("[data-sim-offline]").addEventListener("change", (e) =>
      setSimOffline(e.target.checked)
    );
    container.querySelector("[data-fetch]").addEventListener("click", () => fetchRemote());
    container.querySelector("[data-retry-fail]").addEventListener("click", () =>
      fetchRemote({ forceFail: true })
    );
    container.querySelector("[data-broken]").addEventListener("click", () => fetchRemote({ broken: true }));
    container.querySelector("[data-reset]").addEventListener("click", resetWorkingCopy);
    container.querySelector("[data-full-reset]").addEventListener("click", async () => {
      await fullReset();
    });
    const mergeBtn = container.querySelector("[data-merge]");
    if (mergeBtn) mergeBtn.addEventListener("click", () => {
      resolutions.clear();
      runMerge();
    });
    const discardBtn = container.querySelector("[data-discard]");
    if (discardBtn) discardBtn.addEventListener("click", () => {
      resolutions.clear();
      discardMerge();
    });
    const confirmBtn = container.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        const picked = Object.fromEntries(resolutions);
        commitMerge(picked);
        resolutions.clear();
      });
    }

    // candidate choice wiring
    container.querySelectorAll("[data-conflict-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.conflictKey;
        const side = btn.dataset.side;
        const prev = resolutions.get(key);
        if (prev === side) resolutions.delete(key);
        else resolutions.set(key, side);
        paintChoices();
      });
    });
  };

  function paintChoices() {
    const s = getState();
    const pm = s.sync.pendingMerge;
    if (!pm) return;
    container.querySelectorAll("[data-conflict-key]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(resolutions.get(btn.dataset.conflictKey) === btn.dataset.side));
    });
    const allResolved = pm.conflicts.every((c) => {
      const key =
        c.kind === "photo-field" ? `${c.photoId}:${c.field}`
        : c.kind === "series-field" ? `series-field:${c.seriesId}:${c.field}`
        : c.kind === "series-order" ? "seriesOrder"
        : `photo-order:${c.seriesId}`;
      return resolutions.has(key);
    });
    const btn = container.querySelector("[data-confirm]");
    if (btn) {
      btn.disabled = !allResolved;
      btn.textContent = allResolved ? "3 · Confirm merge & recompute" : "3 · Pick all candidates first";
    }
  }

  function renderConflicts(pm) {
    const s = getState();
    return `<div class="conflict-list">
      ${pm.conflicts.map((c) => {
        const key =
          c.kind === "photo-field" ? `${c.photoId}:${c.field}`
          : c.kind === "series-field" ? `series-field:${c.seriesId}:${c.field}`
          : c.kind === "series-order" ? "seriesOrder"
          : `photo-order:${c.seriesId}`;
        let title, localText, remoteText;
        if (c.kind === "photo-field") {
          const p = photoById(s.baseline, c.photoId);
          const ser = seriesById(s.baseline, p.seriesId);
          title = `Photo “${p.title}” — ${c.field}${c.field === "selected" ? " (selection)" : ""} · ${ser.title}`;
          localText = fmt(c.local, c.field);
          remoteText = fmt(c.remote, c.field);
        } else if (c.kind === "series-field") {
          title = `Series metadata — ${c.seriesId} · ${c.field}`;
          localText = fmt(c.local);
          remoteText = fmt(c.remote);
        } else if (c.kind === "series-order") {
          title = "Series order (top-level sequence)";
          localText = c.localSeq.map((id) => seriesById(s.baseline, id)?.title || id).join(" → ");
          remoteText = c.remoteSeq.map((id) => seriesById(s.baseline, id)?.title || id).join(" → ");
        } else {
          const ser = seriesById(s.baseline, c.seriesId);
          title = `Photo order inside “${ser.title}”`;
          localText = seqLine(s.catalog, c.localSeq);
          remoteText = seqLine(s.sync.remote, c.remoteSeq);
        }
        return `
        <div class="conflict">
          <div class="conflict__title">⚠ ${title}</div>
          <div class="conflict__choices">
            <button class="conflict__choice" data-conflict-key="${key}" data-side="local" type="button"
                    aria-pressed="${resolutions.get(key) === "local"}">
              <small>Venue draft</small>${escapeHtml(localText)}
            </button>
            <button class="conflict__choice" data-conflict-key="${key}" data-side="remote" type="button"
                    aria-pressed="${resolutions.get(key) === "remote"}">
              <small>Station catalog</small>${escapeHtml(remoteText)}
            </button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }

  subscribe(render);
  render();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}
