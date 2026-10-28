import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Blob,Date,Promise,Error});return exports;}
const {readSpeakingRecovery,freezeSpeakingPayload,persistSpeakingRecovery,speakingReceiptMatches}=load('src/lib/speaking-recovery.ts');
const {joinSpeakingChunks,speakingChunkWriter}=load('src/lib/speaking-recovery-audio.ts');
const id='11111111-1111-4111-8111-111111111111',audioId='22222222-2222-4222-8222-222222222222';
const source=()=>({schema:1,id,title:'Tell a story',topic:3,fragments:[{speaker:'You',delta:'Yesterday I go home.',start_ms:0,end_ms:1500}],reflection:'Try past tense.',elapsed:12,startedAt:'2026-10-28T12:00:00.000Z',conversationSaved:false,feedbackAttempted:false,feedbackReady:false,audioDocumentId:audioId,audioExpected:false});
const frozen=()=>freezeSpeakingPayload(source(),'[0.0s] You: Yesterday I go home.','Try past tense.',()=>audioId);
function fixture(extra={}){
 let current=true,value=frozen();const calls=[],kept=[],audio=new Blob(['sample sound'],{type:'audio/webm'});
 const receipt=v=>({ok:true,received:true,record:{id:v.id,title:v.savePayload.title,body:{transcript:v.savePayload.transcript,reflection:v.savePayload.reflection}}});
 const options={value,recovered:false,sample:null,maxAudioBytes:2621440,current:()=>current,checkpoint:v=>{value=v;kept.push(structuredClone(v));return true;},onStatus:s=>calls.push(['status',s]),save:async v=>{calls.push(['save',structuredClone(v)]);return receipt(v);},analyse:async record=>{calls.push(['analyse',record]);return {ok:true,record:{id:record,body:{aiAnalysis:'Saved source-bound feedback.'}}};},upload:async(v,b)=>{calls.push(['upload',v.audioDocumentId]);return {ok:true,received:true,document:{id:v.audioDocumentId,files:[{type:b.type,size:b.size}]}};},attach:async(record,documentId)=>{calls.push(['attach',record,documentId]);return {ok:true,record:{id:record,body:{audioDocumentId:documentId}}};},...extra};
 return {options,calls,kept,audio,receipt,setCurrent:next=>current=next,run:()=>persistSpeakingRecovery(options),latest:()=>value};
}
const eventCalls=f=>f.calls.filter(([kind])=>kind!=='status');
test('recovery validation preserves literal evidence and rejects malformed identifiers, dates, fragments or frozen payloads',()=>{
 const value=source(),read=readSpeakingRecovery(value);assert.equal(read.fragments[0].delta,'Yesterday I go home.');
 for(const change of [{id:'../other'},{audioDocumentId:'bad'},{startedAt:'not a date'},{fragments:[{...value.fragments[0],delta:null}]},{savePayload:{title:'A',transcript:'',reflection:''}}])assert.equal(readSpeakingRecovery({...value,...change}),null);
 assert.equal(value.fragments[0].delta,read.fragments[0].delta);read.fragments[0].delta='Changed';assert.equal(value.fragments[0].delta,'Yesterday I go home.');
});
test('the exact first save payload and audio id survive every retry without adopting edited reflection or transcript',()=>{
 const first=frozen(),retry=freezeSpeakingPayload(first,'CHANGED TEXT','CHANGED REFLECTION',()=>{throw Error('Must retain the original audio id');});
 assert.deepEqual(retry.savePayload,first.savePayload);assert.equal(retry.id,id);assert.equal(retry.audioDocumentId,audioId);
 assert.equal(speakingReceiptMatches({ok:true,received:true,record:{id,title:first.savePayload.title,body:{transcript:first.savePayload.transcript,reflection:first.savePayload.reflection}}},first),true);
});
test('normal finalisation preserves the save, single feedback and exact audio attachment sequence',async()=>{
 const f=fixture();f.options.value={...f.options.value,audioExpected:true};f.options.sample=Promise.resolve(f.audio);
 const outcome=await f.run();assert.equal(outcome.kind,'saved');assert.deepEqual(eventCalls(f).map(([kind])=>kind),['save','analyse','upload','attach']);
 assert.ok(f.kept.find(v=>v.feedbackAttempted),'A durable attempted marker precedes analysis.');assert.equal(outcome.value.feedbackReady,true);
 assert.equal(f.calls.find(([kind])=>kind==='save')[1].savePayload.transcript,'[0.0s] You: Yesterday I go home.');
});
test('an unconfirmed save or mismatched exact receipt never starts analysis or audio upload',async()=>{
 for(const response of [{ok:true},{ok:true,received:true,record:{id:'other'}},{ok:false,offline:true}]){
  const f=fixture({save:async()=>response}),outcome=await f.run();assert.equal(outcome.kind,'retry');assert.equal(eventCalls(f).length,0);assert.equal(f.latest().conversationSaved,false);
 }
 const f=fixture();f.options.save=async v=>({...f.receipt(v),record:{...f.receipt(v).record,body:{transcript:'Other original',reflection:v.savePayload.reflection}}});assert.equal((await f.run()).kind,'retry');assert.equal(f.calls.some(([kind])=>kind==='analyse'),false);
});
test('no durable frozen copy means no request; a failed durable attempted marker means no paid analysis',async()=>{
 const unavailable=fixture({checkpoint:()=>false});assert.equal((await unavailable.run()).kind,'retry');assert.equal(eventCalls(unavailable).length,0);
 const f=fixture(),write=f.options.checkpoint;f.options.checkpoint=value=>value.feedbackAttempted?false:write(value);
 assert.equal((await f.run()).kind,'saved');assert.equal(eventCalls(f).some(([kind])=>kind==='analyse'),false);
});
test('restored recovery saves the original and optional sound without automatically replaying paid analysis',async()=>{
 for(const attempted of [false,true]){
  const f=fixture({recovered:true});f.options.value={...f.options.value,feedbackAttempted:attempted,audioExpected:true};f.options.sample=Promise.resolve(f.audio);
  const outcome=await f.run();assert.equal(outcome.kind,'saved');assert.deepEqual(eventCalls(f).map(([kind])=>kind),['save','upload','attach']);assert.match(outcome.message,/Open Feedback/);
 }
});
test('an uncertain feedback result is not paid for again on a same-tab retry',async()=>{
 const f=fixture();f.options.value={...f.options.value,audioExpected:true};f.options.sample=Promise.resolve(f.audio);f.options.analyse=async()=>{f.calls.push(['analyse']);return {ok:false,offline:true};};f.options.upload=async()=>({ok:false});
 const first=await f.run();assert.equal(first.kind,'retry');assert.equal(first.value.feedbackAttempted,true);
 f.options.value=first.value;await f.run();assert.equal(eventCalls(f).filter(([kind])=>kind==='analyse').length,1);assert.equal(eventCalls(f).filter(([kind])=>kind==='save').length,1);
});
test('account/source changes after any async step stop all remaining requests and checkpoints',async()=>{
 for(const step of ['save','analyse','sample','upload','attach']){
  const f=fixture();f.options.value={...f.options.value,audioExpected:true};f.options.sample=Promise.resolve(f.audio);
  if(step==='sample')f.options.sample={then:resolve=>{f.setCurrent(false);resolve(f.audio);}};
  else{const original=f.options[step];f.options[step]=async(...args)=>{const result=await original(...args);f.setCurrent(false);return result;};}
  const outcome=await f.run();assert.equal(outcome.kind,'stale',step);const kinds=eventCalls(f).map(([kind])=>kind);
  const expected={save:['save'],analyse:['save','analyse'],sample:['save','analyse'],upload:['save','analyse','upload'],attach:['save','analyse','upload','attach']};assert.deepEqual(kinds,expected[step]);
 }
});
test('missing audio retains recovery, and an upload receipt with different bytes or mime never attaches',async()=>{
 const missing=fixture();missing.options.value={...missing.options.value,audioExpected:true};assert.equal((await missing.run()).kind,'audio-missing');
 const f=fixture();f.options.value={...f.options.value,audioExpected:true};f.options.sample=Promise.resolve(f.audio);f.options.upload=async()=>({ok:true,received:true,document:{id:audioId,files:[{type:'audio/mp4',size:1}]}});
 assert.equal((await f.run()).kind,'retry');assert.equal(eventCalls(f).some(([kind])=>kind==='attach'),false);
});
test('audio assembly preserves order and rejects mixed types, gaps and missing first chunks',async()=>{
 const chunks=[{sequence:1,blob:new Blob(['second'],{type:'audio/webm'})},{sequence:0,blob:new Blob(['first'],{type:'audio/webm;codecs=opus'})}];
 assert.equal(await joinSpeakingChunks(chunks).text(),'firstsecond');assert.equal(chunks[0].sequence,1);
 for(const corrupt of [[chunks[0]],[{sequence:0,blob:new Blob(['first'],{type:'text/plain'})}],[chunks[1],{sequence:1,blob:new Blob(['second'],{type:'audio/mp4'})}]])assert.throws(()=>joinSpeakingChunks(corrupt));
});
test('chunk finalisation waits for commits and a failed commit prevents later chunks being treated as durable',async()=>{
 const order=[];let release;const first=new Promise(resolve=>release=resolve),writer=speakingChunkWriter(async sequence=>{if(sequence===0)await first;order.push(sequence);});
 const a=writer.append(new Blob(['first'])),b=writer.append(new Blob(['second']));assert.deepEqual(order,[]);release();await Promise.all([a,b,writer.flush()]);assert.deepEqual(order,[0,1]);
 const written=[],failed=speakingChunkWriter(async sequence=>{written.push(sequence);throw Error('Storage full');});await assert.rejects(failed.append(new Blob(['first'])));await assert.rejects(failed.append(new Blob(['second'])));await assert.rejects(failed.flush());assert.deepEqual(written,[0]);
});


test('a receipt-backed audio attachment survives local cleanup failure without demanding or uploading the deleted device sample',async()=>{
 const f=fixture({recovered:true});f.options.value={...f.options.value,conversationSaved:true,audioExpected:true,audioSaved:true};
 const outcome=await f.run();assert.equal(outcome.kind,'saved');assert.match(outcome.message,/short audio sample saved/);assert.deepEqual(eventCalls(f),[]);
});
