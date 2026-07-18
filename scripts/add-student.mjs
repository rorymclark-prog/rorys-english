#!/usr/bin/env node
/**
 * Scaffolds the STATIC half of adding a new student.
 *
 * The teacher dashboard's "Add student" form provisions their Drive folder +
 * progress Sheet + Roster row at request time (no redeploy needed for that
 * part). But this app is a static export — a brand-new student's /s/<code>/
 * route genuinely doesn't exist until the next build, because Next needs
 * every dynamic param known at build time (generateStaticParams). This
 * script closes that gap with one command instead of hand-editing JSON:
 * it appends the student.json entry + creates their empty content folder.
 *
 * Usage:
 *   node scripts/add-student.mjs "Name" <code> <parentCode>
 *
 * <code> and <parentCode> are the ones the dashboard just showed you after
 * "Add student" — paste them exactly, so the static site and the Apps
 * Script backend agree on the same codes.
 *
 * After running: fill in content/<id>/units.json with a real unit
 * (copy content/ferdi/units.json as a template), then `npm run deploy`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content");
const STUDENTS_JSON = path.join(CONTENT_DIR, "students.json");

const [, , name, code, parentCode] = process.argv;

if (!name || !code || !parentCode) {
  console.error(
    'Usage: node scripts/add-student.mjs "Name" <code> <parentCode>\n' +
      "  code/parentCode come from the teacher dashboard's Add student result.",
  );
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/i.test(code) || !/^[a-z][a-z0-9-]*$/i.test(parentCode)) {
  console.error("code and parentCode should look like the existing ones, e.g. ferdi-7h3k");
  process.exit(1);
}

const students = JSON.parse(fs.readFileSync(STUDENTS_JSON, "utf-8"));

if (students.some((s) => s.code === code || s.parentCode === parentCode)) {
  console.error(`A student already uses code "${code}" or parent code "${parentCode}" — nothing changed.`);
  process.exit(1);
}

// Derive a unique local folder id (used for content/<id>/, NOT the URL code)
// from the first name, auto-suffixing on collision (e.g. two "Anna"s).
const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "student";
let id = base;
let n = 2;
while (students.some((s) => s.id === id) || fs.existsSync(path.join(CONTENT_DIR, id))) {
  id = `${base}${n++}`;
}

students.push({
  id,
  displayName: name,
  code,
  parentCode,
  profile: "standard",
  greeting: `Hi ${name}`,
  progressLinks: [],
  units: [], // add a real unit + copy content/ferdi/units.json as a template when ready
});
fs.writeFileSync(STUDENTS_JSON, JSON.stringify(students, null, 2) + "\n");

const studentDir = path.join(CONTENT_DIR, id);
fs.mkdirSync(studentDir, { recursive: true });
fs.writeFileSync(path.join(studentDir, "units.json"), "[]\n");

console.log(`✓ Added ${name} (id: ${id}) to content/students.json`);
console.log(`✓ Created content/${id}/units.json (empty — no units yet)`);
console.log("");
console.log("Next steps:");
console.log(`  1. Add a unit: copy content/ferdi/units.json into content/${id}/units.json and edit it,`);
console.log(`     or add a unit ref to students.json's units: [] for "${id}" first.`);
console.log("  2. npm run deploy");
console.log(`  3. Hand ${name} their link: /s/${code}/  (parent link: /p/${parentCode}/)`);
