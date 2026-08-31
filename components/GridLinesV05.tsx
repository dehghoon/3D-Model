"use client";

import { Billboard, Line, Text } from "@react-three/drei";
import type { GridLine, Vec3 } from "@linkoteq/structural-core";

const GRID_Y = 0.035;
const BUBBLE_RADIUS = 0.24;
const BUBBLE_OFFSET = 0.55;

function scenePoint(point: Vec3): [number, number, number] {
  return [point.x, point.z + GRID_Y, point.y];
}

function labelPoint(point: Vec3, other: Vec3): [number, number, number] {
  const p = scenePoint(point);
  const q = scenePoint(other);
  const dx = p[0] - q[0];
  const dz = p[2] - q[2];
  const length = Math.hypot(dx, dz) || 1;
  return [
    p[0] + (dx / length) * BUBBLE_OFFSET,
    p[1] + 0.02,
    p[2] + (dz / length) * BUBBLE_OFFSET,
  ];
}

function Bubble({ label, position }: { label: string; position: [number, number, number] }) {
  return (
    <Billboard position={position} follow>
      <mesh renderOrder={41}>
        <circleGeometry args={[BUBBLE_RADIUS, 32]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]} renderOrder={42}>
        <ringGeometry args={[BUBBLE_RADIUS - 0.025, BUBBLE_RADIUS, 32]} />
        <meshBasicMaterial color="#64748b" depthTest={false} />
      </mesh>
      <Text
        position={[0, 0, 0.003]}
        fontSize={0.18}
        anchorX="center"
        anchorY="middle"
        color="#1e293b"
        renderOrder={43}
      >
        {label}
      </Text>
    </Billboard>
  );
}

function GridVisual({ grid }: { grid: GridLine }) {
  const start = scenePoint(grid.start);
  const end = scenePoint(grid.end);
  const label = grid.label || grid.id;

  return (
    <group renderOrder={40}>
      <Line
        points={[start, end]}
        color="#64748b"
        lineWidth={1.35}
        dashed
        dashSize={0.42}
        gapSize={0.22}
        transparent
        opacity={0.92}
        depthTest={false}
        renderOrder={40}
      />
      <Bubble label={label} position={labelPoint(grid.start, grid.end)} />
      <Bubble label={label} position={labelPoint(grid.end, grid.start)} />
    </group>
  );
}

export default function GridLinesV05({ grids }: { grids: GridLine[] }) {
  return <>{grids.map((grid) => <GridVisual key={grid.id} grid={grid} />)}</>;
}
