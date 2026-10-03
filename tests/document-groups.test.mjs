import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/document-groups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const {documentGroups,documentMeta,documentContext}=exports;
const doc=(id,parentId='',title='Same title')=>({id,parentId,title,created:'2026-09-23T03:00:00Z'});
test('an original, review and replacement stay in one explicit group',()=>{
 const groups=documentGroups([doc('review-2','review-1'),doc('original'),doc('review-1','original')]);
 assert.equal(groups.length,1);assert.equal(groups[0].root.id,'original');assert.equal(groups[0].items.length,3);
});
test('same-day same-title unrelated writing stays separate, missing links remain accessible',()=>{
 assert.equal(documentGroups([doc('first'),doc('second'),doc('orphan','missing')]).length,3);
});
test('malformed legacy loops remain bounded and preserve every item',()=>{
 const groups=documentGroups([doc('a','b'),doc('b','a')]);assert.equal(groups.length,1);assert.equal(groups[0].items.length,2);
});
test('document metadata roundtrips without displaying internal markers in the task',()=>{
 const context='[Work source: School homework — set by the school]\nWrite an essay.';
 const saved=documentContext(context,'review','b7e067c7-8ea7-4386-850a-d72e03bad44e');
 assert.equal(documentMeta(saved).context,context);assert.equal(documentMeta(saved).role,'review');
 assert.equal(documentContext(saved,'answer').includes('Learning review:'),false);
});
const writingExports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/saved-writing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:writingExports,require:()=>exports});
const writingDoc=(id,role='answer',parentId='')=>({...doc(id,parentId),context:documentContext('School task',role),files:[{type:'image/jpeg'}]});
test('completed uploads are discoverable as one work item without treating task-only files or audio as writing',()=>{
 const groups=writingExports.savedWritingGroups([writingDoc('answer'),writingDoc('review','review','answer'),writingDoc('instructions','task'),{...writingDoc('voice'),files:[{type:'audio/mp4'}]}]);
 assert.equal(groups.length,1);assert.equal(groups[0].root.id,'answer');assert.equal(groups[0].items.length,2);
});
test('a linked manual review is shown once in reviews while originals remain discoverable in homework',()=>{
 const id='b7e067c7-8ea7-4386-850a-d72e03bad44e';
 const answer=writingDoc('answer');answer.context=documentContext(answer.context,'answer',id);
 assert.equal(writingExports.savedWritingGroups([answer],[id]).length,0);
 assert.equal(writingExports.savedWritingGroups([answer]).length,1);
 assert.equal(writingExports.savedWritingGroups([answer],['unrelated']).length,1);
});
test('the evidence date survives organisation changes and is distinct from the upload date',()=>{
 const answer=writingDoc('answer');answer.created='2026-10-02T22:31:11.173Z';
 answer.context=documentContext('[Work date: 2026-10-02]\nSchool task','answer');
 assert.equal(writingExports.savedWorkDate(answer),'2026-10-02');
 assert.equal(documentMeta(answer.context).context,'School task');
 assert.equal(documentMeta(documentContext(answer.context,'review')).workDate,'2026-10-02');
 answer.context='[Work date: 2026-99-99]';assert.equal(writingExports.savedWorkDate(answer),answer.created);
});
