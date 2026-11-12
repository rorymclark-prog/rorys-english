import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file) {
  const exports = {};
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(out, { exports, module: { exports } });
  return exports;
}
const read = (f) => fs.readFileSync(f, "utf8");
const { isHomeworkReleased } = load("src/lib/homework-release.ts");

test("a homework week opens on its availableFrom date, and not before", () => {
  assert.equal(isHomeworkReleased({}, "2026-11-13"), true, "no date means open");
  assert.equal(isHomeworkReleased({ availableFrom: "2026-11-13" }, "2026-11-13"), true, "open on the day");
  assert.equal(isHomeworkReleased({ availableFrom: "2026-11-14" }, "2026-11-13"), false, "closed the day before");
});

test("the week page itself is gated, by the Vienna date, before it shows any tasks or answer boxes", () => {
  const view = read("src/components/views/HomeworkWeekView.tsx");
  assert.match(view, /isHomeworkReleased\(week,viennaDate\(\)\)/, "uses the Vienna date helper the Today view uses");
  assert.doesNotMatch(view, /localDate|new Date\(\)/, "no device-local or UTC clock");
  assert.match(view, /This homework opens on \{lessonDate\(week\.availableFrom\)\}/);
  const gate = view.indexOf("isHomeworkReleased(week");
  assert.ok(gate > 0 && gate < view.indexOf("<SubmissionForm"), "the gate returns before the answer form is built");
  assert.ok(gate < view.indexOf("<HomeworkAudioRecorder"), "and before the recorder");
  assert.match(view, /href=\{`\/s\/\$\{code\}\/homework\/`\}/, "links back to the Homework list");
});

test("the lists keep the same rule the page now uses", () => {
  assert.match(read("src/lib/find.ts"), /!h\.availableFrom\|\|h\.availableFrom<=today/);
  assert.match(read("src/components/views/HomeworkListView.tsx"), /!h\.availableFrom\|\|h\.availableFrom<=today/);
});
