"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { GridLine } from "@linkoteq/structural-core";

function point(position: { x: number; y: number; z: number }): [number, number, number] {
  return [position.x, position.z + 0.025, position.y];
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
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry();
    next.setFromPoints([
      new THREE.Vector3(...point(grid.start)),
      new THREE.Vector3(...point(grid.end)),
    ]);
    return next;
  }, [
    grid.start.x,
    grid.start.y,
    grid.start.z,
    grid.end.x,
    grid.end.y,
    grid.end.z,
  ]);

  return (
    <line geometry={geometry} renderOrder={4}>
      <lineBasicMaterial color="#4f6f9f" depthTest={false} />
    </line>
  );
}
