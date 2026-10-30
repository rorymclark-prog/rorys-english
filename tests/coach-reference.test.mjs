import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/coach-reference.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test('matching slide notes avoid another exercise or answer',()=>{
  const notes='# Preparation\nOverview\n## Slide 1 — Start\nAnswer ONE\n## Slide 10 — Story\nAnswer TEN\n## Slide 11 — Quiz\nAnswer ELEVEN';
  assert.match(exports.coachSlideNotes(notes,10),/Answer TEN/);
  assert.doesNotMatch(exports.coachSlideNotes(notes,1),/TEN|ELEVEN/);
  assert.equal(exports.coachSlideNotes(notes,2),'');
  assert.equal(exports.coachSlideNotes(notes,NaN),'');
});
test('active slide and current delivery guide accompany clearly qualified supporting notes',()=>{
  const text=exports.coachReferenceSource('Current task',{title:'Saved lesson',unit:'Unit 1',overview:'Prepared, not completed.',guide:'Use in-deck fallback.',teacherNotes:'## Slide 2 — Watch\nOpen external video.',notesHistorical:true},2);
  assert.match(text,/Current task/);assert.match(text,/Use in-deck fallback/);assert.match(text,/governs older media/);assert.match(text,/Supporting original/);
  assert.ok(text.length<=12000);
});
test('bounded current source leaves room for selected preparation and notes',()=>{
  const text=exports.coachReferenceSource('x'.repeat(12000),{title:'Lesson B',unit:'Unit 2',overview:'Saved plan',guide:'Current direction',teacherNotes:'## Slide 3 — Now\nOne useful answer'},3);
  assert.match(text,/Lesson B/);assert.match(text,/Current direction/);assert.match(text,/One useful answer/);assert.ok(text.length<=12000);
  assert.equal(exports.coachReferenceSource('plain',null,1),'plain');
});
test('embedded current-slide teacher notes take precedence over historical notes',()=>{
  const text=exports.coachReferenceSource('Question',{title:'Reviewed deck',unit:'Unit 1',overview:'Preparation',guide:'Use source jump',teacherNotes:'## Slide 4 — Video\nPlay the old video',notesHistorical:true},4,'Use the complete in-deck visual fallback.');
  assert.match(text,/Private teacher notes embedded/);assert.match(text,/complete in-deck visual fallback/);assert.doesNotMatch(text,/Play the old video/);
  assert.match(exports.coachReferenceSource('Question',null,4,'Embedded answer'),/Embedded answer/);
});
