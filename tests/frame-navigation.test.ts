import assert from "node:assert/strict";
import test from "node:test";
import {
  INITIAL_FRAME_VIEW,
  zoomFrame,
  framePoint,
} from "../lib/frame-navigation";
import {
  completeCatalogMaterials,
  simpleDefaultSection,
} from "../lib/core-frame-catalogs";
import {
  verifiedLegacySteel350W,
  ciscRecordToCoreSection,
  isCiscRecordCoreAssignable,
} from "../lib/cisc-section-library-v05";
import { readFileSync } from "node:fs";
test("zoom preserves the cursor anchor, respects limits and reverses accurately", () => {
  const base = INITIAL_FRAME_VIEW,
    anchor = { x: 200, y: 100 };
  const next = zoomFrame(base, 0.5, anchor);
  assert.equal(
    (anchor.x - base.x) / base.width,
    (anchor.x - next.x) / next.width,
  );
  assert.equal(
    (anchor.y - base.y) / base.height,
    (anchor.y - next.y) / next.height,
  );
  assert.deepEqual(zoomFrame(next, 2, anchor), base);
  assert.equal(zoomFrame(base, 0.0001, anchor).width, 82);
  assert.equal(zoomFrame(base, 100, anchor).width, 8200);
});
test("pointer coordinates account for SVG letterboxing and existing pan/zoom", () => {
  const view = { x: 100, y: 200, width: 410, height: 295 };
  const bounds = { left: 10, top: 20, width: 1000, height: 590 };
  assert.deepEqual(framePoint(view, bounds, 510, 315), { x: 305, y: 347.5 });
});
test("only complete numeric GitHub material records can be assigned automatically", () => {
  const material = verifiedLegacySteel350W();
  assert.deepEqual(
    completeCatalogMaterials([
      { id: "A36", name: "ASTM A36", type: "steel" },
      material,
      {
        ...material,
        analysis: { ...material.analysis, E: { value: NaN, unit: "MPa" } },
      },
    ]),
    [material],
  );
});
test("authorized nearby defaults resolve to real complete records and keep single-angle identity", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/simple-core-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  const catalog = {
    ref: "test",
    locations: [],
    materials: [],
    records: fixture.sections,
    sections: fixture.sections
      .filter(isCiscRecordCoreAssignable)
      .map(ciscRecordToCoreSection),
    datasetVersion: fixture.dataset_version,
  };
  assert.equal(simpleDefaultSection(catalog, "beam")?.designation, "W310x33");
  assert.equal(simpleDefaultSection(catalog, "column")?.designation, "W250x49");
  assert.equal(
    simpleDefaultSection(catalog, "brace")?.designation,
    "L76x76x6.4",
  );
  assert.equal(simpleDefaultSection(catalog, "brace")?.family, "L");
});
