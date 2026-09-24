// When hosted under a sub-path (e.g. GitHub Pages at /rorys-english), set
// NEXT_PUBLIC_BASE_PATH=/rorys-english at build time. Empty for root hosts
// (Vercel/Netlify) and local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Content-Security-Policy, shipped in Report-Only first. The browser reports
// what it WOULD have blocked without blocking anything, so a week of quiet
// console output is the evidence needed before switching the header name to
// "Content-Security-Policy". Flip it there — the policy itself does not change.
//
// 'unsafe-inline' for scripts is not a shortcut: Next's own bootstrap and the
// pre-paint theme script are both inline, and a nonce cannot be minted for a
// statically pre-rendered page.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",          // recorded homework audio
  "font-src 'self'",                 // next/font self-hosts; nothing external
  "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com", // Google sign-in
  "worker-src 'self'",               // the offline service worker
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",          // the app is never embedded anywhere
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Students speak and scan documents in the app itself, and nothing else needs
  // a sensor. This is also what stops an embedded third party asking on our behalf.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
