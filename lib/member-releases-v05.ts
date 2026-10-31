import type { Member, MemberEndRelease, StructuralModel } from "@linkoteq/structural-core";

/** Core v0.5 release flags: true means the corresponding member-end DOF is released. */
export const RELEASE_DOFS = ["DX", "DY", "DZ", "RX", "RY", "RZ"] as const;
export type ReleaseDOF = (typeof RELEASE_DOFS)[number];
export type ReleaseEnd = "start" | "end";
export type ReleasePreset = "fixed" | "pinned" | "all-released";

export function releasePreset(preset: ReleasePreset): MemberEndRelease {
  const released = preset === "all-released";
  return {
    DX: released, DY: released, DZ: released,
    RX: preset !== "fixed", RY: preset !== "fixed", RZ: preset !== "fixed",
  };
}

export function updateMemberEndRelease(
  model: StructuralModel,
  memberIds: readonly string[],
  end: ReleaseEnd,
  release: MemberEndRelease,
): StructuralModel {
  if (end !== "start" && end !== "end") throw new Error("INVALID_RELEASE_END");
  if (!memberIds.length) throw new Error("NO_MEMBERS_SELECTED");
  const selected = new Set(memberIds);
  if (selected.size !== memberIds.length) throw new Error("DUPLICATE_MEMBER_SELECTION");
  for (const dof of RELEASE_DOFS) {
    const value = release[dof];
    if (value !== undefined && typeof value !== "boolean") {
      throw new Error(`INVALID_RELEASE_FLAG:${dof}`);
    }
  }
  const existing = new Set(model.members.map((member) => member.id));
  for (const id of selected) {
    if (!existing.has(id)) throw new Error(`UNKNOWN_MEMBER:${id}`);
  }
  const key = end === "start" ? "startRelease" : "endRelease";
  const members: Member[] = model.members.map((member) =>
    selected.has(member.id)
      ? { ...member, [key]: { ...release } }
      : member,
  );
  return { ...model, members };
}
