"use client";

import { OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { GridLine } from "@linkoteq/structural-core";

const EPS = 1e-9;

function offsets(grids: GridLine[]) {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const grid of grids) {
    if (Math.abs(grid.start.z) > EPS || Math.abs(grid.end.z) > EPS) continue;

    const dx = grid.end.x - grid.start.x;
    const dy = grid.end.y - grid.start.y;

    if (Math.abs(dx) < EPS && Math.abs(dy) > EPS) xs.push(grid.start.x);
    else if (Math.abs(dy) < EPS && Math.abs(dx) > EPS) ys.push(grid.start.y);
  }

  const x0 = xs.length ? Math.min(...xs) : 0;
  const x1 = xs.length ? Math.max(...xs) : 0;
  const y0 = ys.length ? Math.min(...ys) : 0;
  const y1 = ys.length ? Math.max(...ys) : 0;

  return { x0, x1, y0, y1 };
}

export default function GridOrthographicViewV05({ grids }: { grids: GridLine[] }) {
  const size = useThree((state) => state.size);
  const bounds = useMemo(() => offsets(grids), [grids]);

  const centerX = (bounds.x0 + bounds.x1) / 2;
  const centerZ = (bounds.y0 + bounds.y1) / 2;
  const span = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0, 12);
  const aspect = Math.max(size.width / Math.max(size.height, 1), 0.1);
  const halfHeight = span * 0.8;
  const halfWidth = halfHeight * aspect;
  const distance = Math.max(span * 1.8, 20);

  const position: [number, number, number] = [
    centerX + distance,
    distance * 0.9,
    centerZ + distance,
  ];

  return (
    <OrthographicCamera
      makeDefault
      left={-halfWidth}
      right={halfWidth}
      top={halfHeight}
      bottom={-halfHeight}
      near={0.1}
      far={10000}
      position={position}
      ref={(camera) => {
        if (!camera) return;
        camera.lookAt(new THREE.Vector3(centerX, 0, centerZ));
        camera.updateProjectionMatrix();
      }}
    />
  );
}
