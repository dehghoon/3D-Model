"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { GridLine } from "@linkoteq/structural-core";

const EPSILON = 1e-9;

function describe(grid: GridLine): string {
  const dx = grid.end.x - grid.start.x;
  const dy = grid.end.y - grid.start.y;

  if (Math.abs(dx) < EPSILON && Math.abs(dy) > EPSILON) {
    return `${grid.label || grid.id}:X@${grid.start.x}`;
  }

  if (Math.abs(dy) < EPSILON && Math.abs(dx) > EPSILON) {
    return `${grid.label || grid.id}:Y@${grid.start.y}`;
  }

  return `${grid.label || grid.id}:DIAGONAL`;
}

export default function GridRuntimeProbeV05({ grids }: { grids: GridLine[] }) {
  const camera = useThree((state) => state.camera);
  const summary = grids.map(describe).join(" | ");

  return (
    <Html fullscreen zIndexRange={[1000, 900]} style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          maxWidth: "92vw",
          padding: "6px 8px",
          borderRadius: 6,
          background: "rgba(15,23,42,.82)",
          color: "white",
          font: "11px/1.35 monospace",
        }}
      >
        {`Grid ${grids.length} | Camera ${camera.type} | ${summary}`}
      </div>
    </Html>
  );
}
