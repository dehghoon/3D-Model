import "./globals.css";
import "./load-manager-fix.css";

export const metadata = {
  title: "Linkoteq 3D Structural Model",
  description: "Prototype structural model editor"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
