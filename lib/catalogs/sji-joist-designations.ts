/** Source-verified SJI K-series designation subset (not an exhaustive catalog).
 * Source: SJI 100-2020, Standard LRFD Load Table, K-Series, heading "Joist".
 * https://steeljoist.org/wp-content/uploads/2021/05/LoadTables_K_LH_DLH-Series_0820.pdf
 * These are real table columns, NOT generated depth x section-number permutations.
 * Designation existence is verified; geometry, analysis properties and capacity are NOT.
 * Never treat these entries as a Core analytical section or as design approval.
 */
export type SjiSeries = "K" | "LH" | "DLH";
export interface SjiDesignation {
  series: SjiSeries;
  designation: string;
  nominalDepthIn: number;
  source: string;
  designationSourceVerified: true;
  engineeringPropertiesVerified: false;
  capacityVerification: "unverified";
}
export const SJI_LOAD_TABLE_SOURCE = "https://steeljoist.org/wp-content/uploads/2021/05/LoadTables_K_LH_DLH-Series_0820.pdf";
const verifiedKDesignations = [
  "10K1", "12K1", "12K3", "12K5",
  "14K1", "14K3", "14K4", "14K6",
  "16K2", "16K3", "16K4", "16K5", "16K6", "16K7", "16K9",
] as const;
/** Verified first K-series table header only; LH and DLH pending source-row extraction. */
export const SJI_VERIFIED_DESIGNATIONS: readonly SjiDesignation[] = verifiedKDesignations.map(designation => ({
  series: "K" as const,
  designation,
  nominalDepthIn: Number.parseInt(designation, 10),
  source: SJI_LOAD_TABLE_SOURCE,
  designationSourceVerified: true as const,
  engineeringPropertiesVerified: false as const,
  capacityVerification: "unverified" as const,
}));
export function getJoistDesignationCandidates(series: SjiSeries): SjiDesignation[] {
  return SJI_VERIFIED_DESIGNATIONS.filter(entry => entry.series === series);
}
