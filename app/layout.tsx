import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SVUTT Tischtennis-Turniere",
  description:
    "Tischtennis-Turniere einfach verwalten. Gruppen ziehen, Ergebnisse eingeben, Finalrunde live zeigen.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
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
