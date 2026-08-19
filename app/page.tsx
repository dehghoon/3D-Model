"use client";

import dynamic from "next/dynamic";
import SiteHeader from "../components/SiteHeader";

const StructuralEditor = dynamic(() => import("../components/StructuralEditor"), { ssr: false });

export default function Page() {
  return (
    <div className="modelSiteShell">
      <SiteHeader />
      <div className="modelEditorArea">
        <StructuralEditor />
      </div>
    </div>
  );
}
