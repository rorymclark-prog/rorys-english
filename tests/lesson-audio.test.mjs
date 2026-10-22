import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

class Track extends EventTarget {
  constructor(kind = 'audio') { super(); this.kind = kind; this.readyState = 'live'; this.enabled = true; this.clones = []; }
  stop() { this.readyState = 'ended'; }
  clone() { const copy = new Track(this.kind); this.clones.push(copy); return copy; }
  end() { this.stop(); this.dispatchEvent(new Event('ended')); }
}
class Stream {
  constructor(tracks = [new Track()]) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function audioHarness({ display, microphone, resume } = {}) {
  const exports = {}, microphones = [], contexts = [];
  const call = new Stream([new Track('audio'), new Track('video')]);
  class Context {
    constructor() { this.sources = []; this.analysers = []; this.closed = false; this.destination = { stream: new Stream() }; contexts.push(this); }
    createMediaStreamDestination() { return this.destination; }
    createMediaStreamSource(stream) { const node = { stream, connections: [], connect: destination => { node.destination ||= destination; node.connections.push(destination); } }; this.sources.push(node); return node; }
    createAnalyser() {
      const node = { fftSize: 2048, samples: [], getFloatTimeDomainData: destination => { destination.fill(0); destination.set(node.samples.slice(0, destination.length)); } };
      this.analysers.push(node); return node;
    }
    async resume() { if (resume) await resume(); this.resumed = true; }
    async close() { this.closed = true; }
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/lesson-audio.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Event, MediaStream: Stream, AudioContext: Context,
    navigator: { mediaDevices: {
      getDisplayMedia: async options => display ? display(options) : call,
      getUserMedia: async () => { const mic = microphone ? await microphone() : new Stream(); microphones.push(mic); return mic; },
    } },
  });
  return { ...exports, call, microphones, contexts };
}

test('online inputs mix microphone and cloned call audio without video; releasing the coach leaves the recorder and shared call alive', async () => {
  const h = audioHarness(), input = new h.LessonAudioInput();
  assert.equal(await input.connectCall(() => {}), true);
  const coach = await input.acquire('online'), recorder = await input.acquire('online');
  assert.equal(h.contexts.length, 2);
  for (const context of h.contexts) {
    assert.equal(context.sources.length, 2);
    assert.equal(context.sources[0].stream.getAudioTracks().length, 1);
    assert.equal(context.sources[1].stream.getAudioTracks().length, 1);
    assert.notEqual(context.sources[1].stream.getAudioTracks()[0], h.call.getAudioTracks()[0]);
    assert.equal(context.sources[1].stream.getVideoTracks().length, 0);
    assert.equal(context.sources[0].destination, context.destination);
    assert.equal(context.sources[1].destination, context.destination);
    assert.equal(context.resumed, true);
  }
  assert.equal(coach.getVideoTracks().length, 0);
  h.releaseLessonAudio(coach);
  assert.equal(h.microphones[0].getAudioTracks()[0].readyState, 'ended');
  assert.equal(h.contexts[0].sources[1].stream.getAudioTracks()[0].readyState, 'ended');
  assert.equal(h.contexts[0].closed, true);
  assert.equal(recorder.getAudioTracks()[0].readyState, 'live');
  assert.equal(h.microphones[1].getAudioTracks()[0].readyState, 'live');
  assert.equal(input.hasCallAudio(), true);
  h.releaseLessonAudio(recorder); input.close();
  assert.ok(h.call.getTracks().every(track => track.readyState === 'ended'));
});

test('online capture refuses a missing call or a share without sound and releases all shared tracks', async () => {
  const noAudio = new Stream([new Track('video')]);
  const h = audioHarness({ display: async () => noAudio }), input = new h.LessonAudioInput();
  await assert.rejects(input.acquire('online'), /Connect your call tab audio/);
  assert.equal(h.microphones.length, 0);
  await assert.rejects(input.connectCall(() => {}), /No call audio was shared/);
  assert.equal(noAudio.getVideoTracks()[0].readyState, 'ended');
  assert.equal(input.hasCallAudio(), false);
});

test('closing while the share picker is pending discards the late selection', async () => {
  const picker = deferred(), shared = new Stream([new Track(), new Track('video')]);
  const h = audioHarness({ display: () => picker.promise }), input = new h.LessonAudioInput();
  const connecting = input.connectCall(() => assert.fail('cancelled selection must not notify'));
  input.close(); picker.resolve(shared);
  assert.equal(await connecting, false);
  assert.ok(shared.getTracks().every(track => track.readyState === 'ended'));
});

test('disconnecting while microphone permission is pending releases the late microphone and refuses the acquisition', async () => {
  const permission = deferred(), microphone = new Stream();
  const h = audioHarness({ microphone: () => permission.promise }), input = new h.LessonAudioInput();
  await input.connectCall(() => {});
  const acquiring = input.acquire('online'); input.disconnectCall(); permission.resolve(microphone);
  await assert.rejects(acquiring, /lesson audio source changed/);
  assert.equal(microphone.getAudioTracks()[0].readyState, 'ended');
});

test('ending call sharing releases both consumers and notifies each so no half-lesson capture silently continues', async () => {
  const h = audioHarness(), input = new h.LessonAudioInput(); let callEnded = 0, coachEnded = 0, recorderEnded = 0;
  await input.connectCall(() => { callEnded++; });
  const coach = await input.acquire('online'), recorder = await input.acquire('online');
  coach.getAudioTracks()[0].addEventListener('ended', () => { coachEnded++; });
  recorder.getAudioTracks()[0].addEventListener('ended', () => { recorderEnded++; });
  h.call.getVideoTracks()[0].end();
  assert.equal(callEnded, 1); assert.equal(coachEnded, 1); assert.equal(recorderEnded, 1);
  assert.equal(input.hasCallAudio(), false);
  assert.ok(h.microphones.every(mic => mic.getAudioTracks()[0].readyState === 'ended'));
  assert.ok(h.contexts.every(context => context.closed));
});

test('a microphone disconnect ends only its consumer while preserving the other listener and call source', async () => {
  const h = audioHarness(), input = new h.LessonAudioInput(); let ended = 0;
  await input.connectCall(() => {});
  const coach = await input.acquire('online'), recorder = await input.acquire('online');
  coach.getAudioTracks()[0].addEventListener('ended', () => { ended++; });
  h.microphones[0].getAudioTracks()[0].end();
  assert.equal(ended, 1);
  assert.equal(coach.getAudioTracks()[0].readyState, 'ended');
  assert.equal(recorder.getAudioTracks()[0].readyState, 'live');
  assert.equal(input.hasCallAudio(), true);
  input.close();
});

test('a mixer that cannot start releases every partially created audio resource', async () => {
  const h = audioHarness({ resume: async () => { throw new Error('audio context cannot resume'); } });
  const input = new h.LessonAudioInput();
  await input.connectCall(() => {});
  await assert.rejects(input.acquire('online'), /audio context cannot resume/);
  assert.equal(h.microphones[0].getAudioTracks()[0].readyState, 'ended');
  assert.equal(h.contexts[0].sources[1].stream.getAudioTracks()[0].readyState, 'ended');
  assert.equal(h.contexts[0].closed, true);
  assert.equal(h.contexts[0].destination.stream.getAudioTracks()[0].readyState, 'ended');
  assert.equal(input.hasCallAudio(), true, 'the user can retry without selecting the call again');
  input.close();
});

test('online meters independently observe the microphone and call without changing either audio route or opening another device', async () => {
  const h = audioHarness(), input = new h.LessonAudioInput();
  assert.equal(input.levels().microphone, 0); assert.equal(input.levels().call, 0);
  assert.equal(h.microphones.length, 0); assert.equal(h.contexts.length, 0);
  await input.connectCall(() => {});
  assert.equal(input.levels().call, 0, 'selecting the call alone does not start a monitor');
  const stream = await input.acquire('online'), context = h.contexts[0];
  assert.equal(h.microphones.length, 1); assert.equal(context.sources.length, 2);
  context.analysers[0].samples = [0.125, -0.5, 0.25];
  context.analysers[1].samples = [-0.25, 0.125];
  assert.equal(input.levels().microphone, 0.5);
  assert.equal(input.levels().call, 0.25);
  assert.deepEqual(context.sources[0].connections, [context.destination, context.analysers[0]]);
  assert.deepEqual(context.sources[1].connections, [context.destination, context.analysers[1]]);
  context.analysers[0].samples = [0]; context.analysers[1].samples = [-1.25];
  assert.equal(input.levels().microphone, 0); assert.equal(input.levels().call, 1, 'the meter is bounded even if a source clips');
  h.releaseLessonAudio(stream);
  assert.equal(input.levels().microphone, 0); assert.equal(input.levels().call, 0);
  input.close();
});

test('meters follow the latest live consumer, fall back when it ends, and clear when call capture ends', async () => {
  const h = audioHarness(), input = new h.LessonAudioInput();
  await input.connectCall(() => {});
  const recorder = await input.acquire('online'), coach = await input.acquire('online');
  h.contexts[0].analysers[0].samples = [0.25]; h.contexts[0].analysers[1].samples = [0.5];
  h.contexts[1].analysers[0].samples = [0.75]; h.contexts[1].analysers[1].samples = [0.125];
  assert.equal(input.levels().microphone, 0.75); assert.equal(input.levels().call, 0.125);
  h.releaseLessonAudio(coach);
  assert.equal(input.levels().microphone, 0.25); assert.equal(input.levels().call, 0.5);
  assert.equal(recorder.getAudioTracks()[0].readyState, 'live');
  h.call.getAudioTracks()[0].end();
  assert.equal(input.levels().microphone, 0); assert.equal(input.levels().call, 0);
  assert.ok(h.contexts.every(context => context.closed));
});
