import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const load=(file,deps={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n]||(()=>{throw Error(n)})(),Date,Intl,Map,Set});return exports;};
const common=load('src/lib/evidence-common.ts'),lesson=load('src/lib/lesson-practice.ts'),handwriting=load('src/lib/handwritten-answer.ts');
const metrics=load('src/lib/teacher-metrics.ts',{'./evidence-common':common,'./clarity':{},'./remote':{},'./speaking-homework':{},'./guided-speaking':{},'./lesson-assessment':{},'./teaching-files':{}});
const engagement=load('src/lib/engagement.ts',{'./evidence-common':common,'./teacher-metrics':metrics});
const weekly=load('src/lib/weekly-practice.ts',{'./engagement':engagement,'./teacher-metrics':metrics,'./evidence-common':common,'./lesson-practice':lesson,'./handwritten-answer':handwriting});
const jsons={};for(const path of ['ferdi/units.json','valentin/units.json','year-plans.json','ferdi/english-in-context5-unit01-2026/homework.json','valentin/way2go8-unit01-2026/homework.json','ferdi/unit10/homework.json','valentin/unit05/homework.json'])jsons['../../content/'+path]={default:JSON.parse(fs.readFileSync('content/'+path,'utf8'))};
const catalog=load('src/lib/practice-catalog.ts',jsons),r=load('src/lib/practice-rings.ts',{'./engagement':engagement,'./teacher-metrics':metrics,'./evidence-common':common,'./lesson-practice':lesson,'./handwritten-answer':handwriting,'./weekly-practice':weekly,'./practice-catalog':catalog});
const code='ferdi-7h3k',unit='english-in-context5-unit01-2026',unit2='english-in-context5-unit02-2026',today='2026-10-20';
const practice={version:1,status:'ready',sourceReviewId:'original-lesson',lessonDate:'2026-10-03',title:'Family life practice',recap:'Recap',focus:['Writing'],speakingPrompt:'Talk',coaching:'Try',writingPrompt:'Write',speakingMinutes:10,writingMinutes:20,successCriteria:['Try']};
const plan={id:'current-practice-plan',title:'Family life practice',date:practice.lessonDate,created:'2026-10-04T09:00:00Z',kind:'lesson',visibility:'shared',author:'Rory',body:{lessonPractice:practice}};
const source=()=>({records:[structuredClone(plan)],documents:[],submissions:[],replies:[],progress:null});
const chat=(id='first-chat',day='2026-10-06',minutes=15)=>({id,title:'Family life · Chat 1: story',date:day,created:day+'T08:00:00Z',kind:'speaking',visibility:'shared',author:'Student',body:{submittedAt:day+'T08:00:00Z',transcript:`[0s] You: Hello\n[${minutes*60}s] AI partner: Bye`}});
const reply=(id,answer,created='2026-10-20T09:00:00Z',extra={})=>({id,reviewId:plan.id,answer,created,author:'Student',...extra});
const word=(word='relative')=>({word,meaning:'someone in your family',sentence:'My relative lives nearby.'});
const progress=(s,kind='week',id='2026-10-05')=>r.ringProgress(s,code,{kind,id},today);
const addLink=(s,item,scope,id='link-one',created='2026-10-20T09:00:00Z')=>s.replies.push(reply(id,r.ringLinkAnswer({item,week:'',unit:'',lesson:'',...scope}),created));

test('catalog retains both learners’ own available archives and the entire planned course',()=>{
 const ferdi=catalog.practiceCatalog(code),valentin=catalog.practiceCatalog('valentin-q9m2');assert.equal(ferdi.filter(u=>u.year==='2026–27').length,14);assert.equal(valentin.filter(u=>u.year==='2026–27').length,8);assert.ok(ferdi.find(u=>u.id==='unit10').available);assert.ok(valentin.find(u=>u.id==='unit05').available);assert.ok(!ferdi.some(u=>u.id==='unit05'));assert.ok(!ferdi.find(u=>u.id.includes('unit03')).available);assert.equal(catalog.practiceCatalog('unknown').length,0);
});
test('historical saved speaking and actual writing backfill an older week without altering originals',()=>{
 const s=source();s.records.push(chat());s.submissions=[{id:'old-answer',unit,task:'hw:1',submitted:'2026-10-06T10:00:00Z',answers:{draft:'My own writing attempt.'}}];const snapshot=JSON.stringify(s),p=progress(s);assert.equal(p.minutes,15);assert.equal(p.writing,1);assert.equal(p.target,30);assert.equal(p.closed,1);assert.equal(JSON.stringify(s),snapshot);
 assert.equal(progress(s,'unit',unit).minutes,15);assert.equal(progress(s,'unit',unit).writing,1);
});
test('late saved writing and vocabulary close an older week and stay dated today in the activity chart',()=>{
 const s=source();s.records.push(chat('old-chat','2026-10-06',30));s.replies=[reply('writing',r.ringPracticeAnswer('writing','2026-10-05',unit,'','I wrote this myself.')),reply('v1',r.ringPracticeAnswer('vocabulary','2026-10-05',unit,'',word())),reply('v2',r.ringPracticeAnswer('vocabulary','2026-10-05',unit,'',word('neighbour')))];const p=progress(s);assert.equal(p.closed,3);assert.equal(progress(s,'unit',unit).closed,3);assert.equal(p.selected.filter(i=>i.day===today).length,3);assert.equal(engagement.engagementEvents(s,today).filter(e=>e.kind==='reply'&&e.day===today).length,3);
});
test('linking moves weekly ring credit once while keeping original timestamps and deduplicating retries',()=>{
 const s=source();s.records.push(chat('new-chat','2026-10-20',30));addLink(s,'conversation:new-chat',{week:'2026-10-05',unit});s.replies.push({...s.replies[0]});assert.equal(progress(s).minutes,30);assert.equal(progress(s,'week','2026-10-19').minutes,0);assert.equal(progress(s,'unit',unit).minutes,30);assert.equal(progress(s).selected[0].day,today);
 addLink(s,'conversation:new-chat',{week:'2026-10-12'},'link-two','2026-10-20T10:00:00Z');assert.equal(progress(s).minutes,0);assert.equal(progress(s,'week','2026-10-12').minutes,30);
});
test('course contributions are capped per unit and cannot be filled by repeatedly practising one unit',()=>{
 const s=source();s.records.push(chat('long','2026-10-06',120));s.replies=[reply('w',r.ringPracticeAnswer('writing','2026-10-05',unit,'','My own school writing.')),...['one','two','three'].map((x,i)=>reply('v'+i,r.ringPracticeAnswer('vocabulary','2026-10-05',unit,'',word(x))))];const p=progress(s,'course','2026–27');assert.equal(p.target,420);assert.equal(p.writingTarget,14);assert.equal(p.vocabularyTarget,28);assert.equal(p.minutes,30);assert.equal(p.writing,1);assert.equal(p.vocabulary,2);assert.equal(p.closed,0);
 addLink(s,'conversation:long',{unit:unit2});assert.equal(progress(s,'unit',unit).minutes,0);assert.equal(progress(s,'unit',unit2).minutes,120);assert.equal(progress(s,'course','2026–27').minutes,30);
});
test('shared earlier lesson practice can be revisited and uses its original speaking target',()=>{
 const s=source();s.records.push({...chat('lesson-chat'),title:`Lesson practice · ${plan.date} · ${practice.title}`});s.replies=[reply('writing','My own earlier lesson answer.','2026-10-06T09:00:00Z')];let p=progress(s,'lesson',plan.id);assert.equal(p.target,10);assert.equal(p.minutes,15);assert.equal(p.writing,1);
 s.replies.push(reply('v',r.ringPracticeAnswer('vocabulary','2026-10-19',unit,plan.id,word())));p=progress(s,'lesson',plan.id);assert.equal(p.vocabulary,1);
});
test('ambiguous chats remain available for linking without guessing the unit',()=>{
 const s=source();s.records.push({...chat(),title:'My current unit'});assert.equal(progress(s,'unit',unit).minutes,0);assert.equal(progress(s).minutes,15);addLink(s,'conversation:first-chat',{unit});assert.equal(progress(s,'unit',unit).minutes,15);
});
test('future, private, teacher, software-check and unavailable-unit work cannot fill rings',()=>{
 const s=source();s.records.push({...chat('private'),visibility:'teacher'},{...chat('teacher'),author:'Rory'},{...chat('test'),title:'SECTEST check'},chat('future','2026-10-21'));
 s.replies=[reply('v1',r.ringPracticeAnswer('vocabulary','2026-10-05','english-in-context5-unit03-2026','',word())),reply('v2',r.ringPracticeAnswer('vocabulary','2026-10-26',unit,'',word()))];assert.equal(progress(s).minutes,0);assert.equal(progress(s).vocabulary,0);
 s.records.push(chat());addLink(s,'conversation:first-chat',{week:'2026-10-05',unit:'unit05'});assert.equal(progress(s,'unit','unit05').minutes,0);
});
test('malformed receipts, foreign references and incomplete vocabulary never become writing',()=>{
 const s=source();s.replies=[reply('x','Practice rings · Vocabulary\nNot complete enough'),reply('y',r.ringLinkAnswer({item:'conversation:someone-else',week:'2026-10-05',unit,lesson:''})),reply('z','Weekly practice · Vocabulary\nIncomplete')];assert.equal(progress(s).writing,0);assert.equal(progress(s).vocabulary,0);
 assert.throws(()=>r.ringPracticeAnswer('vocabulary','2026-10-05',unit,'',{...word(),sentence:'No'}));assert.throws(()=>r.ringPracticeAnswer('writing','2026-10-05',unit,'','Yes'));
 for(const value of ['2026-02-30','2026-10-20','2026-10-26','not-a-date'])assert.equal(r.validRingWeek(value,today),false);
});
test('only genuine writing analyses backfill documents; exercise worksheets cannot be linked as essays',()=>{
 const s=source();s.documents=[{id:'writing-document-001',created:'2026-10-06T08:00:00Z',uploadedBy:'Student',title:'Family life',context:'',files:[{type:'image/jpeg'}],analysis:{writing:{original:'I wrote this myself.'}}}];assert.equal(progress(s).writing,1);
 s.documents[0].analysis.exerciseAnswers=[{number:1}];assert.equal(progress(s).writing,0);addLink(s,'document:writing-document-001',{week:'2026-10-05',unit});assert.equal(progress(s).writing,0);
 s.documents[0].analysis.exerciseAnswers=[];s.documents[0].uploadedBy='Rory';assert.equal(progress(s).writing,1);s.documents[0].context='[Document role: task]';assert.equal(progress(s).writing,0);s.documents[0].context='';s.documents[0].analysis={};assert.equal(progress(s).writing,0);
});
test('holiday weeks remain paused but optional unit practice counts and short weekly targets remain smaller',()=>{
 const s=source();s.records.push(chat('holiday','2026-10-27',30));let p=r.ringProgress(s,code,{kind:'week',id:'2026-10-26'},'2026-10-28');assert.equal(p.paused,true);assert.equal(p.target,0);assert.equal(p.minutes,0);assert.equal(r.ringProgress(s,code,{kind:'unit',id:unit},'2026-10-28').minutes,30);
 p=r.ringProgress(s,code,{kind:'week',id:'2026-11-02'},'2026-11-03');assert.equal(p.target,24);assert.equal(p.paused,false);assert.equal(p.writingTarget,1);assert.equal(p.vocabularyTarget,2);
});
test('celebration is claimed once per learner and scope on a device, with safe blocked storage',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};assert.equal(r.claimRingCelebration(storage,'ferdi-week-one'),true);assert.equal(r.claimRingCelebration(storage,'ferdi-week-one'),false);assert.equal(r.claimRingCelebration(storage,'valentin-week-one'),true);assert.equal(r.claimRingCelebration(storage,'ferdi-unit-one'),true);assert.equal(r.claimRingCelebration({getItem:()=>{throw Error('blocked')},setItem:()=>{}},'blocked'),false);
});

test('practice receipts display the original learner wording without technical identifiers',()=>{
 const answer=r.ringPracticeAnswer('writing','2026-10-05',unit,'','I has a new idea.');const text=r.ringAnswerText(answer,code);assert.match(text,/I has a new idea\./);assert.match(text,/Family life/);assert.doesNotMatch(text,/english-in-context5/);
 assert.match(r.ringAnswerText(r.ringPracticeAnswer('vocabulary','2026-10-05',unit,'',word()),code),/My sentence: My relative lives nearby/);
 const link=r.ringAnswerText(r.ringLinkAnswer({item:'document:private-source-id',week:'2026-10-05',unit,lesson:''}),code);assert.doesNotMatch(link,/private-source-id/);assert.match(link,/actual submission date/);
});

test('known historical calendar breaks keep catch-up holiday weeks paused',()=>{
 const s=source(),p=r.ringProgress(s,code,{kind:'week',id:'2026-10-05'},today,[{from:'2026-10-05',to:'2026-10-09'}]);assert.equal(p.target,0);assert.equal(p.paused,true);
});

test('new archived-unit conversations retain a readable unit and course title and count in that archive',()=>{
 const s=source();s.records.push({...chat(),title:'Unit practice · 2025–26 · A Fair World'});assert.equal(progress(s,'unit','unit10').minutes,15);assert.equal(progress(s,'course','2026–27').minutes,0);assert.equal(progress(s,'course','2025–26').minutes,15);
});

test('unit writing links open an actual homework route, shared practice or the available lesson list',()=>{
 const units=catalog.practiceCatalog(code);assert.match(catalog.ringWritingPath(code,units.find(u=>u.id==='unit10'),undefined,today),/\/lessons\/unit10\/homework\/\d+\/$/);
 assert.equal(catalog.ringWritingPath(code,units.find(u=>u.id===unit2),undefined,today),`/s/${code}/lessons/`);assert.equal(catalog.ringWritingPath(code,units.find(u=>u.id===unit2),'earlier-shared-plan',today),`/s/${code}/progress/#write-earlier-shared-plan`);
});
