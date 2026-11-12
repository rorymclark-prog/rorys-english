import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Both modules are import-free on purpose, so they load here as plain scripts.
function load(file) {
  const exports = {};
  const src = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(src, { exports, module: { exports } });
  return exports;
}
// Values built inside the vm belong to another realm, so compare plain copies.
const plain = v => JSON.parse(JSON.stringify(v));
const nav = load("src/lib/student-navigation.ts");
const find = load("src/lib/find.ts");
const read = f => fs.readFileSync(f, "utf8");

const units = [
  { id: "unit01", title: "way2go! 8 · Unit 1", available: true, homework: [
    { week: 1, title: "September starter · A skill worth learning", availableFrom: "2026-09-18" },
    { week: 2, title: "A wellbeing idea for school · Email practice", availableFrom: "2026-12-01" },
  ] },
  { id: "unit02", title: "Unit 2 · Not open yet", available: false, homework: [] },
];
const files = [{ title: "Unit 1 lesson 1 · student slides", unit: "way2go! 8 · Unit 1" }];
const entries = find.studentFindEntries("demo", nav.studentNavigation, units, files, "2026-11-12");
const first = q => find.findMatches(q, entries)[0]?.label;
const labels = q => plain(find.findMatches(q, entries).map(e => e.label));

test("there is one map: five sections, one per tab, and every student page is on it or owned by it", () => {
  assert.deepEqual(plain(nav.studentNavigation.map(s => s.label)), ["Today", "Homework", "Speak", "Lessons", "Feedback"]);
  const listed = nav.studentNavigation.flatMap(s => [s.suffix, ...s.more.map(m => m.suffix)]);
  assert.equal(new Set(listed).size, listed.length, "no page is listed twice");
  const known = new Set([...listed.map(s => s.replace("/", "")), ...nav.studentNavigation.flatMap(s => s.owns || []), "settings"]);
  for (const dir of fs.readdirSync("src/app/s/[code]", { withFileTypes: true })) if (dir.isDirectory()) assert.ok(known.has(dir.name), `/s/[code]/${dir.name}/ is missing from the navigation map`);
});

test("the tab bar and the sidebar read the map instead of keeping their own lists", () => {
  for (const f of ["src/components/TabBar.tsx", "src/components/StudentNavigation.tsx", "src/components/AppMenu.tsx"]) {
    assert.match(read(f), /student-navigation/, `${f} must import the shared map`);
  }
  assert.doesNotMatch(read("src/components/TabBar.tsx"), /"test-prep"|"documents"|"resources"/, "TabBar must not hard-code which pages belong to a tab");
});

test("a page lights the tab of the section it is listed under", () => {
  const place = p => plain(nav.navPlace(p, "/s/demo"));
  assert.deepEqual(place("/s/demo/"), { section: "", item: "" });
  assert.deepEqual(place("/s/demo"), { section: "", item: "" });
  assert.equal(place("/s/demo/calendar/").section, "");
  assert.equal(place("/s/demo/documents/").section, "homework/");
  assert.equal(place("/s/demo/study/").section, "lessons/");
  assert.equal(place("/s/demo/progress/").section, "progress/");
  assert.deepEqual(place("/s/demo/notifications/"), { section: "", item: null });
  assert.deepEqual(place("/s/demo/settings/"), { section: null, item: null });
  // A homework task opens under its unit's address but is still homework.
  assert.equal(place("/s/demo/lessons/unit01/homework/2/").section, "homework/");
  assert.equal(place("/s/demo/lessons/").section, "lessons/");
});

test("Find reaches every page by its name", () => {
  for (const section of nav.studentNavigation) for (const page of [section, ...section.more]) assert.equal(first(page.label), page.label);
  assert.equal(first("year plan"), "Year plan");
  assert.equal(first("settings"), "Settings");
});

test("Find understands other words for the same place, German included", () => {
  assert.equal(first("hausaufgaben"), "Homework");
  assert.equal(first("Hausübung"), "Homework");
  assert.equal(first("schularbeit"), "Test prep");
  assert.equal(first("exam"), "Test prep");
  assert.equal(first("upload"), "My saved work");
  assert.equal(first("vokabeln"), "Practice desk");
  assert.equal(first("dark mode"), "Settings");
  assert.equal(first("corrections"), "Feedback");
  assert.equal(first("essay"), "My saved work");
  assert.ok(labels("essay").includes("Writing help"));
});

test("Find forgives a typing slip and half-typed words", () => {
  assert.equal(first("homwork"), "Homework");
  assert.equal(first("calender"), "Calendar");
  assert.equal(first("feedbakc"), "Feedback");
  assert.equal(first("mess"), "Messages");
  assert.equal(first("PRACTICE  desk"), "Practice desk");
  assert.deepEqual(labels("zzzz"), []);
  assert.deepEqual(labels("   "), []);
});

test("Find reaches released homework, units and lesson files, and never homework that is not released", () => {
  assert.ok(labels("september starter").includes("September starter · A skill worth learning"));
  assert.equal(find.findMatches("september starter", entries)[0].href, "/s/demo/lessons/unit01/homework/1/");
  assert.deepEqual(labels("wellbeing"), [], "homework dated in the future stays hidden");
  assert.ok(!entries.some(e => e.label.includes("Not open yet")), "a unit that is not available stays hidden");
  assert.equal(first("student slides"), "Unit 1 lesson 1 · student slides");
});

test("the teacher can find a student, a place, or a place for a student", () => {
  const teacher = find.teacherFindEntries([{ code: "aaa-1", name: "Ferdi" }, { code: "bbb-2", name: "Valentin" }]);
  const hit = q => find.findMatches(q, teacher)[0];
  assert.equal(hit("valentin").href, "/teacher/?student=bbb-2");
  assert.equal(hit("valentin review").href, "/teacher/?student=bbb-2&section=review");
  assert.equal(hit("ferdi grades").label, "Ferdi · School results");
  assert.equal(hit("ferdi slides").label, "Ferdi · Teaching materials");
  assert.equal(hit("live").label, "Live teaching");
  assert.deepEqual(plain(find.findMatches("marking", teacher).map(e => e.label)), ["Ferdi · Work to review", "Valentin · Work to review"]);
});

test("the teacher places in Find match the workspace's own sections and names", () => {
  const route = read("src/lib/teacher-route.ts").match(/TEACHER_SECTIONS=\[([^\]]*)\]/)[1].replace(/"/g, "").split(",");
  assert.deepEqual(plain(find.TEACHER_FIND_SECTIONS.map(s => s.section)), route);
  const view = read("src/components/views/TeacherDashboardView.tsx");
  for (const place of find.TEACHER_FIND_SECTIONS) assert.ok(view.includes(`<span>${place.label}<small>${place.hint}</small>`), `"${place.label}" is no longer the name on the teacher tile`);
});
