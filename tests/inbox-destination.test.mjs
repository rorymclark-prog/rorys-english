import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URLSearchParams});return exports;}
const {inboxDestination}=load('src/lib/inbox-destination.ts'),{focusedFeedbackFilter}=load('src/lib/feedback-source.ts');
const id='7760734b-7c56-4aee-a252-e28590a4ad0a',event={id:'speaking:'+id,kind:'speaking',code:'student-a',view:'learning'};
test('speaking notifications retain the exact source conversation and student',()=>{
 const teacher=new URL(inboxDestination(event,true),'https://example.test');assert.equal(teacher.searchParams.get('record'),id);assert.equal(teacher.searchParams.get('student'),'student-a');assert.equal(teacher.searchParams.get('section'),'learning');assert.equal(teacher.hash,'#review-'+id);
 assert.equal(inboxDestination(event,false),'/s/student-a/progress/#review-'+id);
});
test('other notifications keep their existing destination without inventing a review id',()=>{
 const got=new URL(inboxDestination({...event,id:'document:sample-document-id',kind:'upload',view:'documents'},true),'https://example.test');assert.equal(got.searchParams.get('record'),null);assert.equal(got.searchParams.get('section'),'documents');assert.equal(got.hash,'');
 const bad=new URL(inboxDestination({...event,id:'speaking:<invalid>'},true),'https://example.test');assert.equal(bad.searchParams.get('record'),null);
});
test('conversation focus chooses Conversations rather than the recorded-lessons filter',()=>{
 assert.equal(focusedFeedbackFilter({kind:'speaking',body:{evidenceType:'AI conversation captions'}}),'chat');
 assert.equal(focusedFeedbackFilter({kind:'lesson',body:{source:'/lesson-recording/sample'}}),'recorded');
 assert.equal(focusedFeedbackFilter({kind:'homework',body:{}}),'all');
});
