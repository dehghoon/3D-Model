"use client";

import { Billboard, Line, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { GridLine } from "@linkoteq/structural-core";
import { usePublishedLevels } from "../lib/level-visual-store";

const EPS = 1e-9;
const GRID_Y = 0.035;

type GridAxis = "x" | "y";

interface RenderGrid {
  id: string;
  label: string;
  axis: GridAxis;
  offset: number;
}

function classify(grid: GridLine): RenderGrid | null {
  if (Math.abs(grid.start.z) > EPS || Math.abs(grid.end.z) > EPS) return null;

  const dx = grid.end.x - grid.start.x;
  const dy = grid.end.y - grid.start.y;
  if (Math.hypot(dx, dy) < EPS) return null;

  if (Math.abs(dx) < EPS) {
    return { id: grid.id, label: grid.label || grid.id, axis: "x", offset: grid.start.x };
  }
  if (Math.abs(dy) < EPS) {
    return { id: grid.id, label: grid.label || grid.id, axis: "y", offset: grid.start.y };
  }
  return null;
}

function GridCamera({
  centerX,
  centerY,
  span,
}: {
  centerX: number;
  centerY: number;
  span: number;
}) {
  const set = useThree((state) => state.set);
  const controls = useThree((state) => state.controls) as
    | { object?: THREE.Camera; update?: () => void }
    | undefined;
  const size = useThree((state) => state.size);

  const camera = useMemo(() => new THREE.OrthographicCamera(), []);

  useLayoutEffect(() => {
    set({ camera });
  }, [camera, set]);

  useLayoutEffect(() => {
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.1);
    const halfHeight = Math.max(span * 0.78, 6);
    const halfWidth = halfHeight * aspect;
    const distance = Math.max(span * 1.8, 20);

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.near = 0.1;
    camera.far = 10000;
    camera.zoom = 1;
    camera.position.set(centerX + distance, distance * 0.9, centerY + distance);
    camera.lookAt(centerX, 0, centerY);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }, [camera, centerX, centerY, size.height, size.width, span]);

  useFrame(() => {
    if (controls?.object && controls.object !== camera) {
      controls.object = camera;
      controls.update?.();
    }
  });

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
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.17}
        anchorX="center"
        anchorY="middle"
        color="#1e293b"
      >
        {label}
      </Text>
    </Billboard>
  );
}

export default function GridLinesV06({ grids }: { grids: GridLine[] }) {
  const levels = usePublishedLevels();
  const clean = useMemo(
    () => grids.map(classify).filter((grid): grid is RenderGrid => grid !== null),
    [grids],
  );

  if (!clean.length) return null;

  const xOffsets = clean.filter((grid) => grid.axis === "x").map((grid) => grid.offset);
  const yOffsets = clean.filter((grid) => grid.axis === "y").map((grid) => grid.offset);

  const x0 = xOffsets.length ? Math.min(...xOffsets) : 0;
  const x1 = xOffsets.length ? Math.max(...xOffsets) : 0;
  const y0 = yOffsets.length ? Math.min(...yOffsets) : 0;
  const y1 = yOffsets.length ? Math.max(...yOffsets) : 0;
  const span = Math.max(x1 - x0, y1 - y0, 12);
  const pad = Math.max(2, span * 0.12);
  const left = x0 - pad;
  const right = x1 + pad;
  const bottom = y0 - pad;
  const top = y1 + pad;
  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;

  return (
    <>
      <GridCamera centerX={centerX} centerY={centerY} span={span} />

      {clean.map((grid) => {
        const points: [number, number, number][] =
          grid.axis === "x"
            ? [[grid.offset, GRID_Y, bottom], [grid.offset, GRID_Y, top]]
            : [[left, GRID_Y, grid.offset], [right, GRID_Y, grid.offset]];

        const a: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.025, bottom - 0.6]
            : [left - 0.6, GRID_Y + 0.025, grid.offset];
        const b: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.025, top + 0.6]
            : [right + 0.6, GRID_Y + 0.025, grid.offset];

        return (
          <group key={grid.id}>
            <Line
              points={points}
              color="#64748b"
              lineWidth={1.35}
              dashed
              dashSize={0.42}
              gapSize={0.22}
              depthTest={false}
            />
            <Bubble label={grid.label} position={a} />
            <Bubble label={grid.label} position={b} />
          </group>
        );
      })}

      {levels.map((level) => (
        <group key={level.id} position={[0, level.elevation, 0]}>
          <mesh position={[centerX, 0, centerY]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[right - left, top - bottom]} />
            <meshBasicMaterial
              color="#3b82f6"
              transparent
              opacity={0.08}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <Line
            points={[
              [left, 0, bottom],
              [right, 0, bottom],
              [right, 0, top],
              [left, 0, top],
              [left, 0, bottom],
            ]}
            color="#3b82f6"
            lineWidth={1}
            transparent
            opacity={0.55}
          />
          <Billboard position={[left - 0.8, 0, centerY]}>
            <Text fontSize={0.24} anchorX="right" anchorY="middle" color="#2563eb">
              {`${level.name}  ${level.elevation}`}
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
}
