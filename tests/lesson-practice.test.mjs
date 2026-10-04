import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(file,requires={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>requires[name]||(()=>{throw Error(name)})()});return exports;};
const practice=load('src/lib/lesson-practice.ts'),guided=load('src/lib/guided-speaking.ts');
const voice=load('src/lib/server/voice-session.ts',{'../lesson-practice':practice,'../guided-speaking':guided});
const plan={version:1,status:'ready',sourceReviewId:'source-lesson',lessonDate:'2026-10-03',title:'A fresh story',recap:'We practised reasons.',focus:['Use past verbs','Add a reason'],speakingPrompt:'Tell a fictional story about a changed plan.',coaching:'Ask about one event, then a second. Help with one verb only if needed.',writingPrompt:'Write four original sentences.',speakingMinutes:6,writingMinutes:5,successCriteria:['A clear sequence','An original reason']};
const record={id:'practice-a',created:'2026-10-04T10:00:00Z',date:'2026-10-03',kind:'lesson',visibility:'shared',title:'Practice',author:'Rory',body:{lessonPractice:plan,tutorPrivate:{plan:'PRIVATE TEACHER SECRET'},transcript:'RAW RECORDING SECRET'}};
test('practice selection requires a shared ready lesson and excludes drafts, held reviews and mismatched dates',()=>{
 assert.equal(practice.lessonPracticeRecord([record]).record.id,'practice-a');
 for(const change of [{visibility:'teacher'},{kind:'speaking'},{date:'2026-10-02'},{reviewPending:true},{body:{lessonPractice:{...plan,status:'draft'}}},{body:{lessonPractice:{...plan,focus:[]}}}])assert.equal(practice.lessonPracticeRecord([{...record,...change}]),null);
 assert.equal(practice.lessonPracticeRecord([record],'other-student-id'),null);
 const newer={...record,id:'practice-b',date:'2026-10-10',body:{lessonPractice:{...plan,lessonDate:'2026-10-10'}}};
 assert.equal(practice.lessonPracticeRecord([record,newer]).record.id,'practice-b');assert.equal(practice.lessonPracticeRecord([record,newer],'practice-a').record.id,'practice-a');
});
test('the brief forwards a bounded field whitelist and coaches independent attempts before and after support',()=>{
 const clean=practice.readLessonPractice({...plan,tutorPrivate:'PRIVATE SECRET',transcript:'RAW SECRET'});
 const config=voice.voiceConfiguration({code:'student',topic:'lesson',sdp:'v=0',lessonPractice:{coaching:'FORGED CLIENT INSTRUCTIONS'}},null,clean);
 for(const prompt of [config.session.instructions,config.session.delegation.responses.instructions]){
  assert.match(prompt,/Begin with an independent attempt/);assert.match(prompt,/fresh independent situation/);assert.match(prompt,/five or six words/);assert.match(prompt,/fictional story/);assert.doesNotMatch(prompt,/PRIVATE SECRET|RAW SECRET|FORGED CLIENT/);
 }
 assert.throws(()=>voice.voiceConfiguration({topic:'lesson',sdp:'v=0',lessonPractice:plan}));
 for(const changes of [{coaching:'x'.repeat(2001)},{focus:['a','b','c','d']},{speakingMinutes:30},{version:2}])assert.equal(practice.readLessonPractice({...plan,...changes}),null);
});
test('lesson voice reads only the authenticated student view, refuses another plan and never sends private context or credentials to OpenAI',async()=>{
 const {createHash}=await import('node:crypto');const route={},reads=[],paid=[];let records=[record];
 const source=ts.transpileModule(fs.readFileSync('src/app/api/voice/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 class TransportError extends Error{}
 vm.runInNewContext(source,{exports:route,Response,URL,AbortSignal,console,process:{env:{LIVE_VOICE_ENABLED:'true',OPENAI_API_KEY:'synthetic',APPS_SCRIPT_URL:'https://script.google.com/test',FIREBASE_PROJECT_ID:'synthetic',ACCOUNT_ROSTER_JSON:JSON.stringify({'student-a':{uid:'uid-a',email:'a@example.test'},'student-b':{uid:'uid-b',email:'b@example.test'}})}},require:name=>{
  if(name==='node:crypto')return {createHash};
  if(name==='firebase-admin/app')return {getApps:()=>[{name:'english-server'}]};
  if(name==='firebase-admin/auth')return {getAuth:()=>({verifyIdToken:async()=>({uid:'uid-a',email:'a@example.test',email_verified:true})})};
  if(name.includes('voice-session'))return voice;if(name.includes('lesson-practice'))return practice;
  if(name.includes('progress-backend'))return {backendSession:async(code,token)=>{reads.push({login:code,token});return 'backend-session';},upstream:async body=>{reads.push(body);return {ok:true,records};}};
  if(name.includes('progress-transport'))return {ProgressTransportError:TransportError,postProgress:async()=>({ok:true,students:[]})};
  if(name.includes('google-http'))return {};if(name.includes('content/students.json'))return {default:[{code:'student-a',id:'ferdi'},{code:'student-b',id:'valentin'}]};if(name.includes('/units.json'))return {default:[]};
  throw Error(name);
 },fetch:async(_url,options)=>{paid.push(JSON.parse(options.body));return Response.json({session:{id:'synthetic-session'},transport:{sdp:'v=0 answer'}});}});
 const call=extra=>route.POST(new Request('https://app.test/api/voice/',{method:'POST',headers:{origin:'https://app.test'},body:JSON.stringify({code:'student-a',token:'firebase-token',topic:'lesson',lessonPracticeId:'practice-a',sdp:'v=0',...extra})}));
 assert.equal((await call({code:'student-b'})).status,403);assert.equal(reads.length,0);
 assert.equal((await call({lessonPracticeId:'practice-b'})).status,409);assert.equal(paid.length,0);
 records=[{...record,visibility:'teacher'}];assert.equal((await call({})).status,409);assert.equal(paid.length,0);
 records=[{...record,reviewPending:true}];assert.equal((await call({})).status,409);assert.equal(paid.length,0);
 records=[record];assert.equal((await call({practiceStudent:'student-b',lessonPractice:{coaching:'FORGED'}})).status,201);
 const sent=JSON.stringify(paid[0]);assert.doesNotMatch(sent,/PRIVATE TEACHER SECRET|RAW RECORDING SECRET|FORGED|firebase-token|backend-session/);
 assert.equal(reads.filter(r=>r.action).every(r=>r.code==='student-a'),true);
 // Teacher tests can select a learner, but fetch only the student-visible view.
 const teacher=await call({code:'__teacher__',teacherTest:true,token:'teacher-token',practiceStudent:'student-b'});assert.equal(teacher.status,201);assert.equal(reads.at(-1).preview,true);assert.equal(reads.at(-1).code,'student-b');
});
