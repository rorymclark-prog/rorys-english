import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const load=(file,deps={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n]||(()=>{throw Error(n)})(),Date});return exports;};
const practice=load('src/lib/lesson-practice.ts'),m=load('src/lib/learning-memory.ts',{'./lesson-practice':practice}),a=load('src/lib/lesson-assessment.ts');
const now=new Date('2026-10-05T12:00:00Z');
const chat=(id,date='2026-10-03')=>({id,date,created:date+'T12:00:00Z',kind:'speaking',visibility:'shared',author:'Student',body:{evidenceType:'AI conversation captions',plainAiFeedback:{summary:'You gave an original example.',strengths:['You explained why.'],targets:['Try a past story.']},transcript:'PRIVATE RAW TRANSCRIPT',reflection:'PRIVATE REFLECTION',audioDocumentId:'PRIVATE AUDIO',tutorPrivate:{plan:'PRIVATE TEACHING'}}});
test('memory selects only released recent feedback, bounded sources and excludes private/raw material and account IDs',()=>{
 const records=[chat('old','2026-05-01'),chat('future','2026-10-20'),{...chat('private'),visibility:'teacher'},{...chat('held'),reviewPending:true},{...chat('recording'),body:{...chat('recording').body,source:'ferdi/lesson-recording/id'}},...['1','2','3','4'].map(i=>chat(i))];
 const memory=m.buildLearningMemory('private-account-code',records,null,now),input=m.memoryInput(memory);
 assert.equal(memory.sources.length,3);assert.doesNotMatch(input,/PRIVATE|private-account-code|old|future|held|recording/);
 assert.equal(memory.sources[0].id,'1');assert.doesNotMatch(input,/"id"/);assert.match(input,/AI|ai-conversation/);
});
test('memory opt-out, exclusion and cutoff preserve history and isolate Rory focus',()=>{
 const records=[chat('a'),chat('b','2026-10-04')],before=JSON.stringify(records);
 assert.equal(m.memoryInput(m.buildLearningMemory('a',records,{enabled:false,focus:['Secret focus']},now)),undefined);
 const memory=m.buildLearningMemory('a',records,{enabled:true,since:'2026-10-04',focus:['Past story'],excludedIds:['b']},now);
 assert.equal(memory.sources.length,0);assert.match(m.memoryInput(memory),/Past story/);assert.equal(JSON.stringify(records),before);
 assert.equal(m.memorySettings({focus:['x'.repeat(300),'y','z']}).focus.length,2);assert.equal(m.memorySettings({focus:['x'.repeat(300)]}).focus[0].length,250);
});
test('scores do not turn missing evidence into zero and comparisons require matching recorded protocols',()=>{
 const v={version:1,method:'Classroom support tracking',limits:'Transcript only',attempts:[{id:'a',time:'01:00',task:'Give advice',support:'modelled',evidence:'Completed with a model',confidence:'Inferred'}],checks:[{key:'advice',task:'Give advice',score:null,evidence:'Not checked',nextCheck:'Fresh problem',comparable:false}],areas:[],withinLesson:'Supported retry',retainedProgress:'Not checked',teaching:[]};
 assert.ok(a.readLessonAssessment(v));assert.equal(a.supportCounts(v).modelled,1);assert.equal(a.matchedChange(v,v,'advice'),null);
 const before={...v,checks:[{...v.checks[0],score:2,comparable:true,comparisonProtocol:'advice-v1-new-problem-no-hint'}]},after={...before,checks:[{...before.checks[0],score:4}]};
 assert.equal(a.matchedChange(before,after,'advice'),2);assert.equal(a.matchedChange(before,{...after,checks:[{...after.checks[0],comparisonProtocol:'different-task'}]},'advice'),null);
 assert.equal(a.readLessonAssessment({...v,checks:[{...v.checks[0],score:0}]}),null);assert.equal(a.readLessonAssessment({...v,attempts:[{...v.attempts[0],support:'made-up'}]}),null);
});
function backend(){
 const props=new Map(),rows=[];const sheet={getDataRange:()=>({getValues:()=>[['header'],...rows]}),appendRow:r=>rows.push(r)};
 const ctx={console,Date,JSON,Object,Array,String,Number,isNaN,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},studentByAnyCode_:code=>['student-a','parent-a'].includes(code)?{code:'student-a',parentCode:'parent-a'}:null,studentSheet_:()=>({getSheetByName:()=>sheet}),documentId_:x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x),documentText_:(x,max)=>typeof x==='string'&&x.length<=max,reviewHeld_:()=>false,sanitize_:x=>x};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/progress-sync/Learning.gs','utf8'),ctx);return {ctx,props,rows};
}
test('backend isolates memory settings: teacher edits focus, learner toggles only enabled, parent/preview cannot write',()=>{
 const f=backend(),call=(p,s)=>f.ctx.learningService_(p,s),student={role:'student',code:'student-a'},teacher={role:'teacher',code:'__teacher__'};
 const settings={enabled:true,since:'2026-10-01',focus:['Fresh story'],excludedIds:['old-entry']};
 assert.equal(call({action:'teacherSetLearningMemory',code:'student-a',settings},teacher).ok,true);
 assert.equal(call({action:'learningMemoryEnabled',code:'student-a',enabled:false,settings:{focus:['forged']}},student).ok,true);
 const saved=JSON.parse(f.props.get('learning_memory_student-a'));assert.equal(saved.enabled,false);assert.deepEqual(saved.focus,['Fresh story']);
 assert.equal(call({action:'teacherSetLearningMemory',code:'student-a',settings},student).ok,false);
 assert.equal(call({action:'learningMemoryEnabled',code:'student-a',enabled:true,preview:true},teacher).ok,false);
 assert.equal(call({action:'learningMemoryEnabled',code:'parent-a',enabled:true},{role:'parent',code:'parent-a'}).ok,false);
 assert.equal(call({action:'learningMemory',code:'other'},student).ok,false);assert.equal(call({action:'learningMemoryEnabled',code:'student-a',enabled:'yes'},student).ok,false);
});
test('Rory approval creates a separate safe snapshot, preserves private source and shares only whitelisted checked metrics',()=>{
 const f=backend(),body={summary:'PRIVATE LONG REPORT',transcript:'PRIVATE TRANSCRIPT',tutorPrivate:{plan:'PRIVATE TEACHING',lessonAssessment:{version:1,attempts:[{support:'prompted'}],checks:[{task:'Own story',score:3}]}}};
 f.rows.push(['private-review','2026-10-04','2026-10-03','lesson','AI draft','teacher',JSON.stringify(body),'AI draft','']);
 const p={action:'teacherPublishLessonSnapshot',code:'student-a',id:'private-review',snapshot:{summary:'You told a story.',strengths:['Clear order'],targets:['One past verb'],nextStep:'A new example',transcript:'FORGED PRIVATE'},includeMetrics:false};
 assert.equal(f.ctx.learningService_(p,{role:'student',code:'student-a'}).ok,false);
 const result=f.ctx.learningService_(p,{role:'teacher',code:'__teacher__'});assert.equal(result.ok,true);assert.equal(f.rows[0][5],'teacher');assert.equal(f.rows.length,2);
 assert.equal(result.record.body.lessonSnapshot.counts,null);assert.equal(result.record.id,'private-review-snapshot');assert.doesNotMatch(JSON.stringify(result.record),/PRIVATE|FORGED|tutorPrivate|transcript/);
 assert.equal(a.readLessonSnapshot(result.record.body.lessonSnapshot).reviewedBy,'Rory');
 const withMetrics=f.ctx.learningService_({...p,includeMetrics:true},{role:'teacher',code:'__teacher__'});assert.equal(withMetrics.record.body.lessonSnapshot.counts.prompted,1);assert.equal(withMetrics.record.body.lessonSnapshot.checks[0].score,3);assert.equal(withMetrics.record.id,result.record.id);
});
test('every voice mode gets only authenticated server learning context; opt-out and failed reads do not start blind paid sessions',async()=>{
 const {createHash}=await import('node:crypto');const guided=load('src/lib/guided-speaking.ts'),voice=load('src/lib/server/voice-session.ts',{'../lesson-practice':practice,'../guided-speaking':guided});
 const source=ts.transpileModule(fs.readFileSync('src/app/api/voice/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [mode,memoryStatus] of [...['general','everyday','story','opinions','grammar','unit'].map(mode=>[mode,'enabled']),['story','off'],['story','failed']]){
  const route={},calls=[],reads=[];class FixedDate extends Date {constructor(...x){super(...(x.length?x:['2026-10-05T12:00:00Z']));}static now(){return now.getTime();}}
  vm.runInNewContext(source,{exports:route,Date:FixedDate,Response,URL,AbortSignal,console,process:{env:{LIVE_VOICE_ENABLED:'true',OPENAI_API_KEY:'synthetic',FIREBASE_PROJECT_ID:'synthetic',ACCOUNT_ROSTER_JSON:JSON.stringify({a:{uid:'uid-a',email:'a@example.test'}})}},require:n=>{
   if(n==='node:crypto')return {createHash};if(n.includes('firebase-admin/app'))return {getApps:()=>[{name:'english-server'}]};if(n.includes('firebase-admin/auth'))return {getAuth:()=>({verifyIdToken:async()=>({uid:'uid-a',email:'a@example.test',email_verified:true})})};
   if(n.includes('learning-memory'))return {...m,buildLearningMemory:(code,records,settings)=>m.buildLearningMemory(code,records,settings,now)};if(n.includes('voice-session'))return voice;if(n.includes('lesson-practice'))return practice;
   if(n.includes('progress-backend'))return {backendSession:async()=> 'SERVER SESSION',upstream:async body=>{reads.push(body);return body.action==='learningRecords'?{ok:true,records:[chat('chat-a'),{...chat('private'),visibility:'teacher'}]}:memoryStatus==='failed'?{ok:false,error:'synthetic read failure'}:{ok:true,settings:{enabled:memoryStatus!=='off'}};}};
   if(n.includes('progress-transport'))return {ProgressTransportError:class extends Error{}};if(n.includes('google-http'))return {};if(n.includes('content/students.json'))return {default:[{code:'a',id:'ferdi'}]};if(n.includes('/units.json'))return {default:[]};throw Error(n);
  },fetch:async(_url,o)=>{calls.push(JSON.parse(o.body));return Response.json({session:{id:'synthetic'},transport:{sdp:'v=0 answer'}});}});
  const req=new Request('https://app.test/api/voice/',{method:'POST',headers:{origin:'https://app.test'},body:JSON.stringify({code:'a',token:'firebase-token',sdp:'v=0',topic:mode,grammar:'past-simple',memory:'FORGED CLIENT MEMORY'})});
  const response=await route.POST(req);if(memoryStatus==='failed'){assert.equal(response.status,503);assert.equal(calls.length,0);continue;}assert.equal(response.status,201);assert.equal(reads.filter(x=>x.action).length,2);
  const sent=JSON.stringify(calls);if(memoryStatus==='off')assert.doesNotMatch(sent,/Try a past story/);else assert.match(sent,/Try a past story/);assert.doesNotMatch(sent,/PRIVATE|FORGED|firebase-token|SERVER SESSION/);assert.match(sent,/dated, provisional/);
 }
});
