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
const folds = load("src/lib/dashboard-folds.ts");

test("the learning dashboard folds only what is empty, names it, and can show everything", () => {
  const all = Object.fromEntries(folds.DASHBOARD_FOLDS.map(f => [f.id, true]));
  assert.deepEqual(plain(folds.dashboardFolds(all).empty), []);
  const some = folds.dashboardFolds({ ...all, goals: false, checkpoints: false });
  assert.deepEqual(plain(some.empty.map(f => f.label)), ["School profile & learning goals", "Your checkpoints"]);
  const view = read("src/components/views/TeacherInsights.tsx");
  for (const fold of folds.DASHBOARD_FOLDS) assert.ok(view.includes(`id="fold-${fold.id}"`), `the ${fold.id} block can be scrolled to when it is opened`);
  // Folded blocks stay mounted (hidden), so an open form keeps what was typed.
  assert.match(view, /hidden=\{!shown\('checkpoints'\)\}/);
  assert.match(view, /Show all/);
  // Assessing a piece of evidence opens the skills form even when it was folded.
  assert.match(view, /setSource\(e\);setShowAll\(true\)/);
});
