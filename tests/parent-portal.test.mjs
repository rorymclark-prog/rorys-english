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
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,process:{env:{}},Intl,Date,Set,Map,URL,Blob,Uint8Array,console,setTimeout,clearTimeout,require:name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;let resolved=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);if(!path.extname(resolved))resolved+=fs.existsSync(resolved+'.tsx')?'.tsx':'.ts';return load(resolved);}});return exports;}
const language=load('src/lib/parent-language.ts'),feedback=load('src/lib/parent-feedback.ts');
const Provider=load('src/components/ParentLanguage.tsx').default,Dashboard=load('src/components/views/ParentDashboardView.tsx').default,SignIn=load('src/components/ParentSignIn.tsx').default,ParentFeedback=load('src/components/ParentFeedback.tsx');
const german=element=>renderToStaticMarkup(React.createElement(Provider,null,element));
const record=(id,body={},visibility='shared')=>({id,body,visibility,kind:'lesson',title:'Practice recap',author:'Student',created:'2026-10-31T12:00:00Z',date:'2026-10-30'});
test('first parent visit and sign-in render in German with a visible English switch',()=>{const html=german(React.createElement(SignIn,{code:'ferdi-fam-3p9k'}));assert.match(html,/lang="de"/);assert.match(html,/Eltern-Zugangscode/);assert.match(html,/Auf diesem Gerät angemeldet bleiben/);assert.match(html,/>Anmelden</);assert.match(html,/>English</);assert.doesNotMatch(html,/Email address|Set or reset password/);assert.equal(language.parentLanguage(null),'de');assert.equal(language.parentLanguage('en'),'en');assert.equal(language.parentLanguage('unexpected'),'de');});
test('parent overview always shows eight honest rings and neutral feedback navigation',()=>{const html=german(React.createElement(Dashboard,{code:'ferdi-fam-3p9k',name:'Ferdi'}));assert.match(html,/Ferdis Lernübersicht/);assert.equal((html.match(/class="progress-ring unassessed"/g)||[]).length,8);assert.match(html,/Noch nicht erfasst/);assert.doesNotMatch(html.replace(/<[^>]+>/g,''),/0%|Rory’s feedback|Rory will|awaits|review pending|not yet approved/);assert.match(html,/Kalender/);});
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
