"use client";

import { useEffect } from "react";
import {
  cancelMemberDraw,
  useMemberDrawState,
} from "../lib/editor/member-draw-store";

function labelForType(type: string | null): string {
  if (!type) return "Member";
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

export default function MemberDrawStatusBarV01() {
  const state = useMemberDrawState();

  useEffect(() => {
    if (!state.active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelMemberDraw();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.active]);

  if (!state.active) return null;

  const prompt = state.start ? "Pick second point" : "Pick first point";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Member drawing prompt"
      style={{
        position: "absolute",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: "min(360px, 88vw)",
        justifyContent: "center",
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid rgba(148, 163, 184, 0.55)",
        background: "rgba(15, 23, 42, 0.92)",
        color: "#f8fafc",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.28)",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      <strong>{labelForType(state.type)}</strong>
      <span>{prompt}</span>
      <span style={{ opacity: 0.72, fontSize: 12 }}>Esc to cancel</span>
    </div>
  );
}
