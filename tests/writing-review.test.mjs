import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/writing-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl});
const {sentenceReview,writingSentences}=exports;
const comparison=(original,corrected,improved='',note='')=>({original,corrected,improved,note});
const plain=value=>JSON.parse(JSON.stringify(value));

test('every complete sentence remains visible, including sentences with no changes',()=>{
  const r=sentenceReview({original:'I enjoy swimming. Yesterday I swim in the lake. The water was cold.',corrected:'I enjoy swimming. Yesterday I swam in the lake. The water was cold.',comparisons:[comparison('I swim','I swam','','Use the past simple.')]});
  assert.equal(r.rows.length,3);assert.equal(r.pending,0);
  assert.deepEqual(plain(r.rows.map(x=>x.status)),['unchanged','corrected','unchanged']);
  assert.equal(r.rows[1].original,'Yesterday I swim in the lake.');
  assert.match(r.rows[0].note,/Already correct/);assert.match(r.rows[1].note,/past simple/);
});
test('a standalone transcription note never shifts or suppresses the complete review',()=>{
  const r=sentenceReview({original:'I like the park. [Crossed-out wording unclear.] Yesterday we go there. It was sunny.',corrected:'I like the park. Yesterday we went there. It was sunny.'});
  assert.equal(r.rows.length,4);assert.equal(r.pending,0);
  assert.equal(r.rows[1].status,'source-note');assert.equal(r.rows[1].number,null);
  assert.equal(r.rows[2].corrected,'Yesterday we went there.');assert.equal(r.rows[3].status,'unchanged');
  assert.deepEqual(plain(r.rows.map(x=>x.number)),[1,null,2,3]);
});
test('optional phrase improvements expand inside a full corrected sentence',()=>{
  const r=sentenceReview({original:'First, we play football every week.',corrected:'First, we play football every week.',comparisons:[comparison('we play football every week.','we play football every week.','we enjoy a weekly game of football.','An optional alternative.')]});
  assert.equal(r.rows[0].improved,'First, we enjoy a weekly game of football.');
  assert.equal(r.rows[0].status,'unchanged');
});
test('a split corrected sentence retains the entire original and both corrected sentences',()=>{
  const r=sentenceReview({original:'We went home and we cooked dinner. It was late.',corrected:'We went home. We cooked dinner. It was late.'});
  assert.equal(r.rows.length,2);assert.equal(r.pending,0);
  assert.equal(r.rows[0].corrected,'We went home. We cooked dinner.');assert.match(r.rows[0].note,/splits/);
  assert.equal(r.rows[1].status,'unchanged');
});
test('joined corrections preserve each original sentence rather than dropping one',()=>{
  const r=sentenceReview({original:'We went home. We cooked dinner. It was late.',corrected:'We went home and we cooked dinner. It was late.'});
  assert.equal(r.rows.length,3);assert.equal(r.pending,0);
  assert.equal(r.rows[0].corrected,r.rows[1].corrected);assert.match(r.rows[1].note,/combines/);
  assert.equal(r.rows[2].status,'unchanged');
});
test('missing or unrelated corrections are never labelled already correct',()=>{
  const r=sentenceReview({original:'My bicycle has a broken wheel. Penguins live in cold places.',corrected:'Penguins live in cold places.'});
  assert.equal(r.rows.length,2);assert.equal(r.rows[0].status,'pending');
  assert.equal(r.rows[0].corrected,'');assert.equal(r.rows[1].status,'unchanged');assert.equal(r.pending,1);
});
test('legacy extracts without the original cannot claim complete sentence coverage',()=>{
  const r=sentenceReview({comparisons:[comparison('go','went')]});
  assert.equal(r.hasOriginal,false);assert.equal(r.rows.length,0);
});
test('explicit complete teacher rows override automatic matches, including pending review',()=>{
  const w={original:'I enjoy music. I enjoy music.',corrected:'I enjoy music. I enjoy music.',comparisons:[comparison('I enjoy music.','I enjoy music.','','A clear first point.'),comparison('I enjoy music.','','','Check the intended meaning here.')]};
  const r=sentenceReview(w);
  assert.equal(r.rows[0].note,'A clear first point.');assert.equal(r.rows[1].status,'pending');
  assert.match(r.rows[1].note,/intended meaning/);
});
test('rebuilding from updated full versions does not retain obsolete row corrections',()=>{
  const r=sentenceReview({original:'I go yesterday.',corrected:'I went yesterday.',comparisons:[comparison('I go yesterday.','I go yesterday.')]},{preferComparisons:false});
  assert.equal(r.rows[0].corrected,'I went yesterday.');
});
test('full sentence punctuation and quoting are preserved',()=>{
  const text='She asked, “Are you ready?” I replied, “Yes!”';
  assert.equal(writingSentences(text).join(' '),text);
  assert.ok(sentenceReview({original:text,corrected:text}).rows.every(r=>r.status==='unchanged'));
});
test('ambiguous repeated excerpts are not expanded into fabricated optional sentences',()=>{
  const r=sentenceReview({original:'I like music and I like music.',corrected:'I like music and I like music.',comparisons:[comparison('I like music','I like music','I love singing')]});
  assert.equal(r.rows[0].improved,'');
});
test('an omitted repeated sentence is not automatically marked as reviewed',()=>{
  const r=sentenceReview({original:'I enjoy music. I enjoy music.',corrected:'I enjoy music.'});
  assert.equal(r.rows.length,2);assert.equal(r.pending,1);
  assert.equal(r.rows.filter(row=>row.status==='unchanged').length,1);
});
