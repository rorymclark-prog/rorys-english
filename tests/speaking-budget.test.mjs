import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// The allowance lives in device storage, so it has to survive whatever is there.
function store(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    get length() { return map.size; },
  };
}
function load(localStorage = store(), preview = false) {
  const exports = {};
  const src = ts.transpileModule(fs.readFileSync("src/lib/speaking-budget.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const events = [];
  vm.runInNewContext(src, {
    exports,
    require: () => ({ isStudentPreview: () => preview }),
    window: { localStorage, dispatchEvent: e => events.push(e.type) },
    CustomEvent: class { constructor(type) { this.type = type; } },
    Date, JSON, Object, Number, String, Math, console,
  });
  return { ...exports, localStorage, events };
}
const KEY = "re_speaking_week_v1_ferdi";
const monday = new Date(2026, 8, 21);      // Mon 21 Sep 2026
const wednesday = new Date(2026, 8, 23);
const nextMonday = new Date(2026, 8, 28);

test("a fresh week gives the full allowance", () => {
  const b = load();
  // 35 minutes is priced at ~€8.35 a month per student, the bottom of Rory's
  // €8-11 band. Changing it changes his bill, so it is asserted, not derived.
  assert.equal(b.WEEKLY_MINUTES, 35);
  assert.equal(b.secondsLeft("ferdi", wednesday), 2100);
  assert.equal(b.minutesLeft("ferdi", wednesday), 35);
});

test("one conversation is still capped well below the week", () => {
  const b = load();
  assert.equal(b.CALL_MINUTES, 15);
  assert.equal(b.CALL_SECONDS, 900);
  assert.ok(b.CALL_SECONDS < b.WEEKLY_MINUTES * 60, "the week is spent across several conversations");
});

test("the week runs Monday to Sunday", () => {
  // Sunday belongs to the week that began six days earlier, so the allowance
  // refreshes overnight on Sunday rather than in the middle of the weekend.
  assert.equal(load().weekKey(new Date(2026, 8, 27)), "2026-09-21", "Sunday");
  assert.equal(load().weekKey(monday), "2026-09-21");
  assert.equal(load().weekKey(nextMonday), "2026-09-28");
});

test("time spoken comes off this week and comes back next week", () => {
  const b = load();
  b.recordSeconds("ferdi", 900, wednesday);
  assert.equal(b.secondsLeft("ferdi", wednesday), 1200);
  b.recordSeconds("ferdi", 1200, wednesday);
  assert.equal(b.secondsLeft("ferdi", wednesday), 0);
  assert.equal(b.secondsLeft("ferdi", nextMonday), 2100, "Monday starts again");
});

test("the counter never runs past the allowance or below zero", () => {
  const b = load();
  b.recordSeconds("ferdi", 99999, wednesday);
  assert.equal(b.secondsLeft("ferdi", wednesday), 0);
  assert.equal(JSON.parse(b.localStorage.getItem(KEY)).seconds, 2100);
});

test("a part-minute is not offered as a whole minute", () => {
  const b = load();
  b.recordSeconds("ferdi", 2051, wednesday);   // 49 seconds left
  assert.equal(b.secondsLeft("ferdi", wednesday), 49);
  assert.equal(b.minutesLeft("ferdi", wednesday), 0);
  assert.ok(49 < b.MIN_CALL_SECONDS, "and a scrap that small is not offered as a conversation");
});

test("rubbish in device storage counts as nothing used, never everything", () => {
  // A corrupt value must not be able to lock a student out of their schoolwork.
  for (const raw of ["not json", '"a string"', "[1,2,3]", '{"week":"2026-09-21"}', '{"week":"2026-09-21","seconds":-5}', '{"week":"2026-09-21","seconds":"lots"}']) {
    const b = load(store({ [KEY]: raw }));
    assert.equal(b.secondsLeft("ferdi", wednesday), 2100, raw);
  }
});

test("each student has their own allowance", () => {
  const b = load();
  b.recordSeconds("ferdi", 2100, wednesday);
  assert.equal(b.secondsLeft("valentin", wednesday), 2100);
});

test("Rory previewing a student's page does not spend their minutes", () => {
  const b = load(store(), true);
  b.recordSeconds("ferdi", 600, wednesday);
  assert.equal(b.localStorage.getItem(KEY), null);
});

test("recording time tells the screens to re-read", () => {
  const b = load();
  b.recordSeconds("ferdi", 60, wednesday);
  assert.deepEqual(b.events, ["re-speaking-budget-change"]);
});

// ── The wiring, which is the part that silently rots ────────────────────────
const speak = fs.readFileSync("src/components/views/SpeakView.tsx", "utf8");

test("the speaking screen actually spends the allowance", () => {
  assert.match(speak, /const allowance = teacherTest \|\| !studentId \? CALL_SECONDS : secondsLeft\(studentId\)/, "start() reads what is left");
  assert.match(speak, /if \(allowance < MIN_CALL_SECONDS\) \{ setStatus\(OUT_OF_MINUTES\); return; \}/, "and refuses when the week is spent");
  assert.match(speak, /capSeconds\.current = Math\.min\(CALL_SECONDS, allowance\)/, "a call cannot outrun what is left");
  assert.match(speak, /seconds >= capSeconds\.current/, "the in-call timer uses that cap");
  assert.match(speak, /recordSeconds\(studentId,usedSeconds\.current\)/, "and the time is banked when it ends");
});

test("running out invites a request rather than scolding", () => {
  const message = speak.match(/const OUT_OF_MINUTES = `([^`]+)`/)?.[1] ?? "";
  assert.match(message, /this week/, "Rory: it should say for this week");
  assert.match(message, /ask Rory for more/i, "Rory: and they can request more");
  assert.doesNotMatch(message, /\b(limit|exceeded|blocked|denied|sorry)\b/i, "spec §6 — zero guilt mechanics");
});

test("the teacher's own voice test is not charged to a student", () => {
  assert.match(speak, /if\(!teacherTest&&studentId&&usedSeconds\.current>0\)/);
});
