import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import path from "node:path";
function load(file, globals = {}, cache = new Map()) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, process: { env: { NEXT_PUBLIC_SYNC_URL: "/api/service" } }, ...globals,
    require: name => load(path.resolve(path.dirname(file), name + ".ts"), globals, cache) });
  return exports;
}
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), clear: () => values.clear() };
}
function browser() {
  const localStorage = storage(), sessionStorage = storage();
  const window = { localStorage, sessionStorage, location: { pathname: "/teacher/" }, dispatchEvent() {} };
  return { window, localStorage, sessionStorage, CustomEvent: class {}, AbortController, setTimeout, clearTimeout };
}
const teacher = { ok: true, token: "synthetic-remembered", expires: Date.now() + 30 * 86400000, role: "teacher" };
test("remembered teacher survives a fresh tab and can open a read-only student preview", async () => {
  const f = browser(), bodies = [];
  f.fetch = async (_url, options) => { bodies.push(JSON.parse(options.body)); return { ok: true, json: async () => teacher }; };
  const api = load("src/lib/api.ts", f);
  assert.equal((await api.login("__teacher__", "synthetic-only", true)).ok, true);
  assert.equal(bodies[0].remember, true);
  f.sessionStorage.clear();
  assert.equal(api.savedSession("__teacher__").token, teacher.token);
  const preview = load("src/lib/student-preview.ts", f);
  assert.equal(preview.startStudentPreview("learner"), true);
  f.window.location.pathname = "/s/learner/";
  assert.equal(preview.isStudentPreview("learner"), true);
  assert.equal(preview.previewTeacherSession().token, teacher.token);
  api.forgetSession("__teacher__");
  assert.equal(api.savedSession("__teacher__"), null);
  assert.equal(preview.previewTeacherSession(), null);
});
test("malformed, expired or wrong-role tab data cannot shadow a valid remembered teacher", () => {
  const f = browser(), api = load("src/lib/api.ts", f);
  f.localStorage.setItem("re_session_v2___teacher__", JSON.stringify(teacher));
  for (const stale of ["not json", JSON.stringify({ ...teacher, expires: 1 }), JSON.stringify({ ...teacher, role: "student" })]) {
    f.sessionStorage.setItem("re_session_v2___teacher__", stale);
    assert.equal(api.savedSession("__teacher__").token, teacher.token);
  }
  // A student may now keep a sign-in on their own device, so localStorage is
  // read for them too. The role check is what keeps the routes apart.
  f.localStorage.setItem("re_session_v2_learner", JSON.stringify({ ...teacher, role: "student" }));
  assert.equal(api.savedSession("learner").token, teacher.token);
  f.localStorage.setItem("re_session_v2_learner", JSON.stringify(teacher));
  assert.equal(api.savedSession("learner"), null, "a teacher-role record under a student key must stay shut");
});
test("shared-device login removes remembered sign-in and does not survive closing the tab", async () => {
  const f = browser();
  f.fetch = async () => ({ ok: true, json: async () => teacher });
  f.localStorage.setItem("re_session_v2___teacher__", JSON.stringify(teacher));
  const api = load("src/lib/api.ts", f);
  await api.login("__teacher__", "synthetic-only", false);
  assert.equal(f.localStorage.getItem("re_session_v2___teacher__"), null);
  f.sessionStorage.clear(); assert.equal(api.savedSession("__teacher__"), null);
});
test("the device's setting is the default; only an explicit Light or Dark overrides it", () => {
  const appearance = load("src/lib/appearance.ts"), f = browser();
  const settings = load("src/lib/storage.ts", f);
  assert.equal(settings.getSettings("learner").theme, "system");
  for (const theme of [undefined, "invalid", "light", "dark", "system"]) for (const systemDark of [false, true]) {
    const expected = theme === "dark" || (theme !== "light" && systemDark);
    assert.equal(appearance.usesDarkTheme(theme, systemDark), expected);
    let actual;
    const meta = { content: "" };
    f.localStorage.setItem("learner_settings", JSON.stringify({ theme }));
    vm.runInNewContext(appearance.themeScript("learner"), { localStorage: f.localStorage,
      matchMedia: () => ({ matches: systemDark }), document: { querySelectorAll: () => [meta], documentElement: { setAttribute() {}, classList: { toggle: (_name, value) => { actual = value; } } } } });
    assert.equal(actual, expected); assert.equal(meta.content, expected ? "#151C2B" : "#F7F6F2");
  }
});
function lock() {
  let onRelease = () => {};
  return { released: false, addEventListener: (_name, fn) => { onRelease = fn; }, async release() { this.released = true; onRelease(); } };
}
test("voice reacquires an automatically released screen lock on return, never while hidden", async () => {
  const { ScreenAwake } = load("src/lib/screen-awake.ts"), states = [], locks = [];
  let visible = true;
  const awake = new ScreenAwake(async () => { const l = lock(); locks.push(l); return l; }, () => visible, s => states.push(s));
  await awake.start(); assert.equal(locks.length, 1); assert.equal(states.at(-1), "held");
  visible = false; await locks[0].release(); await awake.resume(); assert.equal(locks.length, 1);
  visible = true; await awake.resume(); assert.equal(locks.length, 2); assert.equal(states.at(-1), "held");
  awake.stop(); assert.equal(locks[1].released, true); await awake.resume(); assert.equal(locks.length, 2);
});
test("ending while screen-lock acquisition is pending releases the late lock; unsupported and denied are safe", async () => {
  const { ScreenAwake } = load("src/lib/screen-awake.ts"), states = [];
  let resolve;
  const awake = new ScreenAwake(() => new Promise(r => { resolve = r; }), () => true, s => states.push(s));
  const pending = awake.start(); awake.stop(); const late = lock(); resolve(late); await pending;
  assert.equal(late.released, true); assert.equal(states.at(-1), "idle");
  for (const request of [undefined, async () => { throw Error("phone refused"); }]) {
    const unsupported = new ScreenAwake(request, () => true, s => states.push(s));
    await unsupported.start(); assert.equal(states.at(-1), "unavailable");
  }
});
test("handwritten answers retain typed wording and private IDs, never arbitrary URLs", () => {
  const h = load("src/lib/handwritten-answer.ts"), id = "synthetic-document-0001";
  const answer = "My own words.\n" + h.handwritingReference(id);
  const result = h.handwritingParts(answer);
  assert.equal(result.text, "My own words."); assert.deepEqual([...result.documentIds], [id]);
  assert.equal(h.handwritingParts(h.handwritingReference(id)).text, "");
  assert.equal(h.handwritingParts("Still typing ").text, "Still typing ");
  assert.throws(() => h.handwritingReference("https://evil.example"));
  assert.equal(h.handwritingParts("[Handwritten answer: https://evil.example]").documentIds.length, 0);
  assert.equal(h.handwritingParts(h.handwritingReference(id) + h.handwritingReference(id)).documentIds.length, 1);
});

test("unreadable appearance settings are normalised instead of reaching the document", () => {
  const f = browser(), settings = load("src/lib/storage.ts", f);
  f.localStorage.setItem("learner_settings", JSON.stringify({ theme: "neon", textScale: "huge", palette: "chartreuse" }));
  const s = settings.getSettings("learner");
  assert.equal(s.theme, "system");
  assert.equal(s.textScale, "normal");
  assert.equal(s.palette, undefined);
});

test("the theme is on the document before the sign-in screen paints, not after the gate", () => {
  const shell = fs.readFileSync(new URL("../src/components/AppShell.tsx", import.meta.url), "utf8");
  const script = shell.indexOf("themeScript("), gate = shell.indexOf("<SessionGate");
  assert.ok(script > -1, "AppShell must render the pre-paint theme script itself");
  assert.ok(script < gate, "the theme script must come before <SessionGate>, or students sign in on a light screen whatever they chose");
  const provider = fs.readFileSync(new URL("../src/components/SettingsContext.tsx", import.meta.url), "utf8");
  assert.ok(!provider.includes("themeScript("), "the provider's own copy would sit inside the gate again");
});
