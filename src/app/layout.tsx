import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// Self-hosted at build time (static export downloads them once) — no runtime
// requests to Google, works offline like the rest of the PWA.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

// Next does NOT auto-prefix metadata icon/manifest URLs with basePath, so we
// add it ourselves (empty for root hosts, "/rorys-english" for GitHub Pages).
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Rory's English",
  description: "Your homework and study tools, in one place.",
  // Private per-student pages — keep them out of search engines.
  robots: { index: false, follow: false },
  manifest: `${base}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rory's English",
  },
  icons: {
    icon: `${base}/icons/icon-192.png`,
    apple: `${base}/icons/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F5" },
    { media: "(prefers-color-scheme: dark)", color: "#17161C" },
  ],
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom (accessibility) — the in-app text-size setting is a
  // convenience, not a replacement for the OS zoom.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${jetbrains.variable}`}>
      <body className="font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
