import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function store() {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), get size() { return map.size; } };
}
function load(file, context) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...context });
  return exports;
}
function sessions(areas) {
  return load("src/lib/session-storage.ts", { window: areas, Date, Number, JSON, Object, Array, String });
}

const live = role => JSON.stringify({ token: "a-token", expires: Date.now() + 60_000, role });

test("a sign-in kept on this device survives the app closing", () => {
  const localStorage = store(), sessionStorage = store();
  const { readSession, sessionKey } = sessions({ localStorage, sessionStorage });
  localStorage.setItem(sessionKey("ferdi-7h3k"), live("student"));
  // Closing a PWA ends the tab, which is exactly what sessionStorage is scoped
  // to. Before this, that emptied the only copy of a session with hours left on
  // it, and the student signed in again every single time they opened the app.
  assert.equal(readSession("ferdi-7h3k")?.token, "a-token");
  assert.equal(sessionStorage.size, 0, "nothing should need the tab to have survived");
});

test("an unticked sign-in still ends with the tab", () => {
  const localStorage = store(), sessionStorage = store();
  const { readSession, sessionKey } = sessions({ localStorage, sessionStorage });
  sessionStorage.setItem(sessionKey("ferdi-7h3k"), live("student"));
  assert.equal(readSession("ferdi-7h3k")?.token, "a-token");
  sessionStorage.removeItem(sessionKey("ferdi-7h3k"));   // the app was closed
  assert.equal(readSession("ferdi-7h3k"), null);
});

test("a kept sign-in is still checked, not merely trusted because it persisted", () => {
  const key = "re_session_v2_ferdi-7h3k";
  for (const [why, stored] of [
    ["expired", JSON.stringify({ token: "t", expires: Date.now() - 1, role: "student" })],
    ["no token", JSON.stringify({ token: "", expires: Date.now() + 60_000, role: "student" })],
    ["a role it was never granted", live("teacher")],
    ["not even JSON", "{"],
  ]) {
    const localStorage = store(), sessionStorage = store();
    const { readSession } = sessions({ localStorage, sessionStorage });
    localStorage.setItem(key, stored);
    assert.equal(readSession("ferdi-7h3k"), null, `a stored session that is ${why} must not open the app`);
  }
});

test("an expired kept sign-in does not shadow a valid one in the other area", () => {
  const localStorage = store(), sessionStorage = store();
  const { readSession, sessionKey } = sessions({ localStorage, sessionStorage });
  localStorage.setItem(sessionKey("ferdi-7h3k"), JSON.stringify({ token: "stale", expires: Date.now() - 1, role: "student" }));
  sessionStorage.setItem(sessionKey("ferdi-7h3k"), live("student"));
  assert.equal(readSession("ferdi-7h3k")?.token, "a-token");
});

test("signing out clears both places, so it means signed out", () => {
  const api = fs.readFileSync("src/lib/api.ts", "utf8");
  const forget = api.slice(api.indexOf("export function forgetSession"), api.indexOf("function storeSession"));
  assert.ok(forget.includes("sessionStorage.removeItem") && forget.includes("localStorage.removeItem"),
    "forgetSession must clear both areas for every code, not only the teacher");
  const sweep = api.slice(api.indexOf("export async function logout"));
  assert.ok(sweep.includes("[sessionStorage, localStorage]"), "the Firebase sign-out sweep must cover a kept sign-in too");
});

test("the sign-in screen offers the choice on the access-code route as well", () => {
  const gate = fs.readFileSync("src/components/SessionGate.tsx", "utf8");
  const checkbox = gate.indexOf('className="signin-remember"');
  assert.ok(checkbox > -1, "the checkbox must exist");
  assert.ok(!gate.slice(0, checkbox).endsWith("{!legacy && "), "it must not be hidden from access-code students");
  assert.ok(gate.includes("login(code, credential.trim(), remember)"), "and its value has to reach the sign-in call");
});
