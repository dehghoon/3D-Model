"use client";

import { Html } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { GridLine, Vec3 } from "@linkoteq/structural-core";

const GRID_ELEVATION_OFFSET = 0.06;
const GRID_THICKNESS = 0.055;

function toScenePoint(position: Vec3): THREE.Vector3 {
  return new THREE.Vector3(
    position.x,
    position.z + GRID_ELEVATION_OFFSET,
    position.y,
  );
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
  const { geometry, start, end, labelPosition } = useMemo(() => {
    const startPoint = toScenePoint(grid.start);
    const endPoint = toScenePoint(grid.end);
    const direction = endPoint.clone().sub(startPoint);
    const length = direction.length();

    if (!Number.isFinite(length) || length <= 0) {
      return {
        geometry: null,
        start: startPoint,
        end: endPoint,
        labelPosition: startPoint.clone(),
      };
    }

    const box = new THREE.BoxGeometry(
      GRID_THICKNESS,
      length,
      GRID_THICKNESS,
    );
    box.translate(0, length / 2, 0);
    box.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      ),
    );
    box.translate(startPoint.x, startPoint.y, startPoint.z);

    return {
      geometry: box,
      start: startPoint,
      end: endPoint,
      labelPosition: startPoint.clone().add(new THREE.Vector3(0, 0.18, 0)),
    };
  }, [
    grid.start.x,
    grid.start.y,
    grid.start.z,
    grid.end.x,
    grid.end.y,
    grid.end.z,
  ]);

  if (!geometry) return null;

  return (
    <group renderOrder={30}>
      <mesh geometry={geometry} renderOrder={30}>
        <meshBasicMaterial
          color="#1d4ed8"
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <mesh position={start} renderOrder={31}>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshBasicMaterial
          color="#1d4ed8"
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <mesh position={end} renderOrder={31}>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshBasicMaterial
          color="#1d4ed8"
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={labelPosition}
        center
        transform={false}
        zIndexRange={[60, 0]}
        wrapperClass="coreGridLabelWrapper"
      >
        <span className="coreGridLabel">
          {grid.label || grid.id}
        </span>
      </Html>
    </group>
  );
}
