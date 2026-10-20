import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/ring-documents.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Promise,Array,Error});
const doc=(id,extra={})=>({id,status:'ready',files:[{type:'image/jpeg'}],context:'',...extra});
test('historical ring reads load exact saved analyses omitted by the index, without reading audio or starting analysis',async()=>{
 const original=[doc('answer-one'),doc('audio',{files:[{type:'audio/webm'}]}),doc('task',{context:'[Document role: task]'}),doc('failed',{status:'error'}),doc('already-full',{analysis:null})],calls=[];
 const result=await exports.ringDocuments(original,async id=>{calls.push(id);return {ok:true,document:doc(id,{analysis:{writing:{original:'My real earlier writing.'}}})}});assert.deepEqual(calls,['answer-one']);assert.equal(result[0].analysis.writing.original,'My real earlier writing.');assert.equal(original[0].analysis,undefined);assert.equal(result[1].id,'audio');
});
test('unavailable or foreign detail reads fail visibly instead of reporting zero older writing',async()=>{
 await assert.rejects(exports.ringDocuments([doc('answer-one')],async()=>({ok:false})),/Earlier writing could not be checked/);
 await assert.rejects(exports.ringDocuments([doc('answer-one')],async()=>({ok:true,document:doc('foreign-id')})),/Earlier writing could not be checked/);
});
test('historical detail loading is bounded to three reads at a time and retains source order',async()=>{
 let active=0,max=0;const originals=Array.from({length:8},(_,i)=>doc('answer-'+i));const result=await exports.ringDocuments(originals,async id=>{active++;max=Math.max(max,active);await new Promise(resolve=>setImmediate(resolve));active--;return {ok:true,document:doc(id,{analysis:null})}});assert.equal(max,3);assert.deepEqual(Array.from(result,d=>d.id),originals.map(d=>d.id));
});
