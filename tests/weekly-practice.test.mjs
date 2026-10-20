import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
const load=(file,deps={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n]||(()=>{throw Error(n)})(),Date,Intl,Map,Set,crypto:webcrypto,TextEncoder});return exports;};
const common=load('src/lib/evidence-common.ts');
const metrics=load('src/lib/teacher-metrics.ts',{'./evidence-common':common,'./clarity':{},'./remote':{},'./speaking-homework':{},'./guided-speaking':{},'./lesson-assessment':{},'./teaching-files':{}});
const engagement=load('src/lib/engagement.ts',{'./evidence-common':common,'./teacher-metrics':metrics});
const lesson=load('src/lib/lesson-practice.ts'),handwriting=load('src/lib/handwritten-answer.ts');
const w=load('src/lib/weekly-practice.ts',{'./engagement':engagement,'./teacher-metrics':metrics,'./evidence-common':common,'./lesson-practice':lesson,'./handwritten-answer':handwriting});
const plan={id:'current-practice-plan',title:'Current homework',date:'2026-10-17',created:'2026-10-17T10:00:00Z',kind:'lesson',visibility:'shared',body:{lessonPractice:{version:1,status:'ready',sourceReviewId:'source-review',lessonDate:'2026-10-17',title:'Practice',recap:'Recap',focus:['Writing'],speakingPrompt:'Talk',coaching:'Try',writingPrompt:'Write',speakingMinutes:10,writingMinutes:20,successCriteria:['Try independently']}}};
const empty=()=>({records:[structuredClone(plan)],documents:[],submissions:[],replies:[],progress:null});
const reply=(id,answer,extra={})=>({id,answer,reviewId:plan.id,created:'2026-10-20T09:00:00Z',author:'Student',...extra});
const vocab=(word='confident')=>({word,meaning:'sure of yourself',sentence:'I feel confident today.'});
const read=s=>w.weeklyPractice(s,'2026-10-20','2026-10-20');
const doc=(extra={})=>({id:'student-document-001',title:'My school writing',uploadedBy:'Student',created:'2026-10-20T08:00:00Z',files:[{type:'image/jpeg'}],context:'',...extra});

test('three weekly goals use existing practice and never create retrospective or holiday debt',()=>{
 const s=empty(),week=read(s);assert.equal(week.target,30);assert.equal(week.writingTarget,1);assert.equal(week.vocabularyTarget,2);
 const holiday=w.weeklyPractice(s,'2026-10-30','2026-10-30');assert.equal(holiday.target,0);assert.equal(holiday.writingTarget,0);assert.equal(holiday.vocabularyTarget,0);
 const short=w.weeklyPractice(s,'2026-11-03','2026-11-03');assert.equal(short.target,24);assert.equal(short.writingTarget,1);assert.equal(short.vocabularyTarget,2);
 assert.equal(w.weeklyPractice(s,'2026-10-12','2026-10-20').vocabularyTarget,null);
 assert.equal(w.weeklyPractice(s,'2026-10-20','2026-10-20',[{from:'2026-10-19',to:'2026-10-23'}]).writingTarget,0);
 s.records=[];assert.equal(read(s).writingTarget,null);assert.equal(read(s).vocabularyTarget,null);
});
test('only complete distinct vocabulary items count; malformed or repeated entries never become writing',()=>{
 const s=empty();s.replies=[reply('one',w.vocabularyAnswer('2026-10-19',vocab())),reply('two',w.vocabularyAnswer('2026-10-19',vocab('CONFIDENT!'))),reply('three','Weekly practice · Vocabulary\nIncomplete but has more than three words')];
 assert.equal(read(s).words.length,1);assert.equal(read(s).writing,0);
 s.replies.push(reply('four',w.vocabularyAnswer('2026-10-19',vocab('relaxed'))));assert.equal(read(s).words.length,2);
 assert.equal(w.readVocabularyAnswer(w.vocabularyAnswer('2026-10-19',{...vocab(),meaning:'sure\nof yourself'})).meaning,'sure of yourself');
 assert.throws(()=>w.vocabularyAnswer('2026-10-19',{...vocab(),sentence:'Yes'}));
});
test('saved writing counts only on a valid shared ready practice and learner receipt',()=>{
 for(const extra of [{visibility:'teacher'},{reviewPending:true},{kind:'speaking'},{date:'2026-11-01'},{body:{lessonPractice:{status:'ready'}}}]){const s=empty();s.records=[{...plan,...extra}];s.replies=[reply('one','I wrote this myself.')];assert.equal(read(s).writing,0);}
 const s=empty();s.replies=[reply('one','I wrote this myself.')];assert.equal(read(s).writing,1);
 s.replies=[reply('one','I wrote this myself.',{author:'Rory'}),reply('two','I wrote this myself.',{reviewId:'unrelated-review'})];assert.equal(read(s).writing,0);
});
test('bare uploads do not close writing; explicitly linked own current-week originals can',()=>{
 const s=empty();s.documents=[doc()];assert.equal(read(s).writing,0);
 s.replies=[reply('one',w.writingAnswer('2026-10-19',s.documents[0].id))];assert.equal(read(s).writing,1);
 for(const extra of [{uploadedBy:'Rory'},{created:'2026-10-18T08:00:00Z'},{context:'[Document role: task]'},{context:'[Document role: review]'},{files:[{type:'audio/webm'}]},{files:[]},{id:'different-document-01'}]){s.documents=[doc(extra)];assert.equal(read(s).writing,0);}
});
test('writing submissions can close writing; quizzes cannot and vocabulary is not inferred from quiz scores',()=>{
 const s=empty();s.submissions=[{id:'one',title:'Unit 1 quiz',task:'unit1',submitted:'2026-10-20T08:00:00Z',answers:{a:'I feel confident today.'}}];assert.equal(read(s).writing,0);assert.equal(read(s).words.length,0);
 s.submissions[0].title='School email writing';assert.equal(read(s).writing,1);
 s.submissions[0].title='SECTEST writing';assert.equal(read(s).writing,0);
});
test('week rollover, future receipts and optional holiday practice do not close next week',()=>{
 const s=empty();s.replies=[reply('one','My own writing attempt.'),reply('two',w.vocabularyAnswer('2026-10-19',vocab()))];
 let week=w.weeklyPractice(s,'2026-11-03','2026-11-03');assert.equal(week.writing,0);assert.equal(week.words.length,0);
 s.replies=s.replies.map(r=>({...r,created:'2026-10-21T08:00:00Z'}));assert.equal(read(s).writing,0);assert.equal(read(s).words.length,0);
 s.replies=[reply('holiday',w.vocabularyAnswer('2026-11-02',vocab()),{created:'2026-11-02T08:00:00Z'})];week=w.weeklyPractice(s,'2026-11-03','2026-11-03');assert.equal(week.words.length,0);
});
test('stable receipt identifiers make exact retries idempotent without mixing tasks or weeks',async()=>{
 const a=w.vocabularyAnswer('2026-10-19',vocab()),id=await w.practiceReplyId(plan.id,a);assert.match(id,/^[A-Za-z0-9_-]{16,100}$/);assert.equal(id,await w.practiceReplyId(plan.id,a));assert.notEqual(id,await w.practiceReplyId('another-practice',a));assert.notEqual(id,await w.practiceReplyId(plan.id,w.vocabularyAnswer('2026-11-02',vocab())));
});
