"use client";

import { useEffect, useState } from "react";
import type { MemberType, StructuralModel } from "@linkoteq/structural-core";
import { createMemberFromCanonicalRefs } from "../lib/editor-modeling-v05";

interface Props {
  model: StructuralModel;
  onModelChange: (model: StructuralModel, status: string) => void;
  onMemberCreated?: (memberId: string) => void;
}

export default function MemberCreatorV05({ model, onModelChange, onMemberCreated }: Props) {
  const [type, setType] = useState<MemberType>("beam");
  const [startNodeId, setStartNodeId] = useState("");
  const [endNodeId, setEndNodeId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [sectionId, setSectionId] = useState("");

  useEffect(() => {
    if (!model.nodes.some((item) => item.id === startNodeId)) setStartNodeId(model.nodes[0]?.id ?? "");
    if (!model.nodes.some((item) => item.id === endNodeId)) setEndNodeId(model.nodes[1]?.id ?? model.nodes[0]?.id ?? "");
    if (!model.materials.some((item) => item.id === materialId)) setMaterialId(model.materials[0]?.id ?? "");
    if (!model.sections.some((item) => item.id === sectionId)) setSectionId(model.sections[0]?.id ?? "");
  }, [model, startNodeId, endNodeId, materialId, sectionId]);

  const ready =
    Boolean(startNodeId && endNodeId && materialId && sectionId) &&
    startNodeId !== endNodeId;

  function createMember() {
    try {
      const result = createMemberFromCanonicalRefs(model, {
        type,
        startNodeId,
        endNodeId,
        materialId,
        sectionId,
      });
      onModelChange(result.model, `Created ${result.member.type} ${result.member.id} from canonical Core v0.5 references.`);
      onMemberCreated?.(result.member.id);
    } catch (error) {
      onModelChange(model, error instanceof Error ? error.message : "Member creation failed.");
    }
  }

  return (
    <section className="panelBlock">
      <h3>Create Member</h3>
      <label>
        Type
        <select value={type} onChange={(event) => setType(event.target.value as MemberType)}>
          <option value="beam">Beam</option>
          <option value="column">Column</option>
          <option value="brace">Brace</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Start node
        <select value={startNodeId} onChange={(event) => setStartNodeId(event.target.value)}>
          <option value="">Select node</option>
          {model.nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
        </select>
      </label>
      <label>
        End node
        <select value={endNodeId} onChange={(event) => setEndNodeId(event.target.value)}>
          <option value="">Select node</option>
          {model.nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
        </select>
      </label>
      <label>
        Material
        <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
          <option value="">Select material</option>
          {model.materials.map((material) => <option key={material.id} value={material.id}>{material.name} ({material.id})</option>)}
        </select>
      </label>
      <label>
        Section
        <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
          <option value="">Select section</option>
          {model.sections.map((section) => <option key={section.id} value={section.id}>{section.designation ?? section.id}</option>)}
        </select>
      </label>
      <button onClick={createMember} disabled={!ready}>Create member</button>
      {!model.materials.length || !model.sections.length ? (
        <p className="selectionText">Import or load approved canonical material and section records before creating members.</p>
      ) : null}
    </section>
  );
}
