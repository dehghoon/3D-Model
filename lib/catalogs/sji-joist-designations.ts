/** SJI standard designation index for preliminary model geometry only.
 * Source: SJI 100-2025, https://steeljoist.org/professional-resources/standards-and-specifications/
 * Not a load/weight/section-property table. Do NOT use for analysis or capacity checks.
 */
export type SjiSeries = "K" | "LH" | "DLH";
export interface SjiDesignation { series:SjiSeries; designation:string; nominalDepthIn:number; source:string; engineeringPropertiesVerified:false }
const source="https://steeljoist.org/professional-resources/standards-and-specifications/";
const depths:Record<SjiSeries,readonly number[]> = {
 K:[10,12,14,16,18,20,22,24,26,28,30],
 LH:[18,20,22,24,26,28,30,32,36,40,44,48],
 DLH:[52,56,60,64,68,72,76,80,88,96,104,112,120],
};
/** Display-only candidate designation patterns; not a verified enumeration of SJI load table rows. */
export const SJI_JOIST_CANDIDATES:SjiDesignation[] = (Object.keys(depths) as SjiSeries[]).flatMap(series=>
 depths[series].flatMap(nominalDepthIn=>Array.from({length:25},(_,i)=>({
 series,designation:`${nominalDepthIn}${series}${String(i+1).padStart(2,"0")}`,nominalDepthIn,source,engineeringPropertiesVerified:false as const
 })))
);
export function getJoistDesignationCandidates(series:SjiSeries):SjiDesignation[]{
 return SJI_JOIST_CANDIDATES.filter(d=>d.series===series);
}
