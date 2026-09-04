import * as THREE from "three";
import type { Member, Section, StructuralModel, Vec3 } from "@linkoteq/structural-core";

const FACTOR: Record<string, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

const v3 = (value: Vec3) => new THREE.Vector3(value.x, value.z, value.y);

function dim(section: Section, keys: string[], model: StructuralModel): number | null {
  if (!section.geometry) return null;

  for (const key of keys) {
    const raw = section.geometry[key] as { value?: unknown; unit?: unknown } | undefined;
    if (
      !raw ||
      typeof raw.value !== "number" ||
      !Number.isFinite(raw.value) ||
      typeof raw.unit !== "string"
    ) {
      continue;
    }

    const factor = FACTOR[raw.unit.trim().toLowerCase()];
    if (!factor) continue;

    const meters = raw.value * factor;
    const value = model.project.units === "US" ? meters / 0.3048 : meters;
    if (value > 0) return value;
  }

  return null;
}

function solidRectShape(height: number, width: number): THREE.Shape | null {
  if (height <= 0 || width <= 0) return null;
  const x = width / 2;
  const y = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  return shape;
}

function iShape(d: number, bf: number, tw: number, tf: number): THREE.Shape | null {
  if (tw >= bf || tf * 2 >= d) return null;
  const b = bf / 2;
  const h = d / 2;
  const w = tw / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-b, h);
  shape.lineTo(b, h);
  shape.lineTo(b, h - tf);
  shape.lineTo(w, h - tf);
  shape.lineTo(w, -h + tf);
  shape.lineTo(b, -h + tf);
  shape.lineTo(b, -h);
  shape.lineTo(-b, -h);
  shape.lineTo(-b, -h + tf);
  shape.lineTo(-w, -h + tf);
  shape.lineTo(-w, h - tf);
  shape.lineTo(-b, h - tf);
  shape.closePath();
  return shape;
}

function channelShape(d: number, bf: number, tw: number, tf: number): THREE.Shape | null {
  if (tw >= bf || tf * 2 >= d) return null;
  const h = d / 2;
  const x0 = -bf / 2;
  const x1 = x0 + tw;
  const x2 = bf / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0, h);
  shape.lineTo(x2, h);
  shape.lineTo(x2, h - tf);
  shape.lineTo(x1, h - tf);
  shape.lineTo(x1, -h + tf);
  shape.lineTo(x2, -h + tf);
  shape.lineTo(x2, -h);
  shape.lineTo(x0, -h);
  shape.closePath();
  return shape;
}

function teeShape(d: number, b: number, tw: number, tf: number): THREE.Shape | null {
  if (tw >= b || tf >= d) return null;
  const x = b / 2;
  const w = tw / 2;
  const h = d / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x, h);
  shape.lineTo(x, h);
  shape.lineTo(x, h - tf);
  shape.lineTo(w, h - tf);
  shape.lineTo(w, -h);
  shape.lineTo(-w, -h);
  shape.lineTo(-w, h - tf);
  shape.lineTo(-x, h - tf);
  shape.closePath();
  return shape;
}

function angleShape(d: number, b: number, t: number): THREE.Shape | null {
  if (t >= Math.min(d, b)) return null;
  const x = b / 2;
  const y = d / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(-x + t, -y);
  shape.lineTo(-x + t, y - t);
  shape.lineTo(x, y - t);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  return shape;
}

function boxShape(h: number, b: number, t: number): THREE.Shape | null {
  if (t * 2 >= Math.min(h, b)) return null;
  const x = b / 2;
  const y = h / 2;
  const shape = solidRectShape(h, b);
  if (!shape) return null;
  const innerX = x - t;
  const innerY = y - t;
  const hole = new THREE.Path();
  hole.moveTo(-innerX, -innerY);
  hole.lineTo(-innerX, innerY);
  hole.lineTo(innerX, innerY);
  hole.lineTo(innerX, -innerY);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function pipeShape(d: number, t: number): THREE.Shape | null {
  const radius = d / 2;
  if (t >= radius) return null;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius - t, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function profile(section: Section, model: StructuralModel): THREE.Shape | null {
  const family = section.family.trim().toUpperCase();
  const shapeName =
    typeof section.geometry?.shape === "string"
      ? section.geometry.shape.trim().toLowerCase()
      : "";

  if (
    family === "RC-RECT" ||
    family === "WOOD-RECT" ||
    shapeName === "rectangular"
  ) {
    const depth = dim(section, ["depth", "height", "d", "D"], model);
    const width = dim(section, ["width", "b", "B", "bf"], model);
    return depth && width ? solidRectShape(depth, width) : null;
  }

  if (["W", "WF", "I", "HP", "M", "S"].includes(family)) {
    const d = dim(section, ["d", "depth", "height"], model);
    const bf = dim(section, ["bf", "flangeWidth", "width"], model);
    const tw = dim(section, ["tw", "webThickness"], model);
    const tf = dim(section, ["tf", "flangeThickness"], model);
    return d && bf && tw && tf ? iShape(d, bf, tw, tf) : null;
  }

  if (["C", "MC", "CHANNEL"].includes(family)) {
    const d = dim(section, ["d", "depth"], model);
    const bf = dim(section, ["bf", "flangeWidth", "width"], model);
    const tw = dim(section, ["tw", "webThickness"], model);
    const tf = dim(section, ["tf", "flangeThickness"], model);
    return d && bf && tw && tf ? channelShape(d, bf, tw, tf) : null;
  }

  if (["L", "ANGLE"].includes(family)) {
    const d = dim(section, ["D", "d", "depth"], model);
    const b = dim(section, ["B", "b", "width"], model);
    const t = dim(section, ["T", "t", "thickness"], model);
    return d && b && t ? angleShape(d, b, t) : null;
  }

  if (["WT", "TEE"].includes(family)) {
    const d = dim(section, ["D", "d", "depth"], model);
    const b = dim(section, ["B", "b", "width"], model);
    const tw = dim(section, ["W", "stemThickness", "webThickness"], model);
    const tf = dim(section, ["T", "t", "thickness", "flangeThickness"], model);
    return d && b && tw && tf ? teeShape(d, b, tw, tf) : null;
  }

  if (["HSS", "RHS", "SHS", "BOX", "HS SQ", "HS RE", "HA SQ", "HA RE"].includes(family)) {
    const h = dim(section, ["D", "H", "h", "height", "d", "depth"], model);
    const b = dim(section, ["B", "b", "width", "bf"], model);
    const t = dim(
      section,
      ["designThickness", "Tdes", "T", "t", "thickness", "wallThickness"],
      model,
    );
    return h && b && t ? boxShape(h, b, t) : null;
  }

  if (["PIPE", "CHS", "HS RO", "HA RO"].includes(family)) {
    const d = dim(section, ["D", "d", "diameter", "OD", "depth"], model);
    const t = dim(
      section,
      ["designThickness", "Tdes", "T", "t", "thickness", "wallThickness"],
      model,
    );
    return d && t ? pipeShape(d, t) : null;
  }

  return null;
}

function axes(member: Member, x: THREE.Vector3) {
  let y: THREE.Vector3;
  let z: THREE.Vector3;

  if (member.localAxes?.convention === "right-handed") {
    y = v3(member.localAxes.y).normalize();
    z = v3(member.localAxes.z).normalize();
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

export function buildRealMemberGeometry(
  model: StructuralModel,
  member: Member,
  start: THREE.Vector3,
  end: THREE.Vector3,
): THREE.BufferGeometry | null {
  const section = model.sections.find((item) => item.id === member.sectionId);
  if (!section) return null;

  const shape = profile(section, model);
  if (!shape) return null;

  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 1e-9) return null;

  const x = direction.normalize();
  const { y, z } = axes(member, x);
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
