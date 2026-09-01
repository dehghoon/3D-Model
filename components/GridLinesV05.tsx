"use client";

import type { GridLine } from "@linkoteq/structural-core";
import GridLinesV06 from "./GridLinesV06";
import GridRuntimeProbeV05 from "./GridRuntimeProbeV05";

export default function GridLinesV05({ grids }: { grids: GridLine[] }) {
  return (
    <>
      <GridLinesV06 grids={grids} />
      <GridRuntimeProbeV05 grids={grids} />
    </>
  );
}
