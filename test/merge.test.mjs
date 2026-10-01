import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mergeCatalogs, resolveConflicts, normalizeOrders, MergeError } from "../public/js/app/merge.js";
import { photosOfSeries, seriesCover, resultSet } from "../public/js/app/selectors.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, "..", p), "utf8"));

const base = read("public/data/baseline.json");
const remote = read("public/data/remote.json");
const broken = read("public/data/remote-broken.json");

/** Apply the photographer's offline "venue edits" to a baseline clone. */
function venueEdits(src) {
  const local = JSON.parse(JSON.stringify(src));
  const photo = (id) => local.photos.find((p) => p.id === id);
  const series = (id) => local.series.find((s) => s.id === id);

  // Local-only fast-forward edits (station never touched these)
  photo("portrait-01").caption = "VENUE EDIT: light on eyelids alone";
  photo("portrait-04").selected = false;

  // Both sides edited differently -> photo-field candidates
  photo("portrait-03").caption = "VENUE EDIT: breath held, neither laugh nor frown";
  // portrait-02: venue rewrites the caption; station rewrote it too AND
  // dropped the selection -> same photo carries multiple candidate fields.
  photo("portrait-02").caption = "VENUE EDIT: the hair falls like a drawn curtain";
  photo("landscape-03").caption = "VENUE EDIT: the mound fills the frame";
  photo("pastoral-04").caption = "VENUE EDIT: cattle scattered like seed";
  photo("landscape-05").selected = false; // station dropped it too — same change, no conflict

  // Remote-only: landscape-01 + portrait-05 dropped at the station

  // Both sides reorder Gaze photos differently -> photo-order candidate
  series("gaze").photoIds = ["portrait-02", "portrait-01", "portrait-03", "portrait-04", "portrait-05"];
  photo("portrait-02").order = 1;
  photo("portrait-01").order = 2;
  photo("portrait-03").order = 3;
  photo("portrait-04").order = 4;
  photo("portrait-05").order = 5;
  // Both sides reorder highland photos differently -> photo-order candidate
  photo("pastoral-02").order = 1;
  photo("pastoral-03").order = 2;
  photo("pastoral-01").order = 3;
  photo("pastoral-04").order = 4;
  series("highland-pastoral").photoIds = ["pastoral-02", "pastoral-03", "pastoral-01", "pastoral-04"];

  // Local reorders top-level series: highland first; remote moved wilderness first
  local.series.sort((a, b) => {
    const rank = { "highland-pastoral": 0, gaze: 1, wilderness: 2 };
    return rank[a.id] - rank[b.id];
  });
  normalizeOrders(local.photos, local.series);
  return local;
}

test("fast-forward: one-sided edits apply automatically", () => {
  const local = venueEdits(base);
  const { catalog, conflicts, stats } = mergeCatalogs(base, local, remote);

  // remote-only selection drops
  assert.equal(catalog.photos.find((p) => p.id === "landscape-01").selected, false);
  assert.equal(catalog.photos.find((p) => p.id === "portrait-05").selected, false);
  // local-only edits
  assert.match(catalog.photos.find((p) => p.id === "portrait-01").caption, /VENUE/);
  assert.equal(catalog.photos.find((p) => p.id === "portrait-04").selected, false);
  // both sides dropped landscape-05 — same value, auto-applied
  assert.equal(catalog.photos.find((p) => p.id === "landscape-05").selected, false);
  assert.ok(stats.localOnly >= 1);
  assert.ok(stats.remoteOnly >= 2);
  // 4 photo-field caption conflicts + top series order + two in-series orders
  assert.equal(conflicts.length, 7);
});

test("both sides edited the same photo differently -> candidates kept", () => {
  const local = venueEdits(base);
  const { conflicts } = mergeCatalogs(base, local, remote);

  const fields = new Set(conflicts.map((c) => `${c.photoId || ""}:${c.field || c.kind}`));
  // portrait-02 carries TWO candidate fields on one photo (caption text and
  // membership in the reordered gaze sequence)
  assert.ok(fields.has("portrait-02:caption"), "caption conflict on portrait-02");
  assert.ok(fields.has("landscape-03:caption"), "caption conflict on landscape-03");
  assert.ok(fields.has("portrait-03:caption"), "caption conflict on portrait-03");
  assert.ok(fields.has("pastoral-04:caption"), "caption conflict on pastoral-04");
  assert.ok(conflicts.some((c) => c.kind === "photo-order" && c.seriesId === "gaze"), "gaze sequence conflict");
  assert.ok(conflicts.some((c) => c.kind === "series-order"), "top-level series order conflict");
  assert.ok(conflicts.some((c) => c.kind === "photo-order" && c.seriesId === "highland-pastoral"), "highland sequence conflict");
});

test("both sides changed to the same value -> no conflict", () => {
  const local = JSON.parse(JSON.stringify(base));
  const rem = JSON.parse(JSON.stringify(remote));
  local.photos.find((p) => p.id === "landscape-02").caption = "SAME EDIT";
  rem.photos.find((p) => p.id === "landscape-02").caption = "SAME EDIT";
  const { catalog, conflicts } = mergeCatalogs(base, local, rem);
  assert.equal(catalog.photos.find((p) => p.id === "landscape-02").caption, "SAME EDIT");
  assert.equal(conflicts.length, 0);
});

test("structural mismatch -> MergeError (caller rolls back to baseline)", () => {
  const local = venueEdits(base);
  assert.throws(() => mergeCatalogs(base, local, broken), MergeError);
});

test("confirming with candidates: unresolved -> throws; resolved -> recomputed catalog", () => {
  const local = venueEdits(base);
  const result = mergeCatalogs(base, local, remote);

  assert.throws(() => resolveConflicts(result, {}), MergeError);

  const resolutions = {};
  for (const c of result.conflicts) {
    if (c.kind === "photo-field") resolutions[`${c.photoId}:${c.field}`] = "remote";
    else if (c.kind === "series-field") resolutions[`series-field:${c.seriesId}:${c.field}`] = "remote";
    else if (c.kind === "series-order") resolutions.seriesOrder = "remote";
    else resolutions[`photo-order:${c.seriesId}`] = "remote";
  }
  const merged = resolveConflicts(result, resolutions);

  // station dropped portrait-02 (remote-only); station caption candidate wins
  assert.equal(merged.photos.find((p) => p.id === "portrait-02").selected, false);
  assert.match(merged.photos.find((p) => p.id === "portrait-02").caption, /STATION/);
  // remote caption candidate
  assert.match(merged.photos.find((p) => p.id === "landscape-03").caption, /STATION/);

  // orders renumbered contiguously per series
  for (const s of merged.series) {
    const orders = photosOfSeries(merged, s.id).map((p) => p.order);
    assert.deepEqual(orders, orders.map((_, i) => i + 1), `${s.id} orders contiguous`);
  }

  // derived views recompute together: cover follows selected + order
  const cover = seriesCover(merged, "wilderness");
  assert.equal(cover.selected, true);
  assert.notEqual(cover.id, "landscape-01", "dropped photo cannot be the cover");
  assert.notEqual(cover.id, "landscape-05", "dropped photo cannot be the cover");
  assert.equal(cover.id, "landscape-02");

  // result set respects scope and canonical order
  const gaze = resultSet(merged, { seriesId: "gaze" });
  assert.equal(gaze[0].id, "portrait-04", "remote Gaze reordering put portrait-04 first");
  const gazeSelected = resultSet(merged, { seriesId: "gaze", selectedOnly: true });
  assert.ok(!gazeSelected.some((p) => !p.selected));
  // station dropped portrait-02 + portrait-05; venue dropped portrait-04 -> 2 remain
  assert.equal(gazeSelected.length, 2);
});

test("local candidate pick preserves local reorder", () => {
  const local = venueEdits(base);
  const result = mergeCatalogs(base, local, remote);
  const resolutions = {};
  for (const c of result.conflicts) {
    if (c.kind === "photo-field") resolutions[`${c.photoId}:${c.field}`] = "local";
    else if (c.kind === "series-field") resolutions[`series-field:${c.seriesId}:${c.field}`] = "local";
    else if (c.kind === "series-order") resolutions.seriesOrder = "local";
    else resolutions[`photo-order:${c.seriesId}`] = "local";
  }
  const merged = resolveConflicts(result, resolutions);
  assert.match(merged.photos.find((p) => p.id === "portrait-02").caption, /VENUE/);
  assert.equal(merged.series[0].id, "highland-pastoral", "local top-level order kept");
  const gaze = resultSet(merged, { seriesId: "gaze" });
  assert.equal(gaze[0].id, "portrait-02", "local intra-series order kept");
});
