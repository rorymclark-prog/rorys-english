// When hosted under a sub-path (e.g. GitHub Pages at /rorys-english), set
// NEXT_PUBLIC_BASE_PATH=/rorys-english at build time. Empty for root hosts
// (Vercel/Netlify) and local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel serves pre-rendered lessons plus the account-verifying API route.
  // Private progress stays in the authenticated Google service.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: process.cwd(),
  basePath,
  reactStrictMode: true,
  // Bundle the Auth verifier so CommonJS dependencies do not require ESM
  // through Vercel’s runtime loader.
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"],
  images: { unoptimized: true },
  // Keep established student and lesson links consistent.
  trailingSlash: true,
};

export default nextConfig;
