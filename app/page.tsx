"use client";

import dynamic from "next/dynamic";

const StructuralEditor = dynamic(() => import("../components/StructuralEditor"), { ssr: false });

export default function Page() {
  return (
    <main className="modelEditorArea sapDesktopShell">
      <StructuralEditor />
    </main>
  );
}
