import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function moduleAt(path) {
  const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,Date,URL,Blob,setTimeout});return exports;
}
test("overdue dates retain their year and impossible dates are rejected",()=>{
  const {parseDueDate}=moduleAt("src/lib/ics.ts");
  assert.equal(parseDueDate("2026-06-09").getFullYear(),2026);
  assert.equal(parseDueDate("Tue 9 June"),null);
  assert.equal(parseDueDate("2026-02-30"),null);
  assert.equal(parseDueDate("2026-13-01"),null);
  assert.equal(parseDueDate(""),null);
});
test("calendar text is escaped and repeated exports keep a stable event id",()=>{
  const {buildHomeworkIcs}=moduleAt("src/lib/ics.ts");
  const value=buildHomeworkIcs("Hello, class;\nNew line",new Date(2026,8,19),"demo-hw1");
  assert.ok(value.includes("SUMMARY:Hello\\, class\\;\\nNew line"));
  assert.ok(value.includes("UID:demo-hw1@rorys-english"));
});
test("current and archived book units are separate; all archived deadlines include 2026",()=>{
  const units=JSON.parse(fs.readFileSync("content/valentin/units.json","utf8"));
  assert.equal(units.filter(u=>u.active).length,1);
  assert.equal(units.find(u=>u.active).id,"way2go8-unit01-2026");
  assert.equal(units.find(u=>u.id==="way2go7-unit09-2025").schoolYear,"2025–26");
  assert.equal(units.find(u=>u.id==="way2go7-unit09-2025").active,false);
  assert.equal(units.find(u=>u.id==="unit05").active,false);
  for(const file of ["content/valentin/unit05/homework.json","content/ferdi/unit10/homework.json"]) {
    for(const w of JSON.parse(fs.readFileSync(file,"utf8")))assert.match(w.due,/^2026-06-\d{2}$/);
  }
});
test("Valentin Unit 1 has separate voice and writing practice for consecutive weeks",()=>{
  const homework=JSON.parse(fs.readFileSync("content/valentin/way2go8-unit01-2026/homework.json","utf8"));
  const voice=homework.find(h=>h.week===2);
  const writing=homework.find(h=>h.week===3);
  assert.equal(voice.availableFrom,"2026-09-23");
  assert.equal(voice.due,"");
  assert.ok(voice.tasks.some(t=>t.type==="voice"));
  assert.equal(writing.availableFrom,"2026-09-30");
  assert.equal(writing.due,"");
  assert.ok(writing.tasks.every(t=>t.type==="written"));
  assert.match(voice.source,/not a textbook exercise/i);
  assert.match(writing.source,/not a textbook exercise/i);
});
test("Ferdi has one written answer per week alongside guided voice, within the weekly limit",()=>{
  const weeks=JSON.parse(fs.readFileSync("content/ferdi/english-in-context5-unit01-2026/homework.json","utf8"));
  assert.deepEqual(weeks.map(w=>w.availableFrom),["2026-09-23","2026-09-30"]);
  assert.ok(weeks.every(w=>w.estimatedMinutes<=45 && w.due===""));
  assert.deepEqual(weeks.map(w=>w.tasks.map(t=>t.id)),[["story-write"],["email-draft"]]);
  assert.ok(weeks.every(w=>w.tasks[0].type==="written"));
});
test("no browser-shipped shared secret, JSONP, or unacknowledged transport",()=>{
  for(const file of ["src/lib/api.ts","src/lib/remote.ts","src/lib/sync.ts","public/study-tools/valentin-unit05.html","public/study-tools/ferdi-unit10.html"]) {
    const code=fs.readFileSync(file,"utf8");
    assert.doesNotMatch(code,/NEXT_PUBLIC_SYNC_SECRET|mode:\s*["']no-cors|secret:\s*["'][^"']+/);
  }
});
test("legacy links are pinned, not active-unit redirects",()=>{
  const source=fs.readFileSync("src/app/s/[code]/homework/[week]/page.tsx","utf8");
  assert.ok(source.includes("getLegacyUnit(code)"));assert.ok(!source.includes("bundle.activeUnit"));
});
