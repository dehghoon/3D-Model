import "./globals.css";
import "./load-manager-fix.css";
import "./overrides.css";
import "./main-site-shell.css";
import "./sap2000-shell.css";
import "./engineering-ribbon.css";
import "./architect-editor.css";
import "./architect-editor-v3.css";
import "./architect-editor-v4.css";
import "./architect-editor-v5.css";
import "./architect-workspace.css";
import "./contextual-helper.css";
import "./level-grid-editor.css";
import "./modeling-window.css";
import "./grid-modal.css";
import "./grid-offset-editor.css";
import "./editor-selection-ux.css";
import "./engineering-properties-v05.css";
import "./point-input.css";
import "./simple-frame.css";
import "./platform-navigation.css";
import PlatformNavigation from "../components/PlatformNavigation";

export const metadata = {
  title: "3D Structural Modeling Editor (Beta) | Linkoteq",
  description: "Explore Linkoteq's beta 3D structural modeling editor for grids, beams, columns and model import. Features are under development and require appropriate access.",
  alternates: { canonical: "https://3dmodel.linkoteq.com/" },
  robots: { index: true, follow: true },
  openGraph: { title: "3D Structural Modeling Editor (Beta) | Linkoteq", description: "Explore Linkoteq's beta 3D structural modeling editor for grids, beams, columns and model import. Features are under development and require appropriate access.", url: "https://3dmodel.linkoteq.com/", type: "website" as const },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="https://linkoteq.com/design-system/linkoteq-shell-v1.css" /></head>
      <body><PlatformNavigation />{children}</body>
    </html>
  );
}

