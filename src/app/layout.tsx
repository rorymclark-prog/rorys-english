import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./design.css";
import "./documents.css";
import "./homework.css";
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
    icon: `${base}/icons/r-icon-192.png`,
    apple: `${base}/icons/r-apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#151C2B" },
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
        {process.env.NEXT_PUBLIC_DEMO_MODE==="true" && <div className="bg-amber-100 p-3 text-center text-sm font-bold text-slate-900">LOCAL PREVIEW · Dummy homework and feedback · Nothing here changes real student records</div>}
        {children}
        {process.env.NEXT_PUBLIC_DEMO_MODE!=="true" && <ServiceWorkerRegister />}
      </body>
    </html>
  );
}
