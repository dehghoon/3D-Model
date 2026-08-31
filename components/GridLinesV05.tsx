"use client";

import { Html, Line } from "@react-three/drei";
import type { GridLine, Vec3 } from "@linkoteq/structural-core";

const GRID_ELEVATION_OFFSET = 0.025;
const GRID_LABEL_OFFSET = 0.75;

function toScenePoint(position: Vec3): [number, number, number] {
  return [position.x, position.z + GRID_ELEVATION_OFFSET, position.y];
}

function offsetPoint(
  point: [number, number, number],
  from: [number, number, number],
  distance: number,
): [number, number, number] {
  const dx = point[0] - from[0];
  const dz = point[2] - from[2];
  const length = Math.hypot(dx, dz) || 1;

  return [
    point[0] + (dx / length) * distance,
    point[1] + 0.04,
    point[2] + (dz / length) * distance,
  ];
}

function GridBubble({
  label,
  position,
}: {
  label: string;
  position: [number, number, number];
}) {
  return (
    <Html
      position={position}
      center
      transform={false}
      zIndexRange={[80, 0]}
      style={{ pointerEvents: "none" }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1.5px solid #667085",
          background: "rgba(255,255,255,0.96)",
          color: "#344054",
          fontSize: 12,
          fontWeight: 700,
          boxShadow: "0 1px 4px rgba(16,24,40,0.08)",
        }}
      >
        {label}
      </span>
    </Html>
  );
}

function GridLineVisual({ grid }: { grid: GridLine }) {
  const start = toScenePoint(grid.start);
  const end = toScenePoint(grid.end);
  const startLabel = offsetPoint(start, end, GRID_LABEL_OFFSET);
  const endLabel = offsetPoint(end, start, GRID_LABEL_OFFSET);

  return (
    <group renderOrder={25}>
      <Line
        points={[start, end]}
        color="#98a2b3"
        lineWidth={1.6}
        dashed
        dashSize={0.45}
        gapSize={0.28}
        transparent
        opacity={0.92}
        depthTest={false}
        renderOrder={25}
      />
      <GridBubble label={grid.label || grid.id} position={startLabel} />
      <GridBubble label={grid.label || grid.id} position={endLabel} />
    </group>
  );
}

export default function GridLinesV05({ grids }: { grids: GridLine[] }) {
  return (
    <>
      {grids.map((grid) => (
        <GridLineVisual key={grid.id} grid={grid} />
      ))}
    </>
  );
}
