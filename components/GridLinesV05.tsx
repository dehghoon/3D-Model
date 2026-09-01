"use client";

import { Billboard, Line, OrthographicCamera, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GridLine } from "@linkoteq/structural-core";

const GRID_Y = 0.035;
const BUBBLE_RADIUS = 0.24;
const BUBBLE_OFFSET = 0.65;
const MIN_SPAN = 12;
const PADDING_FACTOR = 1.35;
const EPSILON = 1e-9;

type Axis = "x" | "y";

interface ClassifiedGrid {
  id: string;
  label: string;
  axis: Axis;
  offset: number;
}

interface GridBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  centerX: number;
  centerY: number;
  spanX: number;
  spanY: number;
}

function classify(grid: GridLine): ClassifiedGrid | null {
  if (Math.abs(grid.start.z) > EPSILON || Math.abs(grid.end.z) > EPSILON) {
    return null;
  }

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

function buildBounds(grids: ClassifiedGrid[]): GridBounds {
  const xOffsets = grids.filter((grid) => grid.axis === "x").map((grid) => grid.offset);
  const yOffsets = grids.filter((grid) => grid.axis === "y").map((grid) => grid.offset);

  const xMinRaw = xOffsets.length ? Math.min(...xOffsets) : 0;
  const xMaxRaw = xOffsets.length ? Math.max(...xOffsets) : 0;
  const yMinRaw = yOffsets.length ? Math.min(...yOffsets) : 0;
  const yMaxRaw = yOffsets.length ? Math.max(...yOffsets) : 0;

  const spanX = Math.max(xMaxRaw - xMinRaw, MIN_SPAN);
  const spanY = Math.max(yMaxRaw - yMinRaw, MIN_SPAN);
  const xPad = Math.max(2, spanX * 0.12);
  const yPad = Math.max(2, spanY * 0.12);

  const xMin = xMinRaw - xPad;
  const xMax = xMaxRaw + xPad;
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    centerX: (xMinRaw + xMaxRaw) / 2,
    centerY: (yMinRaw + yMaxRaw) / 2,
    spanX: xMax - xMin,
    spanY: yMax - yMin,
  };
}

function ResponsiveOrthographicCamera({ bounds }: { bounds: GridBounds }) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();

  const zoom = useMemo(() => {
    const diagonalFactor = 1.25;
    const widthZoom = size.width / (bounds.spanX * PADDING_FACTOR * diagonalFactor);
    const heightZoom = size.height / (bounds.spanY * PADDING_FACTOR * diagonalFactor);
    return Math.max(4, Math.min(widthZoom, heightZoom));
  }, [bounds.spanX, bounds.spanY, size.width, size.height]);

  const distance = Math.max(bounds.spanX, bounds.spanY, MIN_SPAN) * 1.6;

  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.position.set(
      bounds.centerX + distance,
      distance * 0.9,
      bounds.centerY + distance,
    );
    camera.lookAt(bounds.centerX, 0, bounds.centerY);
    camera.updateProjectionMatrix();
  }, [bounds.centerX, bounds.centerY, distance, zoom]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      near={0.1}
      far={10000}
      zoom={zoom}
    />
  );
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
  const clean = useMemo(
    () => grids.map(classify).filter((grid): grid is ClassifiedGrid => grid !== null),
    [grids],
  );

  const bounds = useMemo(() => buildBounds(clean), [clean]);

  if (!clean.length) return null;

  return (
    <>
      <ResponsiveOrthographicCamera bounds={bounds} />

      {clean.map((grid) => {
        const points: [[number, number, number], [number, number, number]] =
          grid.axis === "x"
            ? [
                [grid.offset, GRID_Y, bounds.yMin],
                [grid.offset, GRID_Y, bounds.yMax],
              ]
            : [
                [bounds.xMin, GRID_Y, grid.offset],
                [bounds.xMax, GRID_Y, grid.offset],
              ];

        const bubbleA: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.02, bounds.yMin - BUBBLE_OFFSET]
            : [bounds.xMin - BUBBLE_OFFSET, GRID_Y + 0.02, grid.offset];

        const bubbleB: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.02, bounds.yMax + BUBBLE_OFFSET]
            : [bounds.xMax + BUBBLE_OFFSET, GRID_Y + 0.02, grid.offset];

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
