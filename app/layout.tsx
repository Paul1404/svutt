import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SV 1945 Untereuerheim — Tischtennis-Turniere",
    template: "%s · SV Untereuerheim Tischtennis",
  },
  description:
    "Tischtennis-Turniere des SV 1945 Untereuerheim e.V. — Gruppen, Ergebnisse und Finalrunde live verfolgen.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: "/logo.png",
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
