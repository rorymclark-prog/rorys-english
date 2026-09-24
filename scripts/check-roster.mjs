// Do the pre-rendered student pages and the account roster still agree?
//
// The pages are pre-rendered from content/students.json with
// dynamicParams = false, so a student who exists only in ACCOUNT_ROSTER_JSON
// gets a 404 on their own link until someone rebuilds — and a student who
// exists only in students.json has a page they can never sign in to.
//
// Runs in prebuild. ACCOUNT_ROSTER_JSON is only set where the app is deployed,
// so locally this says so and exits 0 rather than failing the build.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const students = JSON.parse(readFileSync(join(root, "content", "students.json"), "utf-8"));
const codes = new Set(students.map((s) => s.code));

const raw = process.env.ACCOUNT_ROSTER_JSON;
if (!raw) {
  console.log("check-roster: ACCOUNT_ROSTER_JSON is not set here — skipping (expected outside deployment)");
  process.exit(0);
}

let roster;
try {
  roster = JSON.parse(raw);
} catch {
  console.error("check-roster: ACCOUNT_ROSTER_JSON is not valid JSON. Every account sign-in would fail.");
  process.exit(1);
}

const rosterCodes = Object.keys(roster);
// Family pages use legacy access codes, not accounts, so they are not expected
// in the roster.
const expectAccount = [...codes].filter((c) => !c.includes("-fam-"));

const missingPage = rosterCodes.filter((c) => !codes.has(c));
const missingAccount = expectAccount.filter((c) => !rosterCodes.includes(c));

for (const code of missingPage) {
  console.error(`check-roster: "${code}" has an account but no page. Their link will 404 — add them to content/students.json.`);
}
for (const code of missingAccount) {
  console.warn(`check-roster: "${code}" has a page but no account. They can only sign in with a legacy access code.`);
}

// A roster entry without a page is the one that breaks a student's link, so
// that fails the build. The other direction still works, so it only warns.
if (missingPage.length) process.exit(1);
console.log(`check-roster: ${rosterCodes.length} account(s), ${codes.size} page(s) — consistent`);
