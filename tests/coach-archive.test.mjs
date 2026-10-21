import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/coach-archive.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, crypto: webcrypto, Date, Blob, Promise });
const { realLessonEvidence, makeArchivedLesson, lessonNotes, audioChunkWriter } = exports;
const context = { learner: 'Demo learner', unit: 'Practice', task: 'Yesterday', objective: 'Past forms', source: '', slide: 'Slide 1' };
const feedback = { heard: 'I go home.', strength: 'Clear message', focus: 'Past simple', correction: 'I went home.', prompt: 'Yesterday I…?', next: 'Try again', uncertainty: '' };
const snapshot = {
  context,
  turns: [
    { id: 'sample', at: '2026-10-17T12:00:00Z', role: 'learner', text: 'PREPARED EXAMPLE', rehearsal: true },
    { id: 'teacher', at: '2026-10-17T12:01:00Z', role: 'teacher', text: 'What happened?' },
    { id: 'real', at: '2026-10-17T12:02:00Z', role: 'learner', text: 'I go home.' },
    { id: 'unknown', at: '2026-10-17T12:03:00Z', role: 'unknown', text: 'Unclear speaker.' },
  ],
  entries: [{ id: 'example', at: '', context, feedback, rehearsal: true }, { id: 'evidence', at: '', context, feedback }],
};

test('saved evidence excludes prepared rehearsal without repairing learner grammar or assigning unknown speakers', () => {
  const evidence = realLessonEvidence(snapshot);
  assert.equal(evidence.turns.length, 3);
  assert.equal(evidence.entries.length, 1);
  assert.equal(evidence.turns[1].text, 'I go home.');
  assert.equal(evidence.turns[2].role, 'unknown');
  evidence.context.objective = 'Changed'; evidence.turns[1].text = 'Changed'; evidence.entries[0].feedback.heard = 'Changed';
  assert.equal(context.objective, 'Past forms'); assert.equal(snapshot.turns[2].text, 'I go home.');
  assert.equal(feedback.heard, 'I go home.');
});

test('audio and notes-only sessions retain learner identity and export teacher review with separated speakers', () => {
  const notes = makeArchivedLesson('demo-learner', snapshot);
  const audio = makeArchivedLesson('demo-learner', snapshot, 'audio/mp4');
  assert.notEqual(audio.id, notes.id); assert.equal(notes.state, 'notes'); assert.equal(audio.state, 'recording');
  assert.equal(audio.learnerCode, 'demo-learner'); assert.equal(audio.mimeType, 'audio/mp4');
  const text = lessonNotes({ ...notes, teacherNote: 'Practise went in an independent story.' });
  assert.match(text, /Rory\nWhat happened\?/); assert.match(text, /Demo learner\nI go home\./);
  assert.match(text, /Speaker unclear\nUnclear speaker\./); assert.match(text, /Practise went/);
  assert.ok(!text.includes('PREPARED EXAMPLE')); assert.match(text, /Text cannot establish pronunciation/);
});

test('audio finalisation waits for every chunk in order even when storage is slower than the recorder', async () => {
  const commits = []; let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const writer = audioChunkWriter(async (sequence, blob) => {
    if (sequence === 0) await blocked;
    commits.push([sequence, await blob.text()]);
  });
  const a = writer.append(new Blob(['first']));
  const b = writer.append(new Blob(['second']));
  let finalised = false; const final = writer.flush().then(() => { finalised = true; });
  await Promise.resolve(); assert.equal(finalised, false); assert.equal(commits.length, 0);
  release(); await Promise.all([a, b, final]);
  assert.deepEqual(commits, [[0, 'first'], [1, 'second']]); assert.equal(finalised, true);
});

test('a failed audio write prevents a false successful finalisation and later chunks cannot skip the missing one', async () => {
  const commits = [];
  const writer = audioChunkWriter(async sequence => { commits.push(sequence); throw new Error('storage full'); });
  await assert.rejects(writer.append(new Blob(['first'])), /storage full/);
  await assert.rejects(writer.append(new Blob(['second'])), /storage full/);
  await assert.rejects(writer.flush(), /storage full/);
  assert.deepEqual(commits, [0]);
});
