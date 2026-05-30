/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pure static export: no server, deploys to Vercel free tier (or anywhere),
  // best offline behaviour, fast on old phones. All state is client-side
  // (content JSON shipped in the bundle, progress in localStorage).
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  // Clean static paths for the dynamic /s/[code] routes so each resolves to an
  // index.html the service worker can cache for offline use.
  trailingSlash: true,
};

export default nextConfig;
