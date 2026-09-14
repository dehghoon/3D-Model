"use client";

import { useEffect, useState } from "react";
import type { SnapCandidateEventDetail } from "../lib/visualization/snap-resolver";

interface SnapMarkerState {
  x: number;
  y: number;
  label?: string;
}

export default function SnapCandidateOverlayV01() {
  const [marker, setMarker] = useState<SnapMarkerState | null>(null);

  useEffect(() => {
    const clearMarker = () => setMarker(null);

    const handleSnapCandidate = (event: Event): void => {
      const detail = (event as CustomEvent<SnapCandidateEventDetail>).detail;

      if (
        !detail?.active ||
        typeof detail.clientX !== "number" ||
        typeof detail.clientY !== "number"
      ) {
        clearMarker();
        return;
      }

      setMarker({
        x: detail.clientX,
        y: detail.clientY,
        label: detail.label,
      });
    };

    window.addEventListener("linkoteq:snap-candidate", handleSnapCandidate);
    window.addEventListener("linkoteq:view-cycle", clearMarker);
    window.addEventListener("linkoteq:view-select", clearMarker);
    window.addEventListener("blur", clearMarker);

    return () => {
      window.removeEventListener("linkoteq:snap-candidate", handleSnapCandidate);
      window.removeEventListener("linkoteq:view-cycle", clearMarker);
      window.removeEventListener("linkoteq:view-select", clearMarker);
      window.removeEventListener("blur", clearMarker);
    };
  }, []);

  if (!marker) return null;

  return (
    <div
      aria-hidden="true"
      title={marker.label}
      style={{
        position: "fixed",
        left: marker.x,
        top: marker.y,
        width: 18,
        height: 18,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: "100%",
          transform: "translateX(-50%) rotate(45deg)",
          background: "currentColor",
          color: "#ffb000",
          boxShadow: "0 0 3px rgba(0, 0, 0, 0.75)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: "100%",
          transform: "translateX(-50%) rotate(-45deg)",
          background: "currentColor",
          color: "#ffb000",
          boxShadow: "0 0 3px rgba(0, 0, 0, 0.75)",
        }}
      />
    </div>
  );
}
