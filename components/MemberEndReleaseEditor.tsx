"use client";

import { useState } from "react";
import type { Member, MemberEndRelease, StructuralModel } from "@linkoteq/structural-core";
import { RELEASE_DOFS, releasePreset, updateMemberEndRelease, type ReleaseEnd, type ReleasePreset } from "../lib/member-releases-v05";

type Props = {
  model: StructuralModel;
  selectedMembers: Member[];
  onModelChange: (next: StructuralModel, message: string) => void;
};

export default function MemberEndReleaseEditor({ model, selectedMembers, onModelChange }: Props) {
  const [end, setEnd] = useState<ReleaseEnd>("end");
  const [flags, setFlags] = useState<MemberEndRelease>(() => releasePreset("pinned"));
  const [status, setStatus] = useState("");
  function apply() {
    try {
      const next = updateMemberEndRelease(model, selectedMembers.map((m) => m.id), end, flags);
      onModelChange(next, `Updated ${selectedMembers.length} member ${end} release(s).`);
      setStatus("Applied to the selected members.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Release update failed.");
    }
  }
  return (
    <section className="panelBlock">
      <h3>Member End Releases (Core v0.5)</h3>
      <p>Selected members: {selectedMembers.length}. Checked = released DOF.</p>
      <label>End
        <select value={end} onChange={(event) => setEnd(event.target.value as ReleaseEnd)}>
          <option value="start">Start (I)</option>
          <option value="end">End (J)</option>
        </select>
      </label>
      <label>Preset
        <select defaultValue="pinned" onChange={(event) => setFlags(releasePreset(event.target.value as ReleasePreset))}>
          <option value="pinned">Pinned (release RX/RY/RZ)</option>
          <option value="fixed">Fixed (no releases)</option>
          <option value="all-released">All six DOFs released (advanced)</option>
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {RELEASE_DOFS.map((dof) => (
          <label key={dof}>
            <input type="checkbox" checked={Boolean(flags[dof])} onChange={(event) => setFlags((current) => ({ ...current, [dof]: event.target.checked }))} />
            {dof}
          </label>
        ))}
      </div>
      <button type="button" disabled={!selectedMembers.length} onClick={apply}>Apply releases</button>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
