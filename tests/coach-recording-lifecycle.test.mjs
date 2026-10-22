import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => dependencies[name], crypto: webcrypto, Date, Blob, Promise, ...globals });
  return exports;
}
const archive = load('src/lib/coach-archive.ts');
const snapshot = { context: { learner: 'Demo', unit: '', task: 'Yesterday', objective: 'Past tense', source: '', slide: '' }, turns: [], entries: [] };
const tick = () => new Promise(resolve => setImmediate(resolve));

// Run the real component's event handlers with deterministic browser/storage
// adapters. Delayed storage and recorder failures need no microphone or server.
function recordingHarness({ acquireAudio, failFinalMetadata = false, initialSnapshot = snapshot } = {}) {
  const hooks = [], effects = [], records = new Map(), chunks = new Map(), downloads = [], listeners = new Map();
  let cursor = 0, ui, busy, micRequests = 0, currentRecorder, failChunks = false, delayedHistory = false;
  const historyWaiters = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      const hook = hooks[index] ||= { value: initial };
      return [hook.value, value => { hook.value = typeof value === 'function' ? value(hook.value) : value; }];
    },
    useRef(initial) { return hooks[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++, previous = hooks[index];
      if (previous && same(previous.deps, deps)) return previous.fn;
      hooks[index] = { fn, deps }; return fn;
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || !same(previous.deps, deps)) effects.push(() => {
        previous?.cleanup?.(); hooks[index] = { deps, cleanup: fn() };
      });
    },
  };
  const microphone = () => {
    const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; currentRecorder = this; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => { this.emit('last'); this.onstop?.(); });
    }
    emit(text) { this.ondataavailable?.({ data: new Blob([text]) }); }
    pause() { this.state = 'paused'; }
    resume() { this.state = 'recording'; }
  }
  const storage = {
    ...archive,
    async listArchivedLessons() {
      if (delayedHistory) await new Promise(resolve => historyWaiters.push(resolve));
      return [...records.values()];
    },
    async saveArchivedLesson(lesson) {
      if (failFinalMetadata && lesson.state === 'complete') throw new Error('metadata storage failed');
      records.set(lesson.id, structuredClone(lesson));
    },
    async saveAudioChunk(id, sequence, blob) {
      if (failChunks) throw new Error('audio storage full');
      chunks.set(`${id}:${sequence}`, blob);
    },
    async archivedAudio(lesson) {
      return new Blob([...chunks.entries()].filter(([key]) => key.startsWith(`${lesson.id}:`)).map(([, blob]) => blob));
    },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const component = load('src/components/CoachLessonArchive.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/lib/coach-archive': storage,
    '@/lib/lesson-audio': { releaseLessonAudio: stream => stream?.getTracks().forEach(track => track.stop()) },
  }, {
    navigator: { mediaDevices: { async getUserMedia() { micRequests++; return microphone(); } } },
    MediaRecorder: Recorder,
    window: { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) },
    document: { createElement: () => ({ click() {} }) },
    URL: { createObjectURL: blob => { downloads.push(blob); return 'blob:recording'; }, revokeObjectURL() {} },
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1,
  }).default;
  const props = { learnerCode: 'demo', snapshot: initialSnapshot, evidenceRevision: 0, onBusy: value => { busy = value; }, onFocus() {}, ...(acquireAudio ? { acquireAudio } : {}) };
  function render() {
    cursor = 0; ui = component(props);
    while (effects.length) effects.shift()();
    return ui;
  }
  function walk(predicate, node) {
    if (Array.isArray(node)) return node.map(child => walk(predicate, child)).find(Boolean);
    if (!node || typeof node !== 'object') return undefined;
    return predicate(node) ? node : walk(predicate, node.props?.children);
  }
  const find = predicate => walk(predicate, ui);
  const button = text => find(node => node.type === 'button' && node.props.children === text);
  async function settle() { await tick(); render(); }
  async function start() {
    render(); await settle();
    find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
    render(); button('Record lesson').props.onClick(); await settle();
  }
  return {
    start, render, settle, button, find, downloads, records,
    get busy() { return busy; }, get recorder() { return currentRecorder; }, get micRequests() { return micRequests; },
    failAudioWrites() { failChunks = true; }, holdHistory() { delayedHistory = true; },
    reviseEvidence(value) { props.snapshot = value; props.evidenceRevision++; render(); },
    releaseHistory() { delayedHistory = false; historyWaiters.splice(0).forEach(resolve => resolve()); },
    unload() { const event = { prevented: false, preventDefault() { this.prevented = true; } }; listeners.get('beforeunload')(event); return event; },
  };
}

test('failed audio keeps recording and parent navigation locked through delayed refresh until recovery is downloaded and acknowledged', async () => {
  const h = recordingHarness();
  await h.start();
  const staleStart = h.button('Stop & save recording');
  h.recorder.emit('first'); await h.settle();
  h.failAudioWrites(); h.holdHistory();
  staleStart.props.onClick(); await h.settle();
  assert.equal(h.button('Record lesson').props.disabled, true);
  assert.equal(h.busy, true, 'the parent must keep learner changes and navigation disabled');
  assert.equal(h.unload().prevented, true);
  assert.equal(h.button('I have saved the recovery copy').props.disabled, true);
  assert.equal(h.button('Delete saved lesson…').props.disabled, true);

  // Even an event delivered despite disabled UI cannot replace the suffix.
  h.button('Record lesson').props.onClick(); await h.settle();
  assert.equal(h.micRequests, 1);
  h.button('Download recovery audio').props.onClick(); await h.settle();
  assert.equal(await h.downloads[0].text(), 'firstlast', 'download includes the saved prefix and failed final chunk');
  assert.equal(h.busy, true, 'downloading alone must not discard the only recovery copy');
  h.button('I have saved the recovery copy').props.onClick(); await h.settle();
  assert.equal(h.busy, false);
  assert.equal(h.button('Record lesson').props.disabled, false);
  assert.equal(h.unload().prevented, false);
  h.releaseHistory(); await h.settle();
});

test('a final metadata failure is displayed as interrupted instead of a successful saved lesson', async () => {
  const h = recordingHarness({ failFinalMetadata: true });
  await h.start(); h.button('Stop & save recording').props.onClick(); await h.settle();
  assert.ok(h.find(node => node.type === 'small' && JSON.stringify(node.props.children).includes('Partial recording')));
  assert.ok(h.find(node => node.props.role === 'status' && typeof node.props.children === 'string' && node.props.children.includes('Storage was interrupted')));
});

test('recording uses its supplied audio stream and stops its owned tracks when saved', async () => {
  const track = { stopped: false, stop() { this.stopped = true; } };
  const audio = { getTracks: () => [track], getAudioTracks: () => [track] };
  let acquisitions = 0;
  const h = recordingHarness({ acquireAudio: async () => { acquisitions++; return audio; } });
  await h.start();
  assert.equal(acquisitions, 1); assert.equal(h.micRequests, 0);
  assert.equal(h.recorder.stream, audio);
  h.button('Stop & save recording').props.onClick(); await h.settle();
  assert.equal(track.stopped, true);
});

test('a speaker correction after stopping automatically updates the saved current lesson and preserves its audio and review', async () => {
  const initialSnapshot = {
    ...snapshot,
    turns: [{ id: 'caption', at: '2026-10-22T12:00:00Z', role: 'learner', text: 'An explanation from Rory.' }],
    entries: [{ id: 'wrong-feedback', at: '2026-10-22T12:00:00Z', context: snapshot.context, feedback: { heard: 'An explanation from Rory.' } }],
  };
  const h = recordingHarness({ initialSnapshot });
  await h.start(); h.button('Stop & save recording').props.onClick(); await h.settle();
  const review = h.find(node => node.type === 'textarea' && node.props.maxLength === 700);
  review.props.onChange({ target: { value: 'Keep this teacher review.' } }); h.render();
  h.button('Save my review').props.onClick(); await h.settle();
  const original = [...h.records.values()][0];
  const corrected = { ...initialSnapshot, turns: initialSnapshot.turns.map(turn => ({ ...turn, role: 'teacher' })), entries: [] };
  h.reviseEvidence(corrected); await h.settle();
  const saved = h.records.get(original.id);
  assert.equal(saved.turns[0].role, 'teacher');
  assert.equal(saved.entries.length, 0);
  assert.equal(saved.teacherNote, original.teacherNote);
  assert.equal(saved.audioBytes, original.audioBytes);
  assert.equal(saved.mimeType, original.mimeType);
  assert.equal(saved.startedAt, original.startedAt);
  assert.equal(saved.state, original.state);
});
