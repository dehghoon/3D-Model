import type { Level, StructuralModel } from "@linkoteq/structural-core";

import { assertCanonicalV05 } from "../core-v05";

export interface CreateLevelInput {
  name: string;
  elevation: number;
}

export interface UpdateLevelInput {
  name: string;
  elevation: number;
}

export interface LevelMutationResult {
  model: StructuralModel;
  level: Level;
}

function requireLevelId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error("LEVEL_ID_REQUIRED");
  return id;
}

function requireLevelName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error("LEVEL_NAME_REQUIRED");
  return name;
}

function requireFiniteElevation(value: number): number {
  if (!Number.isFinite(value)) throw new Error("LEVEL_ELEVATION_MUST_BE_FINITE");
  return value;
}

function nextLevelId(model: StructuralModel): string {
  const used = new Set(model.levels.map((level) => level.id));
  let index = 1;
  while (used.has(`L${index}`)) index += 1;
  return `L${index}`;
}

export function createLevel(
  model: StructuralModel,
  input: CreateLevelInput,
): LevelMutationResult {
  assertCanonicalV05(model);

  const level: Level = {
    id: nextLevelId(model),
    name: requireLevelName(input.name),
    elevation: requireFiniteElevation(input.elevation),
  };

  const nextModel: StructuralModel = {
    ...model,
    levels: [...model.levels, level],
  };
  assertCanonicalV05(nextModel);

  return { model: nextModel, level };
}

export function updateLevel(
  model: StructuralModel,
  levelId: string,
  input: UpdateLevelInput,
): LevelMutationResult {
  assertCanonicalV05(model);

  const id = requireLevelId(levelId);
  const existing = model.levels.find((level) => level.id === id);
  if (!existing) throw new Error(`UNKNOWN_LEVEL:${id}`);

  const level: Level = {
    id: existing.id,
    name: requireLevelName(input.name),
    elevation: requireFiniteElevation(input.elevation),
  };

  const nextModel: StructuralModel = {
    ...model,
    levels: model.levels.map((item) => (item.id === id ? level : item)),
  };
  assertCanonicalV05(nextModel);

  return { model: nextModel, level };
}

export function deleteLevel(
  model: StructuralModel,
  levelId: string,
): StructuralModel {
  assertCanonicalV05(model);

  const id = requireLevelId(levelId);
  if (!model.levels.some((level) => level.id === id)) {
    throw new Error(`UNKNOWN_LEVEL:${id}`);
  }

  const nextModel: StructuralModel = {
    ...model,
    levels: model.levels.filter((level) => level.id !== id),
  };
  assertCanonicalV05(nextModel);

  return nextModel;
}
