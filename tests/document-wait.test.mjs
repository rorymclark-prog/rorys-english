import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/documents.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({})});
const {analysisReadState}=exports;
test('a slow AI request keeps waiting for its saved complete result, never treats an older excerpt analysis as completion',()=>{
 const old={processing:false,error:'',analysis:{transcription:'Earlier reading'}};
 assert.equal(analysisReadState(old,false,''),'waiting');
 assert.equal(analysisReadState({...old,processing:true},false,''),'waiting');
 assert.equal(analysisReadState({...old,analysis:{writing:{original:'I swim.',comparisons:[]}}},true,''),'ready');
});
test('a new failure ends the wait while a previous failure does not stop a new attempt before it starts',()=>{
 const failed={processing:false,error:'Incomplete reading',analysis:null};
 assert.equal(analysisReadState(failed,false,'Incomplete reading'),'waiting');
 assert.equal(analysisReadState(failed,true,'Incomplete reading'),'error');
 assert.equal(analysisReadState(failed,false,''),'error');
 assert.equal(analysisReadState({...failed,processing:true},true,''),'waiting');
});
