import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// The modules under test are import-free on purpose, so they load as plain scripts.
function load(file) {
  const exports = {};
  const src = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(src, { exports, module: { exports } });
  return exports;
}
const plain = v => JSON.parse(JSON.stringify(v));
const read = f => fs.readFileSync(f, "utf8");
const { needsYou, QUIET_DAYS } = load("src/lib/needs-you.ts");

const students = [{ code: "ferdi-1", name: "Ferdi", daysSinceActivity: 1 }, { code: "val-2", name: "Valentin", daysSinceActivity: 12 }, { code: "kashi-3", name: "Kashi", daysSinceActivity: null }];
const event = (code, kind, extra = {}) => ({ id: `${kind}:${Math.random()}`, code, at: "2026-11-10T09:00:00.000Z", kind, view: "review", read: false, ...extra });

test("needs-you puts a student's message first, then feedback to check, then new work, then a quiet student", () => {
  const list = needsYou([
    event("ferdi-1", "homework"), event("ferdi-1", "homework"), event("ferdi-1", "upload", { view: "documents", at: "2026-11-11T09:00:00.000Z" }),
    event("ferdi-1", "speaking", { needsCheck: true, view: "learning", read: true }),
    event("kashi-3", "message", { view: "messages" }),
  ], students);
  assert.deepEqual(plain(list.map(n => [n.kind, n.name])), [["message", "Kashi"], ["check", "Ferdi"], ["work", "Ferdi"], ["quiet", "Valentin"]]);
  assert.equal(list[0].href, "/teacher/?inbox=messages&student=kashi-3");
  assert.equal(list[1].href, "/teacher/?student=ferdi-1&section=learning");
  assert.equal(list[2].detail, "2 homework answers · 1 upload");
  assert.equal(list[2].href, "/teacher/?student=ferdi-1&section=documents", "opens where the newest work is");
  assert.equal(list[3].detail, "No saved activity for 12 days");
});

test("needs-you counts only what is really waiting", () => {
  assert.deepEqual(plain(needsYou([], [{ code: "a", name: "A", daysSinceActivity: QUIET_DAYS - 1 }, { code: "b", name: "B", daysSinceActivity: null }])), [], "no events and no long silence is an empty list");
  assert.deepEqual(plain(needsYou([event("a", "homework", { read: true }), event("a", "message", { read: true })], [{ code: "a", name: "A" }])), [], "read items are done");
  assert.deepEqual(plain(needsYou([event("zzz", "homework")], students).map(n => n.kind)), ["quiet"], "an event for an unknown student is never attributed to someone else");
  const busy = needsYou([event("val-2", "homework")], students);
  assert.deepEqual(plain(busy.map(n => n.kind)), ["work"], "a student with unread work is not also called quiet");
  // The oldest wait comes first within a kind, and the list is capped.
  const many = Array.from({ length: 9 }, (_, i) => ({ code: `s${i}`, name: `S${i}` }));
  const waits = needsYou(many.map((s, i) => event(s.code, "homework", { at: `2026-11-${String(20 - i).padStart(2, "0")}T09:00:00.000Z` })), many, 4);
  assert.deepEqual(plain(waits.map(n => n.name)), ["S8", "S7", "S6", "S5"]);
});

test("the needs-you card never reports all clear after a failed check", () => {
  const card = read("src/components/NeedsYou.tsx");
  assert.match(card, /failed&&!needs\?/);
  assert.match(card, /This could not be checked/);
  assert.doesNotMatch(card, /notificationsRead/, "listing what is waiting must not mark it read");
  assert.match(read("src/components/views/TeacherDashboardView.tsx"), /<NeedsYou token=\{secret\} students=\{needStudents\}\/>/);
});
