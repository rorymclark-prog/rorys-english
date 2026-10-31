import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return {default:JSON.parse(fs.readFileSync(file,'utf8'))};const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,process:{env:{}},Intl,Date,Set,Map,URL,Blob,Uint8Array,console,setTimeout,clearTimeout,require:name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;let resolved=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);if(!path.extname(resolved))resolved+=fs.existsSync(resolved+'.tsx')?'.tsx':'.ts';return load(resolved);}});return exports;}
const language=load('src/lib/parent-language.ts'),feedback=load('src/lib/parent-feedback.ts');
const Provider=load('src/components/ParentLanguage.tsx').default,Dashboard=load('src/components/views/ParentDashboardView.tsx').default,SignIn=load('src/components/ParentSignIn.tsx').default,ParentFeedback=load('src/components/ParentFeedback.tsx');
const german=element=>renderToStaticMarkup(React.createElement(Provider,null,element));
const record=(id,body={},visibility='shared')=>({id,body,visibility,kind:'lesson',title:'Practice recap',author:'Student',created:'2026-10-31T12:00:00Z',date:'2026-10-30'});
test('first parent visit and sign-in render in German with a visible English switch',()=>{const html=german(React.createElement(SignIn,{code:'ferdi-fam-3p9k'}));assert.match(html,/lang="de"/);assert.match(html,/Eltern-Zugangscode/);assert.match(html,/Auf diesem Gerät angemeldet bleiben/);assert.match(html,/>Anmelden</);assert.match(html,/>English</);assert.doesNotMatch(html,/Email address|Set or reset password/);assert.equal(language.parentLanguage(null),'de');assert.equal(language.parentLanguage('en'),'en');assert.equal(language.parentLanguage('unexpected'),'de');});
test('parent overview waits for real task data instead of rendering eight blank rings',()=>{const html=german(React.createElement(Dashboard,{code:'ferdi-fam-3p9k',name:'Ferdi'}));assert.match(html,/Ferdis Lernübersicht/);assert.doesNotMatch(html,/class="progress-ring unassessed"/);assert.match(html,/Aufgabenergebnisse werden geladen/);assert.match(html,/Kursübungen/);assert.doesNotMatch(html.replace(/<[^>]+>/g,''),/Rory’s feedback|review pending|not yet approved/);assert.match(html,/Kalender/);});
test('rings use only shared marked task snapshots, retain zero scores and exclude private checks',()=>{
 const snapshot={version:1,unitId:'unit-a',unitTitle:'Unit A',protocol:'five independent grammar forms',help:'independent',stage:'checkpoint',vocabularySource:'',words:[],nextCheck:'Try new forms.',results:[{domain:'grammar',criterion:'Correct target forms',earned:3,possible:5,evidenceType:'written'},{domain:'reading',criterion:'Correct comprehension answers',earned:0,possible:5,evidenceType:'written'}]};
 const shared={...record('shared',{skillSnapshot:snapshot,source:'skill-progress-summary:source-a'}),author:'Rory'};
 const privateRecord=record('private',{tutorPrivate:{skillCheck:{...snapshot,results:[{domain:'grammar',criterion:'Correct target forms',earned:5,possible:5,evidence:'Private marked paper',evidenceType:'written'}]}}},'teacher');
 const rings=feedback.familySkillRings([shared,privateRecord]);assert.equal(rings.find(r=>r.domain==='grammar').result.earned,3);assert.equal(rings.find(r=>r.domain==='reading').result.earned,0);assert.equal(rings.find(r=>r.domain==='pronunciation').result,null);assert.equal(rings.length,8);assert.deepEqual(Array.from(feedback.familyRecords([shared,privateRecord,record('public')]),r=>r.id),['public']);
});
test('family feedback includes saved automated and optional teacher feedback without missing-review prompts',()=>{
 const r=record('mixed',{plainReview:{summary:'A useful teacher suggestion.'},plainAiFeedback:{summary:'A clear automated practice summary.',targets:['Use past forms.']},aiAnalysis:'Duplicated AI summary'});const before=JSON.stringify(r);
 const html=german(React.createElement(ParentFeedback.ParentRecordCard,{record:r,code:'parent-a'}));assert.match(html,/A useful teacher suggestion/);assert.match(html,/A clear automated practice summary/);assert.match(html,/Was als Nächstes geübt wird/);assert.doesNotMatch(html,/Duplicated AI summary|Rory’s feedback|awaits|review pending|has not reviewed/);assert.equal(JSON.stringify(r),before);
 const onlyAutomated=record('automated',{plainAiFeedback:{summary:'This first attempt is clear.'}});const onlyHtml=german(React.createElement(ParentFeedback.ParentRecordCard,{record:onlyAutomated,code:'parent-a'}));assert.match(onlyHtml.replace(/<[^>]+>/g,''),/This first attempt is clear/);assert.doesNotMatch(onlyHtml,/Rory’s feedback|Rory has|pending|await|not yet/);
});
test('uploaded work displays the complete saved analysis and optional released follow-up, keeping original text intact',()=>{
 const doc={id:'synthetic-document-0001',title:'Saved writing',created:'2026-10-30',files:[],feedback:'A specific teacher follow-up.',reviewPending:false,analysis:{summary:'Saved practice feedback.',strengths:['A clear opening.'],retry:'Try another ending.',corrections:[],transcription:'Rory has not reviewed: original learner words.',writing:{original:'Rory has not reviewed: original learner words.',corrected:'A complete corrected sentence.',comparisons:[]}}};
 const html=german(React.createElement(ParentFeedback.ParentDocumentFeedback,{document:doc,code:'parent-a'}));assert.match(html,/Saved practice feedback/);assert.match(html,/A specific teacher follow-up/);assert.match(html,/Rory has not reviewed: original learner words/);assert.match(html,/Korrigierte Fassung/);
 const held=german(React.createElement(ParentFeedback.ParentDocumentFeedback,{document:{...doc,reviewPending:true},code:'parent-a'}));assert.doesNotMatch(held,/A specific teacher follow-up/);assert.match(held,/Saved practice feedback/);
 assert.equal(feedback.familyFeedbackText('Good work. Rory has not reviewed this. Try again.'),'Good work.  Try again.');
});

test('parent writing option uses the student sentence table and full colour versions with every saved check',()=>{
 const checks={spelling:'ok',grammar:'Use the past simple.',wordChoice:'ok',punctuation:'ok',flow:'The time reference is clear.',taskFit:'The printed task was not supplied.'};
 const writing={original:'Yesterday I go home. I enjoy music.',corrected:'Yesterday I went home. I enjoy music.',model:'Yesterday I returned home. Music is one of my interests.',targetLevel:'B1',modelNotes:['A more varied opening.'],comparisons:[{original:'Yesterday I go home.',corrected:'Yesterday I went home.',improved:'Yesterday I returned home.',note:'Use a completed past form. Rory has not reviewed this.',checks},{original:'I enjoy music.',corrected:'I enjoy music.',improved:'Music is one of my interests.',note:'A clear sentence.',checks}],practice:['Describe a different journey.']};
 const before=JSON.stringify(writing),html=german(React.createElement(ParentFeedback.ParentWriting,{writing})),text=html.replace(/<[^>]+>/g,'');
 assert.match(html,/<details class="parent-full-corrections"><summary>/);assert.doesNotMatch(html,/<details class="parent-full-corrections" open/);
 assert.match(text,/Vollständige Schreibkorrektur anzeigen/);assert.match(html,/class="sentence-feedback-table"/);assert.match(html,/writing-versions/);
 for(const label of ['Rechtschreibung','Grammatik','Wortwahl','Zeichensetzung','Verknüpfung / Lesefluss','Erfüllung der Aufgabe'])assert.ok(text.includes(label));
 for(const colour of ['sentence-red','sentence-green','sentence-blue'])assert.ok(html.includes(colour));
 for(const value of ['Yesterday I go home.','Yesterday I went home.','Yesterday I returned home.','Music is one of my interests.','A more varied opening.','Describe a different journey.'])assert.ok(text.includes(value));
 assert.match(text,/B1/);assert.match(html,/Änderung erklären:/);assert.doesNotMatch(html,/<textarea|<input|Save|has not reviewed/);assert.equal(JSON.stringify(writing),before);
 const english=renderToStaticMarkup(React.createElement(ParentFeedback.ParentWriting,{writing}));assert.match(english,/Show full writing corrections/);assert.match(english,/Sentence by sentence/);assert.match(english,/Checks &amp; explanation/);
});
test('parent worksheet option shows the same task, original answer, correction and explanation without editing controls',()=>{
 const document={id:'synthetic-worksheet-0001',title:'Worksheet',created:'2026-10-30',files:[],feedback:'',analysis:{summary:'Saved worksheet feedback.',strengths:[],retry:'Try a new sentence.',corrections:[],transcription:'We was late.',coverage:'complete',uncertainties:[],answerReview:[{label:'1',prompt:'We ___ late.',response:'was',status:'needs-change',correction:'were',note:'We takes were.'},{label:'2',prompt:'Unclear scan',response:'[unclear]',status:'uncertain',correction:'',note:'Compare the original page.'}]}};
 const html=german(React.createElement(ParentFeedback.ParentDocumentFeedback,{document,code:'parent-a'}));
 assert.match(html,/Vollständige Arbeitsblattkorrekturen anzeigen/);assert.match(html,/doc-worksheet-answers/);assert.match(html,/URSPRÜNGLICHE ANTWORT/);assert.match(html,/KORREKTUR/);assert.match(html,/We takes were/);assert.match(html,/Lesart muss bestätigt werden/);assert.doesNotMatch(html,/<textarea|<input|Check my answer/);
});

test('parent practice details show saved attempts and their feedback without answers for unattempted exercises',()=>{
 const id='synthetic-practice-document',version='feedback-v1',attempt=(key,answer,created,extra={})=>({id:key,documentId:id,version,exerciseId:'past',answer,created,result:{status:answer==='went'?'correct':'try-again',example:'went',explanation:'Use the past simple.'},...extra});
 const document={id,title:'Practice writing',created:'2026-10-30',files:[],feedback:'',practiceVersion:version,practiceAttempts:[attempt('later','went','2026-10-31T12:00:00Z'),attempt('earlier','go','2026-10-30T12:00:00Z'),attempt('foreign','WRONG DOCUMENT','2026-10-31T13:00:00Z',{documentId:'other-document'}),attempt('outdated','OLD FEEDBACK','2026-10-31T13:00:00Z',{version:'v0'})],analysis:{summary:'Saved feedback.',strengths:[],retry:'Try another event.',corrections:[],transcription:'',coverage:'complete',uncertainties:[],exercises:[{id:'past',type:'choice',focus:'Past forms',prompt:'Yesterday I ___ home.',options:['go','went'],example:'PRIVATE ANSWER GUIDANCE',explanation:'PRIVATE GUIDE'},{id:'new',type:'write',focus:'A new example',prompt:'Describe another event.',options:[],example:'UNATTEMPTED MODEL',explanation:'UNATTEMPTED GUIDE'}]}};
 const before=JSON.stringify(document),html=german(React.createElement(ParentFeedback.ParentDocumentFeedback,{document,code:'parent-a'})),text=html.replace(/<[^>]+>/g,'');
 assert.match(text,/Übungen und gespeicherte Versuche anzeigen/);assert.match(text,/Gespeicherte Antwort: went/);assert.match(text,/2 gespeicherte Versuche/);assert.match(text,/Use the past simple/);assert.match(text,/30\. Okt\. 2026/);assert.match(text,/31\. Okt\. 2026/);assert.match(text,/Describe another event/);assert.doesNotMatch(html,/PRIVATE ANSWER|PRIVATE GUIDE|UNATTEMPTED MODEL|UNATTEMPTED GUIDE|WRONG DOCUMENT|OLD FEEDBACK|<input|<select|<textarea|Check my answer|Save this try/);assert.equal(JSON.stringify(document),before);
});
test('practice attempt history stays bound to its original, exercise and feedback version without mutating inputs',()=>{
 const {practiceHistory}=load('src/lib/practice-history.ts');const attempt=(id,documentId,version,exerciseId,created)=>({id,documentId,version,exerciseId,created,answer:id,result:{status:'compare',example:'Example',explanation:'Compare.'}});
 const attempts=[attempt('later','reply:reply-a','v1','task-a','2026-10-31'),attempt('document','reply-a','v1','task-a','2026-10-31'),attempt('different','reply:reply-a','v1','task-b','2026-10-31'),attempt('earlier','reply:reply-a','v1','task-a','2026-10-30'),attempt('stale','reply:reply-a','v0','task-a','2026-10-31')],before=JSON.stringify(attempts);
 assert.deepEqual(Array.from(practiceHistory(attempts,'reply-a','reply','v1','task-a'),value=>value.id),['earlier','later']);assert.deepEqual(Array.from(practiceHistory(attempts,'reply-a','document','v1','task-a'),value=>value.id),['document']);assert.equal(JSON.stringify(attempts),before);
});

test('parent course rings use the student engine, explain remaining work and keep future units separate',()=>{
 const Course=load('src/components/ParentCourseProgress.tsx').ParentCourseProgress;
 const source={records:[{...record('chat',{transcript:'[0s] You: Hello\n[1800s] AI partner: Bye',submittedAt:'2026-10-20T12:00:00Z'}),kind:'speaking',title:'Family life practice',date:'2026-10-20'}],documents:[],submissions:[{id:'written',unit:'english-in-context5-unit01-2026',task:'hw:1',title:'Writing attempt',submitted:'2026-10-20',answers:{answer:'My own original paragraph.'}}],replies:[],progress:null};
 const before=JSON.stringify(source),html=german(React.createElement(Course,{source,code:'ferdi-fam-3p9k',today:'2026-10-31'}));
 assert.match(html,/30 \/ 420 Min/);assert.match(html,/1 \/ 14 Texte/);assert.match(html,/Noch 390 Min/);assert.match(html,/Für später geplant/);assert.match(html,/kein Gesamt|keinen Gesamt|weder den gesamten Lehrplan/);assert.doesNotMatch(html,/<input|<textarea|<select|Save my|Anmelden/);assert.equal(JSON.stringify(source),before);
});
test('explicit publication keeps only latest valid domain marks and excludes private evidence and workflow notes',()=>{
 const publish=load('src/lib/family-progress-publication.ts').familyProgressPublication;
 const check={version:1,unitId:'sample',unitTitle:'A named task',protocol:'Actual written sample. Help unknown; not a matched comparison.',help:'unknown',stage:'checkpoint',vocabularySource:'',words:[],nextCheck:'Private verification pending',results:[{domain:'writing',criterion:'Clarity on this text',earned:3,possible:4,evidenceType:'written',evidence:'PRIVATE ORIGINAL QUOTE'}]};
 const old={...record('old',{tutorPrivate:{skillCheck:check}},'teacher'),date:'2026-10-01',author:'AI draft'};
 const latest={...old,id:'latest',date:'2026-10-20',body:{tutorPrivate:{skillCheck:{...check,results:[...check.results,{domain:'grammar',criterion:'Grammar on this text',earned:2,possible:4,evidenceType:'written',evidence:'PRIVATE GRAMMAR QUOTE'}]}}}};
 const source=[old,latest,{...latest,id:'future',date:'2026-11-01'},{...latest,id:'held',date:'2026-10-30',reviewPending:true}];const before=JSON.stringify(source),out=publish(source,'2026-10-31');
 assert.equal(out.length,1);assert.equal(out[0].id,'latest-progress-summary');assert.equal(out[0].body.skillSnapshot.results.length,2);assert.equal(out[0].body.skillSnapshot.help,'unknown');assert.doesNotMatch(JSON.stringify(out),/PRIVATE|verification pending|tutorPrivate|sourceRef/);assert.equal(JSON.stringify(source),before);
});
