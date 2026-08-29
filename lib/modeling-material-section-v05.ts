import type { Material, Section, StructuralModel, UnitValue } from "@linkoteq/structural-core";
import { assertCanonicalV05 } from "./core-v05";

function assertUnitValue(value: UnitValue, code: string): void {
  if (!Number.isFinite(value.value) || !value.unit.trim()) throw new Error(code);
}

function replaceById<T extends { id: string }>(items: T[], entity: T): T[] {
  return items.some((item) => item.id === entity.id)
    ? items.map((item) => (item.id === entity.id ? entity : item))
    : [...items, entity];
}

export function upsertCanonicalMaterialV05(
  model: StructuralModel,
  material: Material,
): StructuralModel {
  assertCanonicalV05(model);
  if (!material.id.trim()) throw new Error("MATERIAL_ID_REQUIRED");
  if (!material.name.trim()) throw new Error("MATERIAL_NAME_REQUIRED");
  assertUnitValue(material.analysis.E, `MATERIAL_E_INVALID:${material.id}`);
  assertUnitValue(material.analysis.G, `MATERIAL_G_INVALID:${material.id}`);
  assertUnitValue(material.analysis.rho, `MATERIAL_RHO_INVALID:${material.id}`);
  if (!Number.isFinite(material.analysis.nu)) throw new Error(`MATERIAL_NU_INVALID:${material.id}`);
  if (material.analysis.fy) assertUnitValue(material.analysis.fy, `MATERIAL_FY_INVALID:${material.id}`);

  const next = { ...model, materials: replaceById(model.materials, material) };
  assertCanonicalV05(next);
  return next;
}

export function upsertCanonicalSectionV05(
  model: StructuralModel,
  section: Section,
): StructuralModel {
  assertCanonicalV05(model);
  if (!section.id.trim()) throw new Error("SECTION_ID_REQUIRED");
  if (!section.family.trim()) throw new Error("SECTION_FAMILY_REQUIRED");
  assertUnitValue(section.analysis.A, `SECTION_A_INVALID:${section.id}`);
  assertUnitValue(section.analysis.Iy, `SECTION_IY_INVALID:${section.id}`);
  assertUnitValue(section.analysis.Iz, `SECTION_IZ_INVALID:${section.id}`);
  assertUnitValue(section.analysis.J, `SECTION_J_INVALID:${section.id}`);

  const next = { ...model, sections: replaceById(model.sections, section) };
  assertCanonicalV05(next);
  return next;
}
