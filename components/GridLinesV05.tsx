"use client";

import { Billboard, Line, Text } from "@react-three/drei";
import type { GridLine } from "@linkoteq/structural-core";

const GRID_Y = 0.035;
const BUBBLE_RADIUS = 0.24;
const BUBBLE_OFFSET = 0.65;
const MIN_EXTENT = 24;
const EPSILON = 1e-9;

type Axis = "x" | "y";

interface ClassifiedGrid {
  id: string;
  label: string;
  axis: Axis;
  offset: number;
}

function classify(grid: GridLine): ClassifiedGrid | null {
  if (Math.abs(grid.start.z) > EPSILON || Math.abs(grid.end.z) > EPSILON) return null;

  const dx = grid.end.x - grid.start.x;
  const dy = grid.end.y - grid.start.y;

  if (Math.hypot(dx, dy) < EPSILON) return null;

  if (Math.abs(dx) < EPSILON) {
    return {
      id: grid.id,
      label: grid.label || grid.id,
      axis: "x",
      offset: grid.start.x,
    };
  }

  if (Math.abs(dy) < EPSILON) {
    return {
      id: grid.id,
      label: grid.label || grid.id,
      axis: "y",
      offset: grid.start.y,
    };
  }

  return null;
}

function Bubble({
  label,
  position,
}: {
  label: string;
  position: [number, number, number];
}) {
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

export default function GridLinesV05({ grids }: { grids: GridLine[] }) {
  const clean = grids
    .map(classify)
    .filter((grid): grid is ClassifiedGrid => grid !== null);

  if (!clean.length) return null;

  const xOffsets = clean.filter((grid) => grid.axis === "x").map((grid) => grid.offset);
  const yOffsets = clean.filter((grid) => grid.axis === "y").map((grid) => grid.offset);

  const xMin = xOffsets.length ? Math.min(...xOffsets) : 0;
  const xMax = xOffsets.length ? Math.max(...xOffsets) : 0;
  const yMin = yOffsets.length ? Math.min(...yOffsets) : 0;
  const yMax = yOffsets.length ? Math.max(...yOffsets) : 0;

  const xSpan = Math.max(xMax - xMin, MIN_EXTENT);
  const ySpan = Math.max(yMax - yMin, MIN_EXTENT);
  const xPad = Math.max(MIN_EXTENT * 0.25, xSpan * 0.15);
  const yPad = Math.max(MIN_EXTENT * 0.25, ySpan * 0.15);

  const left = xMin - xPad;
  const right = xMax + xPad;
  const bottom = yMin - yPad;
  const top = yMax + yPad;

  return (
    <>
      {clean.map((grid) => {
        const points: [[number, number, number], [number, number, number]] =
          grid.axis === "x"
            ? [
                [grid.offset, GRID_Y, bottom],
                [grid.offset, GRID_Y, top],
              ]
            : [
                [left, GRID_Y, grid.offset],
                [right, GRID_Y, grid.offset],
              ];

        const bubbleA: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.02, bottom - BUBBLE_OFFSET]
            : [left - BUBBLE_OFFSET, GRID_Y + 0.02, grid.offset];

        const bubbleB: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.02, top + BUBBLE_OFFSET]
            : [right + BUBBLE_OFFSET, GRID_Y + 0.02, grid.offset];

        return (
          <group key={grid.id} renderOrder={40}>
            <Line
              points={points}
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
            <Bubble label={grid.label} position={bubbleA} />
            <Bubble label={grid.label} position={bubbleB} />
          </group>
        );
      })}
    </>
  );
}
