import assert from "node:assert/strict";
import test from "node:test";
import { createStarterModelV05 } from "../lib/default-model-v05";
import { assertCanonicalV05 } from "../lib/core-v05";

test("section reassignment persists for one selected member without mutating source", () => {
  const model = createStarterModelV05();
  assert.ok(model.members.length);
  assert.ok(model.sections.length);
  const member = model.members[0];
  const sectionId = model.sections[0].id;
  const updated = {
    ...model,
    members: model.members.map(item => item.id === member.id ? { ...item, sectionId } : item),
  };
  assertCanonicalV05(updated);
  assert.equal(updated.members.find(item => item.id === member.id)?.sectionId, sectionId);
  assert.equal(model.members[0].sectionId, member.sectionId);
});

test("section reassignment changes only selected member IDs", () => {
  const model = createStarterModelV05();
  assert.ok(model.members.length >= 2);
  const selected = new Set(model.members.slice(0, 2).map(member => member.id));
  const sectionId = model.sections[0].id;
  const updated = {
    ...model,
    members: model.members.map(member => selected.has(member.id) ? { ...member, sectionId } : member),
  };
  assertCanonicalV05(updated);
  for (const member of updated.members) {
    assert.equal(member.sectionId, selected.has(member.id) ? sectionId : model.members.find(old => old.id === member.id)?.sectionId);
  }
});
