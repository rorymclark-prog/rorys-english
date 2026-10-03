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
