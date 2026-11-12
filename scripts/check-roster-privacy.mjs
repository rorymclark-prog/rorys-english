// After `npm run build`: does any public static asset contain the roster?
//
// Reads content/students.json and greps .next/static for the key name
// "parentCode" and for every student's code and parent code. Display names are
// reported for information only (first names also appear in release notes and
// course copy on purpose). Prints only counts and file names, never the values.
// Exits 1 if a code, parent code or the parentCode key is found, so it can gate a deploy.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const students = JSON.parse(readFileSync(join(root, "content", "students.json"), "utf-8"));
const staticDir = join(root, ".next", "static");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(js|css|json|html|txt|map)$/.test(name)) yield p;
  }
}

// The bare word also appears as a property name in app code (menu, teacher tools), which is fine;
// what must not appear is the key holding a string value, i.e. roster data.
const probes = [{ label: 'key parentCode with a string value', pattern: /["']?parentCode["']?\s*:\s*["'`]/ }];
const info = [{ label: "word parentCode as a code property (info only)", needle: "parentCode" }];
students.forEach((s, i) => {
  probes.push({ label: `student ${i + 1} code`, needle: s.code });
  if (s.parentCode) probes.push({ label: `student ${i + 1} parentCode`, needle: s.parentCode });
  info.push({ label: `student ${i + 1} displayName (info only)`, needle: s.displayName });
});

let total = 0;
const scan = (title, files) => {
  const hits = new Map([...probes, ...info].map((p) => [p.label, new Set()]));
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    for (const p of [...probes, ...info]) if (p.pattern ? p.pattern.test(text) : p.needle && text.includes(p.needle)) hits.get(p.label).add(file.slice(root.length + 1));
  }
  console.log(`== ${title}`);
  for (const p of [...probes, ...info]) {
    const found = [...hits.get(p.label)];
    if (probes.includes(p)) total += found.length;
    console.log(`${p.label}: ${found.length} file(s)${found.length ? " -> " + found.join(", ") : ""}`);
  }
};
scan(".next/static (public JavaScript)", walk(staticDir));
// The teacher pages are prerendered, so their HTML and RSC payload are public too.
const serverApp = join(root, ".next", "server", "app");
const teacherFiles = readdirSync(serverApp, { recursive: true })
  .map(String)
  .filter((f) => /^teacher(\/|\.)/.test(f) && /\.(html|rsc|segment\.rsc)$/.test(f))
  .map((f) => join(serverApp, f));
scan(`prerendered teacher pages (${teacherFiles.length} files under .next/server/app/teacher*)`, teacherFiles);
console.log(total ? `FAIL: ${total} match(es) in public output` : "OK: roster not found in public output");
process.exit(total ? 1 : 0);
