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

test("Today keeps one weekly summary and Feedback holds the full practice panel", () => {
  const today = read("src/components/views/TodayView.tsx"), feedback = read("src/components/views/ProgressView.tsx"), panel = read("src/components/EngagementPanel.tsx");
  assert.match(today, /<EngagementPanel code=\{code\} summaryOnly onWeeklySummary=\{setWeeklySummary\}\/>/);
  assert.match(today, /href=\{`\$\{base\}\/progress\/#weekly-practice`\}/);
  assert.doesNotMatch(today, /id="weekly-practice"/);
  assert.match(panel, /if\(summaryOnly\)return null;/);
  assert.match(feedback, /mode==='student'&&<div id="weekly-practice"[^>]*><EngagementPanel code=\{fetchCode\} compact\/>/);
  assert.match(feedback, /<a href="#weekly-practice">This week’s practice<\/a>/);
  // Speak and Feedback are tabs on every screen, so Today no longer repeats them as rows.
  assert.doesNotMatch(today, /className="today-row" href=\{`\$\{base\}\/(speak|progress)\/`\}/);
});
