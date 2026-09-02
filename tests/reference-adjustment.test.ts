import assert from "node:assert/strict";
import test from "node:test";
import type { StructuralModel } from "@linkoteq/structural-core";
import {
  adjustModelToGridEdits,
  adjustModelToLevelEdit,
} from "../lib/modeling/reference-adjustment-service";

function baseModel(): StructuralModel {
  return {
    levels: [
      { id: "L1", name: "Level 1", elevation: 0 },
      { id: "L2", name: "Level 2", elevation: 3 },
    ],
    grids: [
      {
        id: "G1",
        label: "1",
        start: { x: 0, y: -5, z: 0 },
        end: { x: 0, y: 5, z: 0 },
      },
      {
        id: "GA",
        label: "A",
        start: { x: -5, y: 0, z: 0 },
        end: { x: 5, y: 0, z: 0 },
      },
    ],
    nodes: [
      {
        id: "N1",
        position: { x: 0, y: 0, z: 0 },
        levelId: "L1",
      },
      {
        id: "N2",
        position: { x: 4, y: 0, z: 0 },
        levelId: "L1",
      },
      {
        id: "N3",
        position: { x: 0, y: 2, z: 3 },
        levelId: "L2",
      },
    ],
    members: [
      {
        id: "M1",
        startNodeId: "N1",
        endNodeId: "N2",
      },
    ],
    surfaces: [],
  } as unknown as StructuralModel;
}

test("grid adjustment moves nodes on the edited grid and preserves stable references", () => {
  const before = baseModel();
  const edited = {
    ...before,
    grids: before.grids.map((grid) =>
      grid.id === "G1"
        ? {
            ...grid,
            start: { ...grid.start, x: 2 },
            end: { ...grid.end, x: 2 },
          }
        : grid,
    ),
  };

  const result = adjustModelToGridEdits(before, edited);

  assert.equal(result.nodes.find((node) => node.id === "N1")?.position.x, 2);
  assert.equal(result.nodes.find((node) => node.id === "N3")?.position.x, 2);
  assert.equal(result.nodes.find((node) => node.id === "N2")?.position.x, 4);
  assert.equal(result.members[0].startNodeId, "N1");
  assert.equal(result.members[0].endNodeId, "N2");
});

test("level adjustment moves nodes assigned to the edited level", () => {
  const before = baseModel();
  const originalLevel = before.levels.find((level) => level.id === "L1")!;
  const editedLevel = { ...originalLevel, elevation: 4 };
  const withEditedLevel = {
    ...before,
    levels: before.levels.map((level) =>
      level.id === editedLevel.id ? editedLevel : level,
    ),
  };

  const result = adjustModelToLevelEdit(
    withEditedLevel,
    originalLevel,
    editedLevel,
  );

  assert.equal(result.nodes.find((node) => node.id === "N1")?.position.z, 4);
  assert.equal(result.nodes.find((node) => node.id === "N2")?.position.z, 4);
  assert.equal(result.nodes.find((node) => node.id === "N3")?.position.z, 3);
});
