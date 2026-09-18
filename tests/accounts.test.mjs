import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server/account-service.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Set });
const { accountService } = exports;
function setup(overrides = {}) {
  const calls = [], logins = [];
  const deps = {
    roster: { learner: { email: 'learner@example.test', uid: 'learner-uid', access: 'private-legacy-credential' } },
    verify: async token => { assert.equal(token, 'verified-firebase-token'); return { uid: 'learner-uid', email: 'Learner@example.test', email_verified: true, exp: 1900000000 }; },
    upstream: async body => { calls.push(body); return { ok: true }; },
    backendSession: async (...args) => { logins.push(args); return 'server-only-progress-session'; },
    ...overrides,
  };
  return { deps, calls, logins };
}
const request = { action: 'submissions', code: 'learner', authProvider: 'firebase', session: 'verified-firebase-token' };
test('verified email and fixed account UID must both match the selected learner', async () => {
  const { deps, calls } = setup();
  const login = await accountService({ action: 'accountLogin', code: 'learner', idToken: 'verified-firebase-token' }, deps);
  assert.equal(login.ok, true); assert.equal(login.accountUid, 'learner-uid'); assert.equal(login.expires, 1900000000000);
  assert.equal(calls.length, 0);
  for (const identity of [
    { uid: 'wrong-uid', email: 'learner@example.test', email_verified: true },
    { uid: 'learner-uid', email: 'other@example.test', email_verified: true },
    { uid: 'learner-uid', email: 'learner@example.test', email_verified: false },
  ]) {
    const f = setup({ verify: async () => identity });
    assert.equal((await accountService(request, f.deps)).ok, false); assert.equal(f.calls.length, 0); assert.equal(f.logins.length, 0);
  }
});
test('invalid Firebase tokens and other learner routes cannot reach the progress service', async () => {
  const bad = setup({ verify: async () => { throw new Error('Invalid or expired signature'); } });
  assert.equal((await accountService(request, bad.deps)).authRequired, true); assert.equal(bad.calls.length, 0);
  const other = setup();
  assert.equal((await accountService({ ...request, code: 'other-learner' }, other.deps)).ok, false); assert.equal(other.calls.length, 0);
});
test('managed students cannot invoke teacher actions even with a forged teacher secret', async () => {
  for (const action of ['teacherAccess','teacherDashboard','teacherReview','teacherAddStudent','teacherAssignHomework']) {
    const f = setup();
    assert.equal((await accountService({ ...request, action, teacherSecret: 'forged' }, f.deps)).ok, false); assert.equal(f.calls.length, 0);
  }
});
test('the server forwards a scoped backend session, never the Firebase token', async () => {
  const f = setup();
  assert.equal((await accountService(request, f.deps)).ok, true);
  assert.equal(f.calls[0].session, 'server-only-progress-session'); assert.equal(f.calls[0].authProvider, undefined);
  assert.ok(!JSON.stringify(f.calls).includes('verified-firebase-token'));
  assert.deepEqual(f.logins, [['learner','verified-firebase-token']]);
});
test('an explicit backend authentication rejection gets one fresh session and preserves the exact submission', async () => {
  const calls = []; const f = setup({ upstream: async body => { calls.push({ ...body }); return calls.length === 1 ? { ok: false, authRequired: true } : { ok: true, id: body.id }; } });
  const body = { ...request, action: 'submit', id: 'test-submission-1234', answers: { writing: 'My own work' } };
  assert.equal((await accountService(body, f.deps)).id, body.id); assert.equal(calls.length, 2);
  assert.equal(f.logins[1][2], true); assert.deepEqual(calls[0].answers, calls[1].answers);
});
test('an uncertain submission response is not automatically repeated', async () => {
  let calls = 0; const f = setup({ upstream: async () => { calls++; throw new Error('Response lost'); } });
  await assert.rejects(accountService({ ...request, action: 'submit' }, f.deps)); assert.equal(calls, 1);
});
test('legacy teacher login stays on its existing authentication path', async () => {
  const f = setup(); const body = { action: 'login', code: '__teacher__', credential: 'synthetic-teacher-password' };
  assert.equal((await accountService(body, f.deps)).ok, true); assert.deepEqual(f.calls, [body]); assert.equal(f.logins.length, 0);
});
