"use client";
import { useRef, useState, type ReactNode } from "react";
export type MobileFrameTab = "plan" | "members" | "project";
export default function MobileFrameSheet({
  tab,
  open,
  title,
  onTab,
  onClose,
  children,
}: {
  tab: MobileFrameTab;
  open: boolean;
  title: string;
  onTab: (tab: MobileFrameTab) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  return (
    <>
      <section
        className={`sfMobileSheet ${expanded ? "sfMobileSheetExpanded" : ""}`}
        id="mobile-model-panel"
        role="tabpanel"
        aria-label={title}
        hidden={!open}
      >
        <header
          className="sfSheetHeader"
          onPointerDown={(e) => {
            dragged.current = false;
            start.current = e.clientY;
          }}
          onPointerMove={(e) => {
            if (
              start.current !== null &&
              Math.abs(e.clientY - start.current) > 20
            ) {
              dragged.current = true;
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }
          }}
          onPointerUp={(e) => {
            if (start.current === null) return;
            const dy = e.clientY - start.current;
            start.current = null;
            dragged.current = Math.abs(dy) > 20;
            if (dy < -35) setExpanded(true);
            if (dy > 45) {
              if (expanded) setExpanded(false);
              else onClose();
            }
          }}
          onClickCapture={(e) => {
            if (dragged.current && e.detail !== 0) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onPointerCancel={() => {
            start.current = null;
          }}
        >
          <button
            className="sfSheetResize"
            aria-label={expanded ? "Reduce panel" : "Expand panel"}
            onClick={() => setExpanded(!expanded)}
          >
            <span aria-hidden="true" />
            <strong>{title}</strong>
          </button>
          <button aria-label="Close panel" onClick={onClose}>
            ×
          </button>
        </header>
        <div
          className="sfSheetBody"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        >
          {open ? children : null}
        </div>
      </section>
      <nav className="sfMobileTabs" role="tablist" aria-label="Model panels">
        {(
          [
            { id: "plan", icon: "▦", label: "Plan & levels" },
            { id: "members", icon: "⌁", label: "Members" },
            { id: "project", icon: "⚙", label: "Project" },
          ] as const
        ).map((item) => (
          <button
            role="tab"
            key={item.id}
            aria-selected={open && tab === item.id}
            aria-controls="mobile-model-panel"
            onClick={() => onTab(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
