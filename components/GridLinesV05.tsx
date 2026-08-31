"use client";

import { Html, Line } from "@react-three/drei";
import type { GridLine, Vec3 } from "@linkoteq/structural-core";

const Y = 0.035;

function scenePoint(point: Vec3): [number, number, number] {
  return [point.x, point.z + Y, point.y];
}

function labelPoint(point: Vec3, other: Vec3): [number, number, number] {
  const p = scenePoint(point);
  const q = scenePoint(other);
  const dx = p[0] - q[0];
  const dz = p[2] - q[2];
  const length = Math.hypot(dx, dz) || 1;
  return [p[0] + (dx / length) * 0.7, p[1] + 0.05, p[2] + (dz / length) * 0.7];
}

function Bubble({ label, position }: { label: string; position: [number, number, number] }) {
  return (
    <Html position={position} center zIndexRange={[70, 0]} style={{ pointerEvents: "none" }}>
      <span className="gridBubble">{label}</span>
    </Html>
  );
}

function GridVisual({ grid }: { grid: GridLine }) {
  const start = scenePoint(grid.start);
  const end = scenePoint(grid.end);
  const label = grid.label || grid.id;

  return (
    <group renderOrder={30}>
      <Line
        points={[start, end]}
        color="#64748b"
        lineWidth={2}
        dashed
        dashSize={0.5}
        gapSize={0.25}
        transparent
        opacity={0.95}
        depthTest={false}
        renderOrder={30}
      />
      <Bubble label={label} position={labelPoint(grid.start, grid.end)} />
      <Bubble label={label} position={labelPoint(grid.end, grid.start)} />
    </group>
  );
}

export default function GridLinesV05({ grids }: { grids: GridLine[] }) {
  return <>{grids.map((grid) => <GridVisual key={grid.id} grid={grid} />)}</>;
}
