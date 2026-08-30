"use client";

import dynamic from "next/dynamic";
import ContextualHelperController from "../components/ContextualHelperController";

const StructuralEditor = dynamic(() => import("../components/StructuralEditor"), { ssr: false });

export default function Page() {
  return (
    <main className="modelEditorArea sapDesktopShell">
      <ContextualHelperController />
      <StructuralEditor />
    </main>
  );
}
