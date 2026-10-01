/**
 * selectors.js — every derived view of the catalog is computed here from one
 * source of truth, so after a confirmed merge we recompute series covers,
 * lightbox order and the filtered result set together.
 */

/** All photos of a series in canonical order (photo.order, 1-based). */
export function photosOfSeries(catalog, seriesId) {
  const s = catalog.series.find((x) => x.id === seriesId);
  if (!s) return [];
  return s.photoIds
    .map((id) => catalog.photos.find((p) => p.id === id))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

/** Series cover = first selected photo in series order; fallback to first photo. */
export function seriesCover(catalog, seriesId) {
  const photos = photosOfSeries(catalog, seriesId);
  return photos.find((p) => p.selected) || photos[0] || null;
}

export function selectedCount(catalog, seriesId) {
  return photosOfSeries(catalog, seriesId).filter((p) => p.selected).length;
}

/**
 * The result set. Scope:
 *   { categoryId?: string, seriesId?: string, selectedOnly?: boolean }
 * Photos are ordered series-by-series (in catalog series order) and by
 * photo.order within each series. The lightbox walks exactly this list.
 */
export function resultSet(catalog, scope = {}) {
  let series = catalog.series.slice();
  if (scope.seriesId) series = series.filter((s) => s.id === scope.seriesId);
  if (scope.categoryId) series = series.filter((s) => s.category === scope.categoryId);

  const out = [];
  for (const s of series) {
    for (const p of photosOfSeries(catalog, s.id)) {
      if (scope.selectedOnly && !p.selected) continue;
      out.push(p);
    }
  }
  return out;
}

export function categoryById(catalog, id) {
  return catalog.categories.find((c) => c.id === id);
}

export function seriesById(catalog, id) {
  return catalog.series.find((s) => s.id === id);
}

export function photoById(catalog, id) {
  return catalog.photos.find((p) => p.id === id);
}

/** Deep clone for snapshotting (baseline / rollback). */
export function cloneCatalog(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}
