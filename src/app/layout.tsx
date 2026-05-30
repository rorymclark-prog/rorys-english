import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

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
  themeColor: "#1E3A5F",
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom (accessibility) — the in-app text-size setting is a
  // convenience, not a replacement for the OS zoom.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
