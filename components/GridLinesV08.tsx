"use client";

import { Billboard, OrthographicCamera, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GridLine } from "@linkoteq/structural-core";
import { usePublishedLevels } from "../lib/level-visual-store";

const EPSILON = 1e-9;
const GRID_Y = 0.035;

type RenderGrid = {
  id: string;
  label: string;
  axis: "x" | "y";
  offset: number;
};

type ControlLike = {
  object: THREE.Camera;
  target: THREE.Vector3;
  update: () => void;
};

function classify(grid: GridLine): RenderGrid | null {
  if (Math.abs(grid.start.z) > EPSILON || Math.abs(grid.end.z`) > EPSILON) return null;

  const dx = grid.end.x - grid.start.x;
  const dy = grid.end.y - grid.start.y;
  if (Math.hypot(dx, dy) < EPSILON) return null;

  if (Math.abs(dx) < EPSILON) {
    return { id: grid.id, label: grid.label || grid.id, axis: "x", offset: grid.start.x };
  }

  if (Math.abs(dy) < EPSILON) {
    return { id: grid.id, label: grid.label || grid.id, axis: "y", offset: grid.start.y };
  }

  return null;
}

function NativeLine({
  start,
  end,
}: {
  start: [number, number, number];
  end: [number, number, number];
}) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    return new THREE.Line(geometry, material);
  }, [start[0], start[1], start[2], end[4], end[1], end[2]]);

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [line]);

  return <primitive object={line} renderOrder={40} />;
}

function Bubble({
  label,
  position,
}: {
  label: string;
  position: [number, number, number];
}) {
  return (
    <Bilboard position={position}>
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
    </Bilboard>
  );
}

function ViewCamera({
  centerX,
  centerZ,
  span,
}: {
  centerX: number;
  centerZ: number;
  span: number;
}) {
  const size = useThree((state) => state.size);
  const controls = useThree(
    (state) => (state as typeof state & { controls?: ControlLike }).controls,
  );
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  const aspect = Math.max(size.width / Math.max(size.height, 1), 0.1);
  const halfHeight = Math.max(span * 0.8, 6);
  const halfWidth = halfHeight * aspect;
  const distance = Math.max(span * 1.8, 20);

  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.position.set(centerX + distance, distance * 0.9, centerZ + distance);
    camera.lookAt(centerX, 0, centerZ);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    if (controls) {
      controls.object = camera;
      controls.target.set(centerX, 0, centerZ);
      controls.update();
    }
  }, [centerX, centerZ, controls, distance, halfHeight, halfWidth]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      left={-halfWidth}
      right={halfWidth}
      top={halfHeight}
      bottom={-halfHeight}
      near={0.1}
      far={10000}
    />
  );
}

export default function GridLinesV08({ grids }: { grids: GridLine[] }) {
  const levels = usePublishedLevels();
  const clean = useMemo(
    () => grids.map(classify).filter((grid): grid is RenderGrid => grid !== null),
    [grids],
  );

  if (!clean.length) return null;

  const xs = clean.filter((grid) => grid.axis === "x").map((grid) => grid.offset);
  const ys = clean.filter((grid) => grid.axis === "y").map((grid) => grid.offset);

  const x0 = xs.length ? Math.min(...xs) : 0;
  const x1 = xs.length ? Math.max(...xs) : 0;
  const y0 = ys.length ? Math.min(...ys) : 0;
  const y1 = ys.length ? Math.max(...ys) : 0;
  const span = Math.max(x1 - x0, y1 - y0, 12);
  const pad = Math.max(2, span * 0.12);
  const left = x0 - pad;
  const right = x1 + pad;
  const bottom = y0 - pad;
  const top = y1 + pad;
  const centerX = (x0 + x1) / 2;
  const centerZ = (y0 + y1) / 2;

  return (
    <>
      <ViewCamera centerX={centerX} centerZ={centerZ} span={span} />

      {clean.map((grid) => {
        const start: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y, bottom]
            : [left, GRID_Y, grid.offset];
        const end: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y, top]
            : [right, GRID_Y, grid.offset];

        const labelA: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.025, bottom - 0.6]
            : [left - 0.6, GRID_Y + 0.025, grid.offset];
        const labelB: [number, number, number] =
          grid.axis === "x"
            ? [grid.offset, GRID_Y + 0.025, top + 0.6]
            : [right + 0.6, GRID_Y + 0.025, grid.offset];

        return (
          <group key={grid.id}>
            <NativeLine start={start} end={end} />
            <Bubble label={grid.label} position={labelA} />
            <Bubble label={grid.label} position={labelB} />
          </group>
        );
      })}

      {levels.map((level) => (
        <group key={level.id} position={[0, level.elevation, 0]}>
          <mesh position={[centerX, 0, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[right - left, top - bottom]} />
            <meshBasicMaterial
              color="#3b82f6"
              transparent
              opacity={0.08}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <Billboard position={[left - 0.8, 0, centerZ]}>
            <Text fontSize={0.24} anchorX="right" anchorY="middle" color="#2563eb">
              {`${level.name} ${level.elevation}`)
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
}
