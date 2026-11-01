import test from "node:test";
import assert from "node:assert/strict";
import { assignDiaphragm } from "../lib/diaphragms-v05";
import { createSimpleFrame, DEFAULT_FRAME } from "../lib/simple-frame";

function fixture() {
  const model = createSimpleFrame(DEFAULT_FRAME);
  const level = model.levels.find(level => model.nodes.some(node => node.levelId === level.id));
  assert.ok(level, "fixture must contain a level with nodes");
  const nodes = model.nodes.filter(node => node.levelId === level.id);
  assert.ok(nodes.length > 0);
  return { model, level, nodes };
}

test("rigid diaphragm assignment preserves canonical targets and other model entities", () => {
  const { model, level, nodes } = fixture();
  const result = assignDiaphragm(model, {
    id: "D1", type: "rigid", levelId: level.id, nodeIds: [nodes[0].id], surfaceIds: [],
  });
  assert.equal(result.diaphragms.length, model.diaphragms.length + 1);
  assert.deepEqual(result.diaphragms.at(-1), {
    id: "D1", type: "rigid", levelId: level.id, nodeIds: [nodes[0].id], surfaceIds: [],
  });
  assert.equal(result.members, model.members);
  assert.equal(result.nodes, model.nodes);
  assert.equal(model.diaphragms.some(d => d.id === "D1"), false);
});

test("semi-rigid diaphragm re-assignment replaces same ID without duplicating", () => {
  const { model, level, nodes } = fixture();
  const input = { id: "D1", type: "semi-rigid" as const, levelId: level.id, nodeIds: [nodes[0].id], surfaceIds: [] };
  const first = assignDiaphragm(model, input);
  const second = assignDiaphragm(first, input);
  assert.equal(second.diaphragms.filter(d => d.id === "D1").length, 1);
  assert.equal(second.diaphragms.find(d => d.id === "D1")?.type, "semi-rigid");
  assert.deepEqual(JSON.parse(JSON.stringify(second)).diaphragms, second.diaphragms);
});

test("diaphragm rejects unknown levels, targets, duplicate targets and level mismatch", () => {
  const { model, level, nodes } = fixture();
  const input = { id: "D1", type: "rigid" as const, levelId: level.id, nodeIds: [nodes[0].id], surfaceIds: [] };
  assert.throws(() => assignDiaphragm(model, {...input, levelId: "missing"}), /UNKNOWN_DIAPHRAGM_LEVEL/);
  assert.throws(() => assignDiaphragm(model, {...input, nodeIds: ["missing"]}), /UNKNOWN_DIAPHRAGM_NODE/);
  assert.throws(() => assignDiaphragm(model, {...input, nodeIds: [nodes[0].id,nodes[0].id]}), /DUPLICATE_DIAPHRAGM_TARGET/);
  const other = model.levels.find(l => l.id !== level.id);
  if (other) assert.throws(() => assignDiaphragm(model, {...input, levelId: other.id}), /DIAPHRAGM_NODE_LEVEL_MISMATCH/);
});

test("diaphragm survives JSON save/reopen and remains editable", () => {
  const { model, level, nodes } = fixture();
  const assigned = assignDiaphragm(model, {
    id: "D1", type: "rigid", levelId: level.id, nodeIds: [nodes[0].id], surfaceIds: [],
  });
  const exportedJson = JSON.stringify(assigned, null, 2);
  const reopened = JSON.parse(exportedJson) as typeof assigned;
  assert.deepEqual(reopened.diaphragms, assigned.diaphragms);
  assert.deepEqual(reopened.nodes, assigned.nodes);
  const edited = assignDiaphragm(reopened, {
    id: "D1", type: "semi-rigid", levelId: level.id,
    nodeIds: nodes.slice(0, 2).map(node => node.id), surfaceIds: [],
  });
  assert.equal(edited.diaphragms.length, 1);
  assert.equal(edited.diaphragms[0].type, "semi-rigid");
  assert.deepEqual(edited.diaphragms[0].nodeIds, nodes.slice(0, 2).map(node => node.id));
});
