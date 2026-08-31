import "./globals.css";
import "./load-manager-fix.css";
import "./overrides.css";
import "./main-site-shell.css";
import "./sap2000-shell.css";
import "./engineering-ribbon.css";
import "./architect-editor.css";
import "./architect-workspace.css";
import "./contextual-helper.css";
import "./level-grid-editor.css";
import "./modeling-window.css";

export const metadata = {
  title: "LinkoTeq 3D Structural Model",
  description: "Create, load, and prepare structural models for connected engineering analysis."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
