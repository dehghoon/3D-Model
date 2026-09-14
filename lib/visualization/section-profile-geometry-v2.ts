"use client";

import * as THREE from "three";
import type { Member, Section, StructuralModel, Vec3 } from "@linkoteq/structural-core";
import { buildRealMemberGeometry as buildFallbackMemberGeometry } from "./section-profile-geometry";

const UNIT_FACTOR: Record<string, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

function toThree(value: Vec3): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.z, value.y);
}

function dimension(
  section: Section,
  keys: string[],
  model: StructuralModel,
): number | null {
  if (!section.geometry) return null;

  for (const key of keys) {
    const raw = section.geometry[key] as
      | { value?: unknown; unit?: unknown }
      | undefined;

    if (
      !raw ||
      typeof raw.value !== "number" ||
      !Number.isFinite(raw.value) ||
      typeof raw.unit !== "string"
    ) {
      continue;
    }

    const factor = UNIT_FACTOR[raw.unit.trim().toLowerCase()];
    if (!factor) continue;

    const metres = raw.value * factor;
    return model.project.units === "US" ? metres / 0.3048 : metres;
  }

  return null;
}

function isWideFlangeSection(section: Section): boolean {
  const family = section.family.trim().toUpperCase().replace(/[_\s]+/g, "-");
  const designation = (section.designation ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  return (
    ["W", "WF", "W-SHAPE", "W-SHAPES", "WIDE-FLANGE", "WIDEFLANGE"].includes(family) ||
    /^W\d/.test(designation)
  );
}

function wideFlangeShape(
  depth: number,
  flangeWidth: number,
  webThickness: number,
  flangeThickness: number,
): THREE.Shape | null {
  if (
    depth <= 0 ||
    flangeWidth <= 0 ||
    webThickness <= 0 ||
    flangeThickness <= 0 ||
    webThickness >= flangeWidth ||
    flangeThickness * 2 >= depth
  ) {
    return null;
  }

  const b = flangeWidth / 2;
  const h = depth / 2;
  const w = webThickness / 2;
  const shape = new THREE.Shape();

  shape.moveTo(-b, h);
  shape.lineTo(b, h);
  shape.lineTo(b, h - flangeThickness);
  shape.lineTo(w, h - flangeThickness);
  shape.lineTo(w, -h + flangeThickness);
  shape.lineTo(b, -h + flangeThickness);
  shape.lineTo(b, -h);
  shape.lineTo(-b, -h);
  shape.lineTo(-b, -h + flangeThickness);
  shape.lineTo(-w, -h + flangeThickness);
  shape.lineTo(-w, h - flangeThickness);
  shape.lineTo(-b, h - flangeThickness);
  shape.closePath();

  return shape;
}

function localAxes(member: Member, x: THREE.Vector3) {
  let y: THREE.Vector3;
  let z: THREE.Vector3;

  if (member.localAxes?.convention === "right-handed") {
    y = toThree(member.localAxes.y).normalize();
    z = toThree(member.localAxes.z).normalize();
  } else {
    const reference =
      Math.abs(x.dot(new THREE.Vector3(0, 1, 0))) < 0.95
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);

    z = new THREE.Vector3().crossVectors(x, reference).normalize();
    y = new THREE.Vector3().crossVectors(z, x).normalize();
  }

  const angle = THREE.MathUtils.degToRad(member.rotationDeg ?? 0);
  if (Math.abs(angle) > 1e-12) {
    const rotation = new THREE.Quaternion().setFromAxisAngle(x, angle);
    y.applyQuaternion(rotation);
    z.applyQuaternion(rotation);
  }

  return { y, z };
}

function buildWideFlangeMemberGeometry(
  model: StructuralModel,
  member: Member,
  section: Section,
  start: THREE.Vector3,
  end: THREE.Vector3,
): THREE.BufferGeometry | null {
  const d = dimension(section, ["d", "D", "depth", "height"], model);
  const bf = dimension(section, ["bf", "B", "flangeWidth", "width"], model);
  const tw = dimension(section, ["tw", "W", "webThickness"], model);
  const tf = dimension(section, ["tf", "T", "flangeThickness"], model);

  if (!d || !bf || !tw || !tf) return null;

  const shape = wideFlangeShape(d, bf, tw, tf);
  if (!shape) return null;

  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 1e-9) return null;

  const x = direction.normalize();
  const { y, z } = localAxes(member, x);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 12,
  });

  geometry.translate(0, 0, -length / 2);
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(z, y, x));

  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  geometry.translate(midpoint.x, midpoint.y, midpoint.z);
  geometry.computeVertexNormals();

  return geometry;
}

export function buildRealMemberGeometry(
  model: StructuralModel,
  member: Member,
  start: THREE.Vector3,
  end: THREE.Vector3,
): THREE.BufferGeometry | null {
  const section = model.sections.find((item) => item.id === member.sectionId);

  if (section && isWideFlangeSection(section)) {
    const geometry = buildWideFlangeMemberGeometry(model, member, section, start, end);
    if (geometry) return geometry;
  }

  return buildFallbackMemberGeometry(model, member, start, end);
}
