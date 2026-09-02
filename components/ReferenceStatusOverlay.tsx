"use client";

import { useEffect, useState } from "react";
import type { ReferenceStatus } from "../lib/visualization/that-open-runtime";

export default function ReferenceStatusOverlay() {
  const [status, setStatus] = useState<ReferenceStatus>({
    kind: "view",
    label: "3D",
  });

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const custom = event as CustomEvent<ReferenceStatus>;
      if (custom.detail) setStatus(custom.detail);
    };

    window.addEventListener("linkoteq:reference-status", handleStatus);
    return () => window.removeEventListener("linkoteq:reference-status", handleStatus);
  }, []);

  return (
    <div className="referenceStatusOverlay" role="status" aria-live="polite">
      <span>{status.kind === "grid" ? "Grid" : status.kind === "level" ? "Level" : "View"}</span>
      <strong>{status.label}</strong>
    </div>
  );
}
