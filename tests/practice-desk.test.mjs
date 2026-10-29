import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function moduleFile(file,dependencies={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>dependencies[name],Date,Intl,Map,Set,Promise});return exports;}
const dates=moduleFile('src/lib/teacher-metrics.ts');
const desk=moduleFile('src/lib/practice-desk.ts',{'./documents':{},'./teacher-metrics':dates,'./evidence-common':{softwareCheck:(...labels)=>labels.some(label=>/^SECTEST\b/i.test(String(label)))}});
const plain=value=>JSON.parse(JSON.stringify(value));
const exercise=(id='exercise-first-001',extra={})=>({id,type:'gap',prompt:'Last week I ___ to school. (walk)',focus:'Past simple',options:[],accepted:['walked'],example:'walked',explanation:'Use the past simple.',...extra});
const attempt=(id,created,status='correct',extra={})=>({id,documentId:'document-writing-001',version:'v1',exerciseId:'exercise-first-001',created,answer:'walked',result:{status,example:'walked',explanation:'Use the past simple.'},...extra});
const source=(extra={})=>({id:'document-writing-001',documentId:'document-writing-001',title:'My journey',created:'2026-10-28T09:00:00Z',version:'v1',exercises:[exercise()],attempts:[],...extra});
const document=(id,extra={})=>({id,title:'My writing',created:'2026-10-28T09:00:00Z',status:'ready',processing:false,files:[{type:'image/jpeg'}],context:'',practiceVersion:'v1',analysis:{writing:{original:'I walk to school yesterday.'},exercises:[exercise()]},practiceAttempts:[],...extra});

test('first attempts expose only task fields and use stable identities across refreshes',()=>{
 const cards=desk.buildPracticeCards([source(),source()], '2026-10-29');assert.equal(cards.length,1);assert.equal(cards[0].state,'first');assert.equal(cards[0].lastPractised,null);assert.deepEqual(Object.keys(cards[0].exercise).sort(),['focus','id','options','prompt','type']);assert.equal(cards[0].id,desk.buildPracticeCards([source()], '2026-10-29')[0].id);
});
test('latest saved attempts determine retry and revisit without granting mastery to open answers',()=>{
 const cases=[['try-again','2026-10-28T10:00:00Z','retry'],['correct','2026-10-26T10:00:00Z','revisit'],['compare','2026-10-26T10:00:00Z','revisit'],['correct','2026-10-27T10:00:00Z','recent']];
 for(const [status,created,state] of cases){const card=desk.buildPracticeCards([source({attempts:[attempt('attempt-1',created,status)]})],'2026-10-29')[0];assert.equal(card.state,state);assert.equal(card.attempts.length,1);assert.equal(card.lastPractised,created);}
 const cards=desk.buildPracticeCards([source({attempts:[attempt('attempt-old','2026-10-25T10:00:00Z','try-again'),attempt('attempt-latest','2026-10-28T10:00:00Z')]})],'2026-10-29');assert.equal(cards[0].state,'recent');
});
test('revisit uses Vienna calendar days across daylight-saving changes and midnight',()=>{
 assert.equal(desk.practiceDeskToday(new Date('2026-10-28T23:30:00Z')),'2026-10-29');
 const card=desk.buildPracticeCards([source({attempts:[attempt('attempt-1','2026-10-26T23:30:00Z')]})],'2026-10-29')[0];assert.equal(card.state,'recent');
 assert.equal(desk.buildPracticeCards([source({attempts:[attempt('attempt-1','2026-10-25T00:30:00Z')]})],'2026-10-28')[0].state,'revisit');
 // Timestamp offsets must sort by their instants, rather than their text.
 const attempts=[attempt('earlier','2026-10-28T10:00:00+02:00','try-again'),attempt('later','2026-10-28T09:00:00Z')];assert.equal(desk.buildPracticeCards([source({attempts})],'2026-10-29')[0].state,'recent');
});
test('attempts from stale versions, other documents/exercises and future or invalid dates do not influence the card',()=>{
 const attempts=[attempt('stale','2026-10-28T10:00:00Z','correct',{version:'old'}),attempt('other-source','2026-10-28T10:00:00Z','correct',{documentId:'another-document'}),attempt('other-exercise','2026-10-28T10:00:00Z','correct',{exerciseId:'another-exercise'}),attempt('invalid','nonsense'),attempt('future','2026-10-30T10:00:00Z')];
 const card=desk.buildPracticeCards([source({attempts})],'2026-10-29')[0];assert.equal(card.state,'first');assert.equal(card.attempts.length,0);
 const valid=attempt('valid','2026-10-28T10:00:00Z');assert.equal(desk.buildPracticeCards([source({attempts:[valid,valid],exercises:[exercise(),exercise()]})],'2026-10-29')[0].attempts.length,1);
 assert.throws(()=>desk.buildPracticeCards([source()],'2026-02-30'),/valid calendar date/);
});
test('cards prioritise first tries, retries and revisits while retaining original exercise order',()=>{
 const sources=[source({id:'recent',documentId:'recent',attempts:[attempt('a','2026-10-28T10:00:00Z','compare',{documentId:'recent'})]}),source({id:'retry',documentId:'retry',attempts:[attempt('b','2026-10-28T10:00:00Z','try-again',{documentId:'retry'})]}),source({id:'revisit',documentId:'revisit',attempts:[attempt('c','2026-10-25T10:00:00Z','correct',{documentId:'revisit'})]}),source({id:'first',documentId:'first',exercises:[exercise('second-in-alphabet'),exercise('first-in-alphabet')]})];
 assert.deepEqual(plain(desk.buildPracticeCards(sources,'2026-10-29').map(card=>[card.sourceId,card.exercise.id])),[['first','second-in-alphabet'],['first','first-in-alphabet'],['retry','exercise-first-001'],['revisit','exercise-first-001'],['recent','exercise-first-001']]);
});
test('loader bounds reads to eight sources and three concurrent details, without generating or writing',async()=>{
 const documents=Array.from({length:10},(_,index)=>document(`document-${index}`,{created:`2026-10-${String(10+index).padStart(2,'0')}T10:00:00Z`}));let active=0,maxActive=0;const calls=[];
 const request=async(code,teacher,body)=>{calls.push({code,teacher,...body});if(body.action==='documents')return {ok:true,documents:[...documents,documents[0]]};active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return {ok:true,document:documents.find(item=>item.id===body.id)};};
 const result=await desk.loadPracticeDesk('learner-code',true,{request,today:'2026-10-29'});assert.equal(result.sources.length,8);assert.equal(result.cards.length,8);assert.equal(result.hasMore,true);assert.equal(maxActive,3);assert.equal(calls.length,9);assert.ok(calls.every(call=>call.code==='learner-code'&&call.teacher===true));assert.deepEqual([...new Set(calls.map(call=>call.action))],['documents','document']);assert.equal(result.sources[0].id,'document-9');assert.equal(result.sources[0].exercises[0].example,undefined);
});
test('loader excludes materials, recordings, conversations, held and unfinished feedback and tolerates missing optional classification',async()=>{
 const good=document('writing-without-type',{files:undefined}),docs=[good,document('material',{workType:'material'}),document('task',{context:'[Document role: task]\nRead this.'}),document('review',{context:'[Document role: review]'}),document('audio',{files:[{type:'audio/mp4'}]}),document('conversation',{hasConversationFeedback:true}),document('conversation-type',{workType:'conversation'}),document('recording',{workType:'recording'}),document('held',{reviewPending:true}),document('future-release',{feedbackAvailableAt:'2999-10-28T10:00:00Z'}),document('invalid-release',{feedbackAvailableAt:'not-a-date'}),document('processing',{processing:true}),document('saved',{status:'saved'}),document('test',{title:'SECTEST preserved fixture'})];const details=[];
 const result=await desk.loadPracticeDesk('student',false,{today:'2026-10-29',request:async(_code,_teacher,body)=>body.action==='documents'?{ok:true,documents:docs}:(details.push(body.id),{ok:true,document:good})});assert.deepEqual(details,['writing-without-type']);assert.equal(result.cards.length,1);assert.equal(result.hasMore,false);
});
test('partial detail failures retain successful work and list failures remain errors rather than empty success',async()=>{
 const docs=[document('success'),document('refused'),document('throws'),document('wrong-id'),document('no-exercises',{analysis:{writing:{original:'Text'},exercises:[]}})];
 const result=await desk.loadPracticeDesk('student',false,{today:'2026-10-29',request:async(_code,_teacher,body)=>{if(body.action==='documents')return {ok:true,documents:docs};if(body.id==='throws')throw Error('Unavailable');if(body.id==='refused')return {ok:false,error:'Access denied'};if(body.id==='wrong-id')return {ok:true,document:document('another-id')};return {ok:true,document:docs.find(item=>item.id===body.id)};}});assert.equal(result.sources.length,1);assert.equal(result.warnings.length,1);assert.match(result.warnings[0],/3 pieces/);
 await assert.rejects(desk.loadPracticeDesk('student',false,{request:async()=>({ok:false,error:'Sign in again'})}),/Sign in again/);
 const empty=await desk.loadPracticeDesk('student',false,{request:async()=>({ok:true,documents:[]})});assert.equal(empty.cards.length,0);assert.equal(empty.hasMore,false);assert.equal(empty.warnings.length,0);
});
