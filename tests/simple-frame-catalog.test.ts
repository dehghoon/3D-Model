import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createSimpleFrame,
  DEFAULT_FRAME,
  type FrameLayout,
} from "../lib/simple-frame";
import {
  loadFrameCatalogs,
  requestedSection,
} from "../lib/core-frame-catalogs";
import {
  ciscRecordToCoreSection,
  isCiscRecordCoreAssignable,
} from "../lib/cisc-section-library-v05";
import { gridDisplayEndpoints } from "../lib/visualization/grid-display";
const data = JSON.parse(
  readFileSync(
    new URL("./fixtures/simple-core-catalog.json", import.meta.url),
    "utf8",
  ),
);
test("catalog defaults never substitute missing or incomplete requested sections", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    new Response(
      JSON.stringify(
        String(input).includes("core-catalogs")
          ? {
              ref: data.sourceCoreRef,
              locations: [],
              materials: [],
              sectionDatasetVersion: data.dataset_version,
            }
          : data,
      ),
    );
  try {
    const catalog = await loadFrameCatalogs();
    assert.equal(requestedSection(catalog, "column")?.designation, "W250x49");
    assert.equal(requestedSection(catalog, "beam"), undefined);
    assert.equal(requestedSection(catalog, "brace"), undefined);
    assert.ok(
      !isCiscRecordCoreAssignable(
        data.sections.find((s: any) => s.designation === "2LE76x76x6.4"),
      ),
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("braces use selected grids, storeys and patterns and share existing canonical nodes", () => {
  const template = createSimpleFrame(DEFAULT_FRAME);
  const section = ciscRecordToCoreSection(
    data.sections.find((s: any) => s.designation === "W250x49"),
  );
  template.sections.push(section);
  const layout: FrameLayout = {
    ...DEFAULT_FRAME,
    defaults: { column: section.id, brace: section.id },
    braces: [
      {
        id: "x-1",
        direction: "x",
        frame: 1,
        from: 1,
        to: 3,
        storey: -1,
        pattern: "X",
      },
      {
        id: "y-1",
        direction: "y",
        frame: 0,
        from: 0,
        to: 1,
        storey: 0,
        pattern: "/",
      },
    ],
  };
  const m = createSimpleFrame(layout, template);
  assert.equal(m.nodes.length, template.nodes.length);
  assert.equal(m.members.filter((x) => x.type === "brace").length, 5);
  assert.ok(
    m.members
      .filter((x) => x.type === "column")
      .every((x) => x.sectionId === section.id),
  );
  const r = m.members.find((x) => x.id === "SF-R-x-1-1-up")!;
  assert.equal(r.startNodeId, "SF-N1-1-0");
  assert.equal(r.endNodeId, "SF-N3-1-1");
  const next = createSimpleFrame(
    { ...layout, x: [7, 5, 5], heights: [4, 3] },
    m,
  );
  assert.equal(next.nodes.find((n) => n.id === r.startNodeId)?.position.x, 7);
  assert.equal(next.nodes.find((n) => n.id === r.endNodeId)?.position.z, 4);
  assert.throws(
    () =>
      createSimpleFrame(
        {
          ...layout,
          braces: [
            layout.braces![0],
            { ...layout.braces![0], id: "duplicate" },
          ],
        },
        template,
      ),
    /overlap/,
  );
  assert.throws(
    () => createSimpleFrame({ ...layout, x: [5] }, template),
    /outside/,
  );
  const pending = createSimpleFrame(
    { ...layout, defaults: { column: section.id } },
    template,
  );
  assert.equal(pending.members.filter((m) => m.type === "brace").length, 0);
  assert.equal(
    JSON.parse(String(pending.project.metadata?.simpleFrame)).braces.length,
    2,
  );
});
test("single-member overrides survive regeneration, default changes and JSON export", () => {
  const m = createSimpleFrame(DEFAULT_FRAME);
  const beam = m.members.find((x) => x.type === "beam")!;
  const column = m.members.find((x) => x.type === "column")!;
  const other = ciscRecordToCoreSection(
    data.sections.find((s: any) => s.designation === "W250x49"),
  );
  m.sections.push(other);
  const layout: FrameLayout = {
    ...DEFAULT_FRAME,
    overrides: {
      [beam.id]: { sectionId: other.id, rotationDeg: 90 },
      [column.id]: { excluded: true },
    },
  };
  const next = createSimpleFrame({ ...layout, y: [6, 5] }, m);
  assert.equal(next.members.find((x) => x.id === beam.id)?.sectionId, other.id);
  assert.equal(next.members.find((x) => x.id === beam.id)?.rotationDeg, 90);
  assert.ok(!next.members.some((x) => x.id === column.id));
  assert.throws(
    () =>
      createSimpleFrame(
        { ...layout, overrides: { [beam.id]: { sectionId: "unknown" } } },
        m,
      ),
    /not in/,
  );
});
test("both endpoint labels extend outside physical footprint even on corner grids", () => {
  const m = createSimpleFrame({ ...DEFAULT_FRAME, x: [5, 5, 5, 5] });
  const before = JSON.stringify(m.grids);
  for (const grid of m.grids) {
    const display = gridDisplayEndpoints(grid, m.nodes);
    if (grid.id.startsWith("SF-GX")) {
      assert.ok(display.start.y < 0);
      assert.ok(display.end.y > 10);
    } else {
      assert.ok(display.start.x < 0);
      assert.ok(display.end.x > 20);
    }
  }
  assert.equal(JSON.stringify(m.grids), before);
});
