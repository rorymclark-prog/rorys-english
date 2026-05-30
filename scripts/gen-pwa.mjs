// Generates a per-student PWA manifest from content/students.json so each
// student's installed app launches straight into their own page (full-screen,
// isolated). Runs automatically on `predev` and `prebuild` — so "add a student =
// edit JSON" stays true, no manual manifest editing.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const students = JSON.parse(readFileSync(join(root, "content", "students.json"), "utf-8"));

// Match next.config's basePath so manifests work under a sub-path host.
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

const icons = [
  { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
];

const outDir = join(root, "public", "m");
mkdirSync(outDir, { recursive: true });

for (const s of students) {
  const manifest = {
    name: `Rory's English — ${s.displayName}`,
    short_name: "English",
    start_url: `${base}/s/${s.code}/`,
    scope: `${base}/s/${s.code}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#FDF6EC",
    theme_color: "#1E3A5F",
    icons,
    // Long-press the installed icon → jump straight to a section.
    shortcuts: [
      { name: "Homework", short_name: "Homework", url: `${base}/s/${s.code}/homework/`, icons },
      { name: "Study", short_name: "Study", url: `${base}/s/${s.code}/study/`, icons },
    ],
  };
  writeFileSync(join(outDir, `${s.code}.webmanifest`), JSON.stringify(manifest, null, 2));
}

// A generic root manifest for the landing page.
writeFileSync(
  join(root, "public", "manifest.webmanifest"),
  JSON.stringify(
    {
      name: "Rory's English",
      short_name: "English",
      start_url: `${base}/`,
      scope: `${base}/`,
      display: "standalone",
      background_color: "#FDF6EC",
      theme_color: "#1E3A5F",
      icons,
    },
    null,
    2,
  ),
);

console.log(`gen-pwa: wrote ${students.length} student manifest(s) + root manifest`);
