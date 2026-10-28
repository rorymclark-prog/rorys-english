import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const modules={};function read(name){if(modules[name])return modules[name];const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>read(p.replace('./',''))});return modules[name]=exports;}
const m=read('document-feedback'),base={title:'20261009_141746',context:'',files:[{type:'image/jpeg'}],status:'ready',feedback:'',reviewPending:false,processing:false};
test('saved work distinguishes conversation audio, writing, school worksheets and supporting material',()=>{
 assert.equal(m.documentWorkType({...base,title:'AI conversation audio · Open chat',files:[{type:'audio/webm'}]}),'conversation');
 assert.equal(m.documentWorkType({...base,files:[{type:'audio/webm'}]}),'recording');
 assert.equal(m.documentWorkType(base),'writing');
 assert.equal(m.documentTypeLabel({...base,workType:'worksheet',context:'[Document role: answer]\n[Work source: School homework — set by the school]'}),'School worksheet');
 assert.equal(m.documentWorkType({...base,analysis:{exerciseAnswers:[{}]}}),'worksheet');
 assert.equal(m.documentWorkType({...base,context:'[Document role: task]'}),'material');
});
test('completion remains separate from a private check or held optional teacher feedback',()=>{
 assert.equal(m.documentStatusLabel({...base,needsTeacherCheck:true}),'Done · feedback ready');
 assert.equal(m.documentStatusLabel({...base,reviewPending:true}),'Done · feedback ready');
 assert.equal(m.documentStatusLabel({...base,status:'saved',files:[{type:'audio/webm'}]}),'Done · recording saved');
 assert.equal(m.documentStatusLabel({...base,status:'error'}),'Saved · feedback needs a retry');
 assert.equal(m.documentStatusLabel({...base,processing:true}),'Preparing feedback');
 assert.equal(m.documentStatusLabel({...base,workType:'material'}),'Saved · task material');
});
test('the existing supplied-word worksheet keeps all its answers and uncertainty when rendered generically',()=>{
 const answers=m.documentAnswerReview({exerciseAnswers:[{number:1,base:'GROW',response:'growth (appears to read)',status:'uncertain',note:'Confirm the overwritten spelling.'},{number:2,base:'HIGH',response:'higher',status:'fits',note:'Fits this gap.'}]});
 assert.equal(answers.length,2);assert.equal(answers[0].status,'uncertain');assert.equal(answers[0].correction,'');assert.equal(answers[1].status,'correct');
});
