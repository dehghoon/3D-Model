import assert from "node:assert/strict";
import test from "node:test";
import { simpleBoundary, buildingLevels } from "../lib/editor/simple-building";
import { createStarterModelV05 } from "../lib/default-model-v05";
import { createSurfaceFromPoints } from "../lib/editor/surface-draw-controller";
test("building boundaries use the floor and preserve canonical surface validation", () => {
  const model = createStarterModelV05(),
    a = { x: 20, y: 20, z: 0 },
    b = { x: 25, y: 24, z: 0 };
  const wall = simpleBoundary("wall", a, b, 3),
    slab = simpleBoundary("slab", a, b);
  assert.deepEqual(
    wall.map((p) => p.z),
    [0, 0, 3, 3],
  );
  assert.deepEqual(
    slab.map((p) => [p.x, p.y]),
    [
      [20, 20],
      [25, 20],
      [25, 24],
      [20, 24],
    ],
  );
  for (const type of ["wall", "slab"] as const)
    assert.equal(
      createSurfaceFromPoints(model, type, type === "wall" ? wall : slab).model
        .surfaces.length,
      model.surfaces.length + 1,
    );
  assert.throws(() => simpleBoundary("wall", a, b, 0), /higher/);
  assert.throws(
    () => simpleBoundary("slab", a, { ...b, z: 3 }),
    /selected floor/,
  );
  assert.throws(() => simpleBoundary("slab", a, { ...b, x: 20 }), /nonzero/);
  assert.equal(
    buildingLevels(model, { levelId: "deleted", endLevelId: "deleted" }).level
      ?.id,
    [...model.levels].sort((a, b) => a.elevation - b.elevation)[0].id,
  );
});
