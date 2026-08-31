"use client";

import { Html, Line } from "@react-three/drei";
import type { GridLine, Vec3 } from "@linkoteq/structural-core";

const GRID_ELEVATION_OFFSET = 0.08;

function toScenePoint(position: Vec3): [number, number, number] {
  return [position.x, position.z + GRID_ELEVATION_OFFSET, position.y];
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

function GridLineVisual({ grid }: { grid: GridLine }) {
  const start = toScenePoint(grid.start);
  const end = toScenePoint(grid.end);
  const labelPosition: [number, number, number] = [
    start[0],
    start[1] + 0.12,
    start[2],
  ];

  return (
    <group renderOrder={20}>
      <Line
        points={[start, end]}
        color="#2563eb"
        lineWidth={3.5}
        transparent
        opacity={0.95}
        depthTest={false}
        renderOrder={20}
      />
      <mesh position={start} renderOrder={21}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial color="#2563eb" depthTest={false} />
      </mesh>
      <Html
        position={labelPosition}
        center
        transform={false}
        zIndexRange={[50, 0]}
        wrapperClass="coreGridLabelWrapper"
      >
        <span className="coreGridLabel">{grid.label}</span>
      </Html>
    </group>
  );
}
