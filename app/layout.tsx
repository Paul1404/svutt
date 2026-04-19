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

// Runs before React hydrates to prevent a flash of the wrong theme.
const NO_FLASH_SCRIPT = `
try {
  var s = localStorage.getItem('svutt-theme');
  var t = s === 'light' || s === 'dark'
    ? s
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
} catch (_) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
