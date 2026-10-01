/**
 * merge.js — three-way merge for the offline touring catalog.
 *
 * base   = the touring draft that left the station (the "photo baseline")
 * local  = edits made while disconnected (selection desk copy)
 * remote = the catalog fetched from the station once the network returns
 *
 * Every tracked photo field is merged independently against its baseline value:
 *   - only one side changed  -> take that side (fast-forward)
 *   - both changed, same    -> take that value
 *   - both changed, differ  -> leave a CONFLICT with both candidates
 *
 * Series ordering (the top-level series array) is merged the same way but
 * against each series id's predecessor in the baseline ordering.
 *
 * The merge is purely functional: nothing here touches localStorage or the DOM.
 */

export const PHOTO_FIELDS = ["selected", "title", "caption", "altText"];
export const SERIES_TEXT_FIELDS = ["title", "summary"];

export class MergeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "MergeError";
    this.details = details;
  }
}

function indexById(list, kind) {
  const map = new Map();
  for (const item of list || []) {
    if (!item || typeof item.id !== "string") {
      throw new MergeError(`${kind} list contains an entry without an id`, { item });
    }
    if (map.has(item.id)) {
      throw new MergeError(`duplicate ${kind} id: ${item.id}`, { id: item.id });
    }
    map.set(item.id, item);
  }
  return map;
}

function equalish(a, b) {
  return a === b;
}

/**
 * Merge one scalar field.
 * Returns { value, conflict } where conflict is present only when both sides
 * changed the field and disagree.
 */
function mergeField(baseVal, localVal, remoteVal) {
  const localChanged = !equalish(localVal, baseVal);
  const remoteChanged = !equalish(remoteVal, baseVal);
  if (localChanged && remoteChanged) {
    if (equalish(localVal, remoteVal)) return { value: localVal };
    return {
      value: localVal, // provisional; the UI shows both candidates and commits the pick
      conflict: { base: baseVal, local: localVal, remote: remoteVal },
    };
  }
  if (localChanged) return { value: localVal };
  if (remoteChanged) return { value: remoteVal };
  return { value: baseVal };
}

function predecessors(ids) {
  const pred = new Map();
  ids.forEach((id, i) => pred.set(id, i === 0 ? null : ids[i - 1]));
  return pred;
}

/**
 * Three-way merge of an ordered list of ids.
 * Requires the same set of ids on every side (structural mismatch is a hard
 * MergeError — adding/removing members is handled out of band).
 *
 * Rule per id: compare its predecessor (the id directly before it) on each
 * side. One side moving it wins; both sides moving it differently is an
 * ordering conflict and stays on the local slot pending a candidate pick.
 *
 * @param kind 'series-order' | 'photo-order'
 */
function mergeOrderedIds(baseIds, localIds, remoteIds, kind, containerId) {
  const sameSet =
    baseIds.length === localIds.length &&
    baseIds.length === remoteIds.length &&
    baseIds.every((id) => localIds.includes(id) && remoteIds.includes(id));
  if (!sameSet) {
    throw new MergeError(`${kind}: id set differs between catalogs for ${containerId}`, {
      base: baseIds,
      local: localIds,
      remote: remoteIds,
    });
  }

  const basePred = predecessors(baseIds);
  const localPred = predecessors(localIds);
  const remotePred = predecessors(remoteIds);

  const conflicts = [];
  let result = localIds.slice(); // tentative: local ordering

  for (const id of baseIds) {
    const b = basePred.get(id);
    const l = localPred.get(id);
    const r = remotePred.get(id);
    const localMoved = l !== b;
    const remoteMoved = r !== b;
    if (localMoved && remoteMoved && l !== r) {
      conflicts.push({
        kind,
        seriesId: containerId,
        photoId: kind === "photo-order" ? id : undefined,
        basePred: b,
        localPred: l,
        remotePred: r,
        localSeq: localIds.slice(),
        remoteSeq: remoteIds.slice(),
        baseSeq: baseIds.slice(),
        chosen: "local", // provisional; the candidate UI offers local vs remote sequence
      });
    } else if (!localMoved && remoteMoved) {
      result = result.filter((x) => x !== id);
      if (r === null) result.unshift(id);
      else result.splice(result.indexOf(r) + 1, 0, id);
    }
  }

  // When both sides re-sequenced the same container, keep ONE candidate for
  // the whole sequence rather than one per displaced member: all per-id
  // conflicts for this container collapse to the first displaced id.
  if (conflicts.length > 1) {
    return { ids: result, conflicts: [conflicts[0]] };
  }
  return { ids: result, conflicts };
}

function assertStructural(baseMap, sideMap, kind, fileField) {
  for (const [id, baseItem] of baseMap) {
    const sideItem = sideMap.get(id);
    if (!sideItem) {
      throw new MergeError(`${kind} ${id} is missing on one side`, { id, kind });
    }
    if (fileField && sideItem[fileField] !== baseItem[fileField]) {
      throw new MergeError(`${kind} ${id} points at a different source file`, {
        id,
        base: baseItem[fileField],
        side: sideItem[fileField],
      });
    }
  }
  for (const id of sideMap.keys()) {
    if (!baseMap.has(id)) {
      throw new MergeError(`${kind} ${id} exists on one side but not in the baseline`, { id, kind });
    }
  }
}

/**
 * Main entry.
 * @returns {{
 *   photos: object[], series: object[], categories: object[],
 *   conflicts: Array, stats: {auto:number, conflicts:number, localOnly:number, remoteOnly:number, agreed:number}
 * }}
 */
export function mergeCatalogs(base, local, remote) {
  const basePhotos = indexById(base.photos, "photo");
  const localPhotos = indexById(local.photos, "photo");
  const remotePhotos = indexById(remote.photos, "photo");
  const baseSeries = indexById(base.series, "series");
  const localSeries = indexById(local.series, "series");
  const remoteSeries = indexById(remote.series, "series");

  // Structural validation — any of these is a sync failure that must roll back.
  assertStructural(basePhotos, localPhotos, "photo", "file");
  assertStructural(basePhotos, remotePhotos, "photo", "file");
  assertStructural(baseSeries, localSeries, "series");
  assertStructural(baseSeries, remoteSeries, "series");

  for (const [id, p] of basePhotos) {
    for (const sideName of ["local", "remote"]) {
      const side = sideName === "local" ? localPhotos : remotePhotos;
      const sp = side.get(id);
      if (sp.seriesId !== p.seriesId) {
        throw new MergeError(`photo ${id} changed series on ${sideName}; cross-series moves are handled out of band`, {
          id,
          [sideName]: sp.seriesId,
          base: p.seriesId,
        });
      }
    }
  }

  const conflicts = [];
  const stats = { auto: 0, conflicts: 0, localOnly: 0, remoteOnly: 0, agreed: 0, unchanged: 0 };

  // ---- Photos -----------------------------------------------------------
  const mergedPhotos = [];
  // Preserve the local series/photo array ordering for output assembly; the
  // per-id fields below decide actual content.
  for (const id of basePhotos.keys()) {
    const b = basePhotos.get(id);
    const l = localPhotos.get(id);
    const r = remotePhotos.get(id);
    const merged = { ...b };
    let photoTouched = false;
    let photoConflict = false;

    for (const field of PHOTO_FIELDS) {
      const { value, conflict } = mergeField(b[field], l[field], r[field]);
      merged[field] = value;
      if (conflict) {
        photoConflict = true;
        stats.conflicts += 1;
        conflicts.push({
          kind: "photo-field",
          photoId: id,
          field,
          base: conflict.base,
          local: conflict.local,
          remote: conflict.remote,
          chosen: null, // candidate selection pending
        });
      } else {
        const lc = l[field] !== b[field];
        const rc = r[field] !== b[field];
        if (lc && rc) {
          stats.agreed += 1;
          photoTouched = true;
        } else if (lc) {
          stats.localOnly += 1;
          photoTouched = true;
        } else if (rc) {
          stats.remoteOnly += 1;
          photoTouched = true;
        }
      }
    }

    if (photoConflict) {
      // keep provisional local values; resolution overwrites them at commit
    } else if (photoTouched) {
      stats.auto += 1;
    } else {
      stats.unchanged += 1;
    }
    mergedPhotos.push(merged);
  }

  // ---- Series text fields ----------------------------------------------
  const mergedSeriesText = new Map();
  for (const id of baseSeries.keys()) {
    const b = baseSeries.get(id);
    const l = localSeries.get(id);
    const r = remoteSeries.get(id);
    const merged = { ...b };
    for (const field of SERIES_TEXT_FIELDS) {
      const { value, conflict } = mergeField(b[field], l[field], r[field]);
      merged[field] = value;
      if (conflict) {
        stats.conflicts += 1;
        conflicts.push({
          kind: "series-field",
          seriesId: id,
          field,
          base: conflict.base,
          local: conflict.local,
          remote: conflict.remote,
          chosen: null,
        });
      }
    }
    mergedSeriesText.set(id, merged);
  }

  // ---- Top-level series order ------------------------------------------
  const topOrder = mergeOrderedIds(
    base.series.map((s) => s.id),
    local.series.map((s) => s.id),
    remote.series.map((s) => s.id),
    "series-order",
    null
  );
  for (const c of topOrder.conflicts) {
    stats.conflicts += 1;
    conflicts.push(c);
  }

  // ---- Per-series photo sequence ---------------------------------------
  const photoSeq = new Map(); // seriesId -> merged ordered photo ids
  for (const id of baseSeries.keys()) {
    const b = baseSeries.get(id);
    const l = localSeries.get(id);
    const r = remoteSeries.get(id);
    const seq = mergeOrderedIds(b.photoIds, l.photoIds, r.photoIds, "photo-order", id);
    for (const c of seq.conflicts) {
      stats.conflicts += 1;
      conflicts.push(c);
    }
    photoSeq.set(id, seq.ids);
  }

  const mergedSeries = topOrder.ids.map((id) => {
    const s = mergedSeriesText.get(id);
    s.photoIds = photoSeq.get(id);
    return s;
  });

  // Stamp photo.order from merged sequences (contiguous, 1-based).
  normalizeOrders(mergedPhotos, mergedSeries);

  return {
    catalog: {
      categories: base.categories,
      series: mergedSeries,
      photos: mergedPhotos,
    },
    conflicts,
    stats,
  };
}

/**
 * Apply candidate picks to a merge result. `resolutions` maps
 *   "photoId:field"            -> "local" | "remote"
 *   "series-field:id:field"    -> "local" | "remote"
 *   "series-order"             -> "local" | "remote" (whole top-level sequence)
 *   "photo-order:seriesId"     -> "local" | "remote" (whole in-series sequence)
 * Returns a new catalog; throws if any conflict is left unresolved.
 */
export function resolveConflicts(mergeResult, resolutions) {
  const keyOf = (c) => {
    if (c.kind === "photo-field") return `${c.photoId}:${c.field}`;
    if (c.kind === "series-field") return `series-field:${c.seriesId}:${c.field}`;
    if (c.kind === "series-order") return "seriesOrder";
    return `photo-order:${c.seriesId}`; // photo-order
  };

  const unresolved = mergeResult.conflicts.filter((c) => !resolutions[keyOf(c)]);
  if (unresolved.length) {
    throw new MergeError(`${unresolved.length} conflict(s) still have no chosen candidate`, {
      unresolved: unresolved.map((c) => c.photoId || c.seriesId),
    });
  }

  const photos = mergeResult.catalog.photos.map((p) => ({ ...p }));
  const series = mergeResult.catalog.series.map((s) => ({ ...s, photoIds: s.photoIds.slice() }));

  const reorder = (container, localSeq, remoteSeq, side) => {
    const seq = side === "remote" ? remoteSeq : localSeq;
    const byId = new Map(container.map((x) => [x.id, x]));
    container.length = 0;
    seq.forEach((id) => container.push(byId.get(id)));
  };

  for (const c of mergeResult.conflicts) {
    if (c.kind === "photo-field") {
      const side = resolutions[`${c.photoId}:${c.field}`];
      const photo = photos.find((p) => p.id === c.photoId);
      photo[c.field] = side === "remote" ? c.remote : c.local;
    } else if (c.kind === "series-field") {
      const side = resolutions[`series-field:${c.seriesId}:${c.field}`];
      const s = series.find((x) => x.id === c.seriesId);
      s[c.field] = side === "remote" ? c.remote : c.local;
    } else if (c.kind === "series-order") {
      const side = resolutions.seriesOrder;
      reorder(series, c.localSeq, c.remoteSeq, side);
    } else if (c.kind === "photo-order") {
      const side = resolutions[`photo-order:${c.seriesId}`];
      const seq = (side === "remote" ? c.remoteSeq : c.localSeq).slice();
      const s = series.find((x) => x.id === c.seriesId);
      s.photoIds = seq;
      // Stamp order onto the photos themselves so normalizeOrders' order-based
      // sort cannot undo the chosen sequence.
      seq.forEach((id, i) => {
        const p = photos.find((x) => x.id === id);
        if (p) p.order = i + 1;
      });
    }
  }

  normalizeOrders(photos, series);
  return { categories: mergeResult.catalog.categories, series, photos };
}

/**
 * Normalize a series to one source of truth for sequencing:
 * reorder photoIds by the current photo.order values, then stamp order
 * contiguously (1-based). Safe to call whether the caller changed order
 * values or photoIds.
 */
export function normalizeOrders(photos, series) {
  const byId = new Map(photos.map((p) => [p.id, p]));
  for (const s of series) {
    const known = s.photoIds.filter((id) => byId.has(id));
    const stableIndex = new Map(known.map((id, i) => [id, i]));
    known
      .map((id) => byId.get(id))
      .sort((a, b) => (a.order - b.order) || (stableIndex.get(a.id) - stableIndex.get(b.id)))
      .forEach((p, i) => {
        p.order = i + 1;
      });
    s.photoIds = known
      .map((id) => byId.get(id))
      .sort((a, b) => a.order - b.order)
      .map((p) => p.id);
  }
}
