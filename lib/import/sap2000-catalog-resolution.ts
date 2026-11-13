/** Conservative SAP catalog matching for editable geometry; never engineering validation. */
export interface SapCatalogReference {
  sourceMemberId: string;
  sectionName?: string | null;
  materialName?: string | null;
}
export interface CatalogEntry { id: string; name: string }
export interface SapCatalogResolution {
  sourceMemberId: string;
  sectionId: string;
  materialId: string;
  sectionStatus: "matched" | "default-missing" | "default-ambiguous";
  materialStatus: "matched" | "default-missing" | "default-ambiguous";
  warnings: string[];
  analysisReady: false;
}
/** Match exact normalized names only; ambiguous names must never silently resolve. */
export function resolveSapCatalogReference(
  source: SapCatalogReference,
  sections: readonly CatalogEntry[],
  materials: readonly CatalogEntry[],
  defaultSectionId: string,
  defaultMaterialId: string,
): SapCatalogResolution {
  if (!sections.some(x => x.id === defaultSectionId) ||
      !materials.some(x => x.id === defaultMaterialId)) {
    throw new Error("SAP_CATALOG_DEFAULT_NOT_FOUND");
  }
  const match = (name: string | null | undefined, entries: readonly CatalogEntry[],
    fallback: string, kind: "section" | "material") => {
    const normalized = name?.trim().toLocaleLowerCase("en-US") ?? "";
    const candidates = normalized
      ? entries.filter(x => x.name.trim().toLocaleLowerCase("en-US") === normalized)
      : [];
    const status = candidates.length === 1 ? "matched" as const :
      candidates.length > 1 ? "default-ambiguous" as const : "default-missing" as const;
    return {id: candidates.length === 1 ? candidates[0].id : fallback,
      status, warning: status === "matched" ? null :
        `SAP ${kind} "${name || "(unspecified)"}" ${status === "default-ambiguous" ? "ambiguous" : "not found"}; editable default assigned (unverified).`};
  };
  const section = match(source.sectionName, sections, defaultSectionId, "section");
  const material = match(source.materialName, materials, defaultMaterialId, "material");
  return {
    sourceMemberId: source.sourceMemberId,
    sectionId: section.id, materialId: material.id,
    sectionStatus: section.status, materialStatus: material.status,
    warnings: [section.warning, material.warning].filter((x): x is string => x !== null),
    analysisReady: false,
  };
}
