import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SVUTT — Tischtennis Turniersoftware",
  description:
    "Open-Source-Software zur Verwaltung von Tischtennis-Turnieren (Gruppen, Spielpläne, Finale).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
