import "./globals.css";
import EditorShortcuts from "../components/EditorShortcuts";

export const metadata = {
  title: "Linkoteq 3D Structural Model",
  description: "Prototype structural model editor"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><EditorShortcuts />{children}</body>
    </html>
  );
}
