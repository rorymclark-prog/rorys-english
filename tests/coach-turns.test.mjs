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
  }).outputText, { exports, require: name => dependencies[name], crypto: webcrypto, Date, ...globals });
  return exports;
}
const shared = load('src/lib/live-coach.ts');
const { CoachTurnQueue, nativeCoachEvent } = load('src/lib/coach-turns.ts', { './live-coach': shared });
const context = { learner: 'Demo learner', unit: 'Speaking', task: 'A birthday party', objective: 'Past simple', source: '', slide: 'Slide 1' };
const identity = (request, id = `response-${request.turn.id}`) => ({ id, metadata: { coach_request_id: request.requestId, source_turn_id: request.turn.id } });

test('native coaching waits for matching final ASR and freezes the speaker, committed context and slide image', () => {
  const queue = new CoachTurnQueue(), selectedContext = { ...context };
  queue.speechStarted('audio-one', 'learner');
  queue.committed('audio-one', selectedContext, 'teacher', 'data:image/jpeg;base64,YQ==');
  selectedContext.slide = 'Changed slide';
  assert.equal(queue.next(), null);
  const caption = queue.transcribed('audio-one', 'I arrived at half past twelve.', 'teacher');
  assert.equal(caption.role, 'learner');
  const request = queue.next(), event = nativeCoachEvent(request);
  assert.equal(request.turn.context.slide, 'Slide 1');
  assert.equal(request.turn.role, 'learner');
  assert.equal(event.response.conversation, 'none');
  assert.equal(event.response.input[0].type, 'item_reference');
  assert.equal(event.response.input[0].id, 'audio-one');
  assert.equal(event.response.metadata.source_turn_id, 'audio-one');
  assert.equal(event.response.metadata.coach_request_id, request.requestId);
  assert.equal(event.response.input[1].content[1].image_url, 'data:image/jpeg;base64,YQ==');
  assert.ok(event.response.input[1].content[0].text.includes('I arrived at half past twelve.'));
});

test('rapid committed turns with delayed out-of-order ASR are serialized without shifting feedback onto another speaker', () => {
  const queue = new CoachTurnQueue();
  queue.speechStarted('a', 'learner'); queue.committed('a', context, 'learner');
  queue.speechStarted('b', 'teacher'); queue.committed('b', { ...context, slide: 'Slide 2' }, 'teacher');
  queue.transcribed('b', 'Tell me what happened next.', 'learner');
  assert.equal(queue.next(), null);
  queue.transcribed('a', 'I arrived at noon.', 'teacher');
  const first = queue.next();
  assert.equal(first.turn.id, 'a'); assert.equal(first.turn.role, 'learner');
  queue.committed('c', { ...context, slide: 'Slide 3' }, 'learner'); queue.transcribed('c', 'Then we ate cake.', 'learner');
  assert.equal(queue.next(), null, 'later audio must not start a second response while the first is generating');
  assert.equal(queue.completed({ id: 'unrelated', metadata: { source_turn_id: 'b' } }), null);
  queue.responseCreated(identity(first)); queue.completed(identity(first));
  const second = queue.next();
  assert.equal(second.turn.id, 'b'); assert.equal(second.turn.role, 'teacher'); assert.equal(second.turn.context.slide, 'Slide 2');
  assert.ok(!second.evidence.includes('Then we ate cake.'), 'future turns must not leak into earlier feedback');
  queue.completed(identity(second));
  assert.equal(queue.next().turn.id, 'c');
});

test('duplicate committed/transcribed events never create an unassigned duplicate caption or duplicate AI response', () => {
  const queue = new CoachTurnQueue();
  queue.speechStarted('same-id', 'learner');
  queue.committed('same-id', context, 'learner'); queue.committed('same-id', context, 'unknown');
  assert.equal(queue.transcribed('same-id', 'We played a game.', 'unknown').role, 'learner');
  assert.equal(queue.transcribed('same-id', 'We played a game.', 'unknown'), null);
  const request = queue.next(); queue.completed(identity(request));
  assert.equal(queue.next(), null);
});

test('speaker corrections invalidate queued and in-flight learner feedback while preserving later turns', () => {
  const queue = new CoachTurnQueue();
  queue.committed('before', context, 'learner'); queue.transcribed('before', 'Rory explaining a rule.', 'learner');
  queue.correctSpeaker('before', 'teacher');
  queue.committed('during', context, 'learner'); queue.transcribed('during', 'More teacher speech.', 'learner');
  const request = queue.next(); assert.equal(request.turn.id, 'during');
  queue.correctSpeaker('during', 'teacher');
  queue.committed('after', context, 'learner'); queue.transcribed('after', 'We enjoyed the party.', 'learner');
  const completed = queue.completed(identity(request)); assert.equal(completed.invalidated, true);
  const next = queue.next(); assert.equal(next.turn.id, 'after');
  assert.ok(next.evidence.includes('teacher: More teacher speech.'));
});

test('response identity must match request metadata, or a response ID already bound by matching metadata', () => {
  const queue = new CoachTurnQueue(); queue.committed('one', context, 'learner'); queue.transcribed('one', 'An answer.', 'learner');
  const request = queue.next();
  assert.equal(queue.completed({}), null);
  assert.equal(queue.responseCreated({ id: 'wrong', metadata: { coach_request_id: request.requestId, source_turn_id: 'another-turn' } }), false);
  assert.equal(queue.completed({ id: 'wrong' }), null);
  assert.equal(queue.next(), null);
  assert.equal(queue.responseCreated(identity(request, 'matched')), true);
  assert.equal(queue.completed({ id: 'matched' }).request.turn.id, 'one');
  assert.equal(queue.completed(identity(request, 'matched')), null, 'duplicate response.done must be ignored');
});

test('failed transcription and stopped sessions cannot block or contaminate the next answer', () => {
  const queue = new CoachTurnQueue();
  queue.committed('failed', context, 'learner'); queue.transcriptionFailed('failed');
  queue.committed('good', context, 'learner'); queue.transcribed('good', 'A clear answer.', 'learner');
  const request = queue.next(); assert.equal(request.turn.id, 'good');
  queue.clear();
  assert.equal(queue.completed(identity(request)), null); assert.equal(queue.next(), null);
});

test('a later answer retains accepted earlier suggestions and spoken retries without claiming Rory used the suggestions', () => {
  const queue = new CoachTurnQueue();
  queue.committed('attempt', context, 'learner'); queue.transcribed('attempt', 'Yesterday I go to the park.', 'learner');
  const first = queue.next(); queue.completed(identity(first));
  queue.rememberFeedback('attempt', { ...shared.coachRehearsal[0], prompt: 'Yesterday I …? What is the past of go?' });
  queue.committed('retry', context, 'learner'); queue.transcribed('retry', 'Yesterday I went to the park because it was sunny.', 'learner');
  const retry = queue.next();
  assert.match(retry.evidence, /Yesterday I go to the park/);
  assert.match(retry.guidance, /What is the past of go/);
  const event = nativeCoachEvent(retry);
  assert.match(event.response.input[1].content[0].text, /not necessarily used by Rory/);
  assert.match(event.response.instructions, /already answered/);
  assert.match(event.response.instructions, /resolved a language point/);
  assert.equal(event.response.input[0].id, 'retry', 'grammar feedback still references only the fresh native answer');
});

test('corrected speaker labels remove associated prior coaching from future request context', () => {
  const queue = new CoachTurnQueue();
  queue.committed('mislabelled', context, 'learner'); queue.transcribed('mislabelled', 'Explain the past of go.', 'learner');
  const first = queue.next(); queue.completed(identity(first)); queue.rememberFeedback('mislabelled', shared.coachRehearsal[0]);
  queue.correctSpeaker('mislabelled', 'teacher');
  queue.rememberFeedback('mislabelled', shared.coachRehearsal[0]);
  queue.committed('next', context, 'learner'); queue.transcribed('next', 'I went home.', 'learner');
  const request = queue.next();
  assert.equal(request.guidance, '');
  assert.match(request.evidence, /teacher: Explain the past of go/);
  assert.doesNotMatch(request.evidence, /learner: Explain/);
});

test('unassigned and teacher turns request neutral useful prompts without learner assessment or inferred identity', () => {
  for (const role of ['unknown', 'teacher']) {
    const queue = new CoachTurnQueue();
    queue.committed('conversation', context, role); queue.transcribed('conversation', 'We went to the park because it was sunny.', role);
    const event = nativeCoachEvent(queue.next());
    assert.match(event.response.instructions, /neutral content follow-up/);
    assert.match(event.response.instructions, /Keep strength and correction empty/);
    assert.match(event.response.instructions, /Do not guess which person said a sentence/);
    assert.match(event.response.instructions, /If speech overlaps/);
  }
});

test('online mixed audio is explicitly shared conversation, while confirmed single-speaker turns retain their role', () => {
  for (const role of ['unknown', 'learner', 'teacher']) {
    const queue = new CoachTurnQueue();
    queue.committed('online', { ...context, audioMode: 'online' }, role);
    queue.transcribed('online', 'We ate lunch, and then we played a game.', role);
    const event = nativeCoachEvent(queue.next());
    assert.equal(event.response.instructions.includes('one item may contain both voices'), role === 'unknown');
    if(role === 'unknown')assert.match(event.response.instructions, /Never infer identity from voice/);
  }
});
