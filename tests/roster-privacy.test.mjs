// The roster (content/students.json: names, sign-in codes, parent codes, profiles) must never be
// bundled into browser code, because everything under .next/static is downloadable without signing in.
// Server components read it through src/lib/content.ts and pass each page only what it needs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
const read = (p) => fs.readFileSync(p, "utf8");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

// Value imports only: `import type` is erased by the compiler and never reaches a bundle.
function importsOf(file) {
  const out = [];
  for (const m of read(file).matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) {
    out.push(m[1] || m[2]);
  }
  return out;
}

function clientReachable() {
  const roots = walk(SRC).filter((f) => /^\s*["']use client["']/.test(read(f)));
  const seen = new Map(roots.map((f) => [f, [path.relative(SRC, f)]]));
  const queue = [...roots];
  while (queue.length) {
    const file = queue.shift();
    for (const spec of importsOf(file)) {
      const next = resolveImport(file, spec);
      if (next && !seen.has(next)) {
        seen.set(next, [...seen.get(file), path.relative(SRC, next)]);
        queue.push(next);
      }
    }
  }
  return seen;
}

test("no client component, nor anything it imports, imports students.json", () => {
  const reachable = clientReachable();
  assert.ok(reachable.size > 100, "the walk should cover the client code");
  const bad = [];
  for (const [file, chain] of reachable) {
    if (importsOf(file).some((spec) => /students\.json$/.test(spec))) bad.push(chain.join(" -> "));
  }
  assert.deepEqual(bad, [], "these client files pull content/students.json into public JavaScript");
});

test("only server code reads the roster", () => {
  const readers = walk(SRC).filter((f) => importsOf(f).some((spec) => /students\.json$/.test(spec))).map((f) => path.relative(SRC, f)).sort();
  assert.deepEqual(readers, ["app/api/voice/route.ts"]);
});

test("no sign-in code is written into code the browser downloads", () => {
  const students = JSON.parse(read("content/students.json"));
  const codes = students.flatMap((s) => [s.code, s.parentCode]).filter(Boolean);
  const leaks = [];
  for (const [file] of clientReachable()) {
    const text = read(file);
    codes.forEach((value, i) => { if (text.includes(value)) leaks.push(`${path.relative(SRC, file)} (code #${i + 1})`); });
  }
  assert.deepEqual(leaks, [], "a student or parent code is hard-coded in browser-reachable source");
});

test("the teacher workspace gets its students from the signed-in dashboard reply, and parent previews carry only names and codes", () => {
  const view = read("src/components/views/TeacherDashboardView.tsx");
  assert.match(view, /d\.roster\?\?\[\]/, "the workspace keeps the roster from the teacherDashboard reply");
  assert.match(read("src/lib/content.ts"), /export function getTeacherExtras/);
  // Nothing from the profile or the unit list is passed down.
  const fn = read("src/lib/content.ts").match(/export function getTeacherRoster[\s\S]*?\n}\n/)[0];
  assert.doesNotMatch(fn, /profile|progressLinks|units|greeting/);
  // The public parent page no longer lists the other families; the teacher's own tab remembers them.
  assert.doesNotMatch(read("src/components/ParentPreviewBanner.tsx"), /students\.json|roster\./);
  assert.match(read("src/components/ParentPreviewBanner.tsx"), /parentPreviewRoster\(\)/);
  // The remembered list is keyed by parent code, because the banner links to /p/<parent code>/.
  assert.match(read("src/components/AppMenu.tsx"), /parentRoster=roster\.map\(s=>\(\{code:s\.parentCode,name:s\.name\}\)\)/);
  assert.match(read("src/components/AppMenu.tsx"), /roster=\{parentRoster\}/);
});

test("the post-build check exists and gates on codes and parent codes", () => {
  const script = read("scripts/check-roster-privacy.mjs");
  assert.match(script, /\.next["'], ?["']static/);
  assert.match(script, /parentCode/);
  assert.match(script, /process\.exit\(total \? 1 : 0\)/);
});
