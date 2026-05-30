// When hosted under a sub-path (e.g. GitHub Pages at /rorys-english), set
// NEXT_PUBLIC_BASE_PATH=/rorys-english at build time. Empty for root hosts
// (Vercel/Netlify) and local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pure static export: no server, deploys to Vercel/Netlify/GitHub Pages, best
  // offline behaviour, fast on old phones. All state is client-side
  // (content JSON shipped in the bundle, progress in localStorage).
  output: "export",
  basePath,
  reactStrictMode: true,
  images: { unoptimized: true },
  // Clean static paths for the dynamic /s/[code] routes so each resolves to an
  // index.html the service worker can cache for offline use.
  trailingSlash: true,
};

export default nextConfig;
