import "./globals.css";
import "./load-manager-fix.css";
import "./overrides.css";
import "./main-site-shell.css";

export const metadata = {
  title: "LinkoTech 3D Structural Model",
  description: "Create, load, and prepare structural models for connected engineering analysis."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
