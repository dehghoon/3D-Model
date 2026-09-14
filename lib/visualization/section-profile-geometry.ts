import * as THREE from "three";
import type { Member, Section, StructuralModel, Vec3 } from "@linkoteq/structural-core";

const UNIT_FACTOR: Record<string, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

const toThree = (value: Vec3) => new THREE.Vector3(value.x, value.z, value.y);

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
    const value = model.project.units === "US" ? metres / 0.3048 : metres;
    if (value > 0) return value;
  }

  return null;
}

function rectangleShape(height: number, width: number): THREE.Shape | null {
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

function channelShape(
  depth: number,
  flangeWidth: number,
  webThickness: number,
  flangeThickness: number,
): THREE.Shape | null {
  if (
    webThickness <= 0 ||
    flangeThickness <= 0 ||
    webThickness >= flangeWidth ||
    flangeThickness * 2 >= depth
  ) {
    return null;
  }

  const h = depth / 2;
  const x0 = -flangeWidth / 2;
  const x1 = x0 + webThickness;
  const x2 = flangeWidth / 2;

  const shape = new THREE.Shape();
  shape.moveTo(x0, h);
  shape.lineTo(x2, h);
  shape.lineTo(x2, h - flangeThickness);
  shape.lineTo(x1, h - flangeThickness);
  shape.lineTo(x1, -h + flangeThickness);
  shape.lineTo(x2, -h + flangeThickness);
  shape.lineTo(x2, -h);
  shape.lineTo(x0, -h);
  shape.closePath();
  return shape;
}

function teeShape(
  depth: number,
  width: number,
  webThickness: number,
  flangeThickness: number,
): THREE.Shape | null {
  if (
    webThickness <= 0 ||
    flangeThickness <= 0 ||
    webThickness >= width ||
    flangeThickness >= depth
  ) {
    return null;
  }

  const x = width / 2;
  const w = webThickness / 2;
  const h = depth / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-x, h);
  shape.lineTo(x, h);
  shape.lineTo(x, h - flangeThickness);
  shape.lineTo(w, h - flangeThickness);
  shape.lineTo(w, -h);
  shape.lineTo(-w, -h);
  shape.lineTo(-w, h - flangeThickness);
  shape.lineTo(-x, h - flangeThickness);
  shape.closePath();
  return shape;
}

function angleShape(depth: number, width: number, thickness: number): THREE.Shape | null {
  if (thickness <= 0 || thickness >= Math.min(depth, width)) return null;

  const x = width / 2;
  const y = depth / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(-x + thickness, -y);
  shape.lineTo(-x + thickness, y - thickness);
  shape.lineTo(x, y - thickness);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  return shape;
}

function hollowBoxShape(
  height: number,
  width: number,
  thickness: number,
): THREE.Shape | null {
  if (
    height <= 0 ||
    width <= 0 ||
    thickness <= 0 ||
    thickness * 2 >= Math.min(height, width)
  ) {
    return null;
  }

  const shape = rectangleShape(height, width);
  if (!shape) return null;

  const x = width / 2 - thickness;
  const y = height / 2 - thickness;
  const hole = new THREE.Path();
  hole.moveTo(-x, -y);
  hole.lineTo(-x, y);
  hole.lineTo(x, y);
  hole.lineTo(x, -y);
  hole.closePath();
  shape.holes.push(hole);

  return shape;
}

function pipeShape(diameter: number, thickness: number): THREE.Shape | null {
  const radius = diameter / 2;
  if (diameter <= 0 || thickness <= 0 || thickness >= radius) return null;

  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);

  const hole = new THREE.Path();
  hole.absarc(0, 0, radius - thickness, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  return shape;
}

function profileShape(
  section: Section,
  model: StructuralModel,
): THREE.Shape | null {
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
    const depth = dimension(section, ["depth", "height", "d", "D"], model);
    const width = dimension(section, ["width", "b", "B", "bf"], model);
    return depth && width ? rectangleShape(depth, width) : null;
  }

  if (["W", "WF", "I", "HP", "M", "S"].includes(family)) {
    const d = dimension(section, ["d", "D", "depth", "height"], model);
    const bf = dimension(section, ["bf", "B", "flangeWidth", "width"], model);
    const tw = dimension(section, ["tw", "W", "webThickness"], model);
    const tf = dimension(section, ["tf", "T", "flangeThickness"], model);

    return d && bf && tw && tf ? wideFlangeShape(d, bf, tw, tf) : null;
  }

  if (["C", "MC", "CHANNEL"].includes(family)) {
    const d = dimension(section, ["d", "D", "depth"], model);
    const bf = dimension(section, ["bf", "B", "flangeWidth", "width"], model);
    const tw = dimension(section, ["tw", "W", "webThickness"], model);
    const tf = dimension(section, ["tf", "T", "flangeThickness"], model);
    return d && bf && tw && tf ? channelShape(d, bf, tw, tf) : null;
  }

  if (["WT", "TEE"].includes(family)) {
    const d = dimension(section, ["D", "d", "depth"], model);
    const b = dimension(section, ["B", "b", "width"], model);
    const tw = dimension(section, ["W", "stemThickness", "webThickness"], model);
    const tf = dimension(section, ["T", "t", "thickness", "flangeThickness"], model);
    return d && b && tw && tf ? teeShape(d, b, tw, tf) : null;
  }

  if (["L", "ANGLE"].includes(family)) {
    const d = dimension(section, ["D", "d", "depth"], model);
    const b = dimension(section, ["B", "b", "width"], model);
    const t = dimension(section, ["T", "t", "thickness"], model);
    return d && b && t ? angleShape(d, b, t) : null;
  }

  if (["HSS", "RHS", "SHS", "BOX", "HS SQ", "HS RE", "HA SQ", "HA RE"].includes(family)) {
    const h = dimension(section, ["D", "H", "h", "height", "d", "depth"], model);
    const b = dimension(section, ["B", "b", "width", "bf"], model);
    const t = dimension(
      section,
      ["designThickness", "Tdes", "T", "t", "thickness", "wallThickness"],
      model,
    );
    return h && b && t ? hollowBoxShape(h, b, t) : null;
  }

  if (["PIPE", "CHS", "HS RO", "HA RO"].includes(family)) {
    const d = dimension(section, ["D", "d", "diameter", "OD", "depth"], model);
    const t = dimension(
      section,
      ["designThickness", "Tdes", "T", "t", "thickness", "wallThickness"],
      model,
    );
    return d && t ? pipeShape(d, t) : null;
  }

  return null;
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

export function buildRealMemberGeometry(
  model: StructuralModel,
  member: Member,
  start: THREE.Vector3,
  end: THREE.Vector3,
): THREE.BufferGeometry | null {
  const section = model.sections.find((item) => item.id === member.sectionId);
  if (!section) return null;

  const shape = profileShape(section, model);
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
