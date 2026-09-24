import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// storage.ts is device storage, so the streak has to survive whatever is in it.
function store(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    key: i => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}
function loadStorage(localStorage, preview = false) {
  const exports = {};
  const src = ts.transpileModule(fs.readFileSync("src/lib/storage.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(src, {
    exports,
    require: () => ({ isStudentPreview: () => preview }),
    window: { localStorage },
    Date, JSON, Object, Array, String, Number, Set, Math, RegExp, console,
  });
  return exports;
}
const day = offset => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const seeded = (...offsets) => store({ ferdi_streak: JSON.stringify(offsets.map(day)) });

test("sending a piece of work records the day", () => {
  const localStorage = store();
  const s = loadStorage(localStorage);
  s.touchStreak("ferdi");
  assert.equal(s.currentStreak(s.getStreakDays("ferdi")), 1);
  // Sending a second piece the same day is still one day, not two.
  s.touchStreak("ferdi");
  assert.equal(s.getStreakDays("ferdi").length, 1);
});

test("the streak counts consecutive days and holds overnight", () => {
  const s = loadStorage(seeded(0, 1, 2));
  assert.equal(s.currentStreak(s.getStreakDays("ferdi")), 3);
  // Nothing done yet today: yesterday's run still stands rather than resetting
  // to zero the moment midnight passes. Spec §6 — zero guilt mechanics.
  const overnight = loadStorage(seeded(1, 2, 3));
  assert.equal(overnight.currentStreak(overnight.getStreakDays("ferdi")), 3);
});

test("a missed day ends the run without losing the best", () => {
  const s = loadStorage(seeded(0, 3, 4, 5, 6));
  const days = s.getStreakDays("ferdi");
  assert.equal(s.currentStreak(days), 1, "today alone is the current run");
  assert.equal(s.bestStreak(days), 4, "the earlier four-day run is still the best");
});

test("the seven-day strip reports the right days, oldest first", () => {
  const s = loadStorage(seeded(0, 2, 6));
  const week = Array.from(s.recentActivity(s.getStreakDays("ferdi"), 7));
  assert.equal(week.length, 7);
  assert.deepEqual(week.map(d => d.active), [true, false, false, false, true, false, true]);
  assert.equal(week[6].day, day(0), "the last cell is today");
});

test("rubbish in device storage cannot break the strip", () => {
  for (const raw of ['not json', '"a string"', '{"days":[]}', '[1,2,3]', '["nope","2026-13-99"]']) {
    const s = loadStorage(store({ ferdi_streak: raw }));
    const days = s.getStreakDays("ferdi");
    // The filter guarantees the shape, not the calendar: "2026-13-99" is
    // day-shaped so it survives, and then matches no real day downstream.
    assert.ok(Array.from(days).every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)), `${raw} let a non-day through`);
    assert.equal(s.currentStreak(days), 0);
    assert.equal(Array.from(s.recentActivity(days, 7)).filter(d => d.active).length, 0);
  }
});

test("Rory previewing a student's page does not record work for them", () => {
  const localStorage = store();
  loadStorage(localStorage, true).touchStreak("ferdi");
  assert.equal(localStorage.getItem("ferdi_streak"), null);
});

// ── The wiring these helpers spent a release disconnected from ───────────────
const read = f => fs.readFileSync(f, "utf8");

test("the strip is actually on the Today screen", () => {
  const today = read("src/components/views/TodayView.tsx");
  assert.match(today, /<MomentumStrip studentId=\{studentId\}\/>/);
  assert.match(today, /import MomentumStrip/);
});

test("every way a student does work records the day", () => {
  // 3d9386b left touchStreak with no callers at all and MASTERPLAN still
  // claimed the strip shipped. Lock each route in so the next rewrite fails
  // loudly instead of silently dropping the streak again.
  assert.match(read("src/components/views/HomeworkWeekView.tsx"), /onSubmitted=\{\(\)=>markEffort\(studentId,code\)\}/, "written homework");
  assert.match(read("src/components/views/SpeakView.tsx"), /if\(studentId\)markEffort\(studentId,code\)/, "a spoken conversation");
  assert.match(read("src/components/HomeworkAudioRecorder.tsx"), /markEffort\(studentId,code\)/, "a recorded talk");
  assert.match(read("src/lib/momentum.ts"), /touchStreak\(studentId\)/);
});

test("the teacher's own voice test cannot touch a student's streak", () => {
  const speak = read("src/components/views/SpeakView.tsx");
  assert.match(speak, /studentId\?: string/, "VoiceStudio takes the id as optional");
  assert.match(speak, /if\(studentId\)markEffort/, "and only records when it has one");
});

test("a submission that could not be delivered still counts", () => {
  const form = read("src/components/SubmissionForm.tsx");
  const submit = form.slice(form.indexOf("async function submit()"));
  const call = submit.indexOf("onSubmitted?.()");
  const okBranch = submit.indexOf("if(r.ok)");
  assert.ok(call > -1 && call < okBranch, "the streak must not depend on a working connection");
});
