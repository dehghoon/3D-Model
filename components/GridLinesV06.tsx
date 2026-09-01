"use client";

import { Billboard, Line, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { GridLine } from "@linkoteq/structural-core";
import { usePublishedLevels } from "../lib/level-visual-store";

const EPS = 1e-9;
type G = { id: string; label: string; axis: "x" | "y"; offset: number };

function classify(grid: GridLine): G | null {
  if (Math.abs(grid.start.z) > EPS || Math.abs(grid.end.z) > EPS) return null;
  const dx = grid.end.x - grid.start.x;
  const dy = grid.end.y - grid.start.y;
  if (Math.hypot(dx, dy) < EPS) return null;
  if (Math.abs(dx) < EPS) return { id: grid.id, label: grid.label || grid.id, axis: "x", offset: grid.start.x };
  if (Math.abs(dy) < EPS) return { id: grid.id, label: grid.label || grid.id, axis: "y", offset: grid.start.y };
  return null;
}

function StableCamera({ cx, cz, span }: { cx: number; cz: number; span: number }) {
  const set = useThree((state) => state.set);
  const previousCamera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const camera = useMemo(() => new THREE.OrthographicCamera(), []);

  useLayoutEffect(() => {
    set({ camera });
    return () => set({ camera: previousCamera });
  }, [camera, previousCamera, set]);

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
    camera.position.set(cx + distance, distance * 0.9, cz + distance);
    camera.lookAt(cx, 0, cz);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, cx, cz, size.height, size.width, span]);

  return null;
}

function Bubble({ text, position }: { text: string; position: [number, number, number] }) {
  return (
    <Billboard position={position} follow>
      <mesh renderOrder={41}>
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.17} anchorX="center" anchorY="middle" color="#1e293b">
        {text}
      </Text>
    </Billboard>
  );
}

export default function GridLinesV06({ grids }: { grids: GridLine[] }) {
  const levels = usePublishedLevels();
  const clean = useMemo(() => grids.map(classify).filter((grid): grid is G => grid !== null), [grids]);
  if (!clean.length) return null;

  const xs = clean.filter((g) => g.axis === "x").map((g) => g.offset);
  const ys = clean.filter((g) => g.axis === "y").map((g) => g.offset);
  const x0 = xs.length ? Math.min(...xs) : 0;
  const x1 = xs.length ? Math.max(...xs) : 0;
  const z0 = ys.length ? Math.min(...ys) : 0;
  const z1 = ys.length ? Math.max(...ys) : 0;
  const span = Math.max(x1 - x0, z1 - z0, 12);
  const pad = Math.max(2, span * 0.12);
  const left = x0 - pad;
  const right = x1 + pad;
  const bottom = z0 - pad;
  const top = z1 + pad;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;

  return (
    <>
      <StableCamera cx={cx} cz={cz} span={span} />
      {clean.map((g) => {
        const points: [number, number, number][] =
          g.axis === "x"
            ? [[g.offset, 0.035, bottom], [g.offset, 0.035, top]]
            : [[left, 0.035, g.offset], [right, 0.035, g.offset]];
        const a: [number, number, number] =
          g.axis === "x" ? [g.offset, 0.06, bottom - 0.6] : [left - 0.6, 0.06, g.offset];
        const b: [number, number, number] =
          g.axis === "x" ? [g.offset, 0.06, top + 0.6] : [right + 0.6, 0.06, g.offset];

        return (
          <group key={g.id}>
            <Line points={points} color="#64748b" lineWidth={1.35} dashed dashSize={0.42} gapSize={0.22} depthTest={false} />
            <Bubble text={g.label} position={a} />
            <Bubble text={g.label} position={b} />
          </group>
        );
      })}

      {levels.map((level) => (
        <group key={level.id} position={[0, level.elevation, 0]}>
          <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[right - left, top - bottom]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
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
          <Billboard position={[left - 0.8, 0, cz]}>
            <Text fontSize={0.24} anchorX="right" anchorY="middle" color="#2563eb">
              {`${level.name}  ${level.elevation}`}
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
}
