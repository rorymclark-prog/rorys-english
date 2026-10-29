import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const localRequire=name=>{
  if(name==='@/lib/documents')return {documentRequest:()=>{throw new Error('Rendering cannot save practice.');}};
  if(name==='@/lib/student-preview')return {isStudentPreview:()=>false};
  if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
  const base=name.startsWith('@/')?'src/'+name.slice(2):path.join(path.dirname(file),name);
  return load([base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p)));
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:localRequire,Intl,Uint16Array,process});return exports;
}
const SentenceCards=load('src/components/SentenceComparison.tsx').SentenceCards,SentenceComparison=load('src/components/SentenceComparison.tsx').default,Practice=load('src/components/DocumentPractice.tsx').default;
const checks={spelling:'ok',grammar:'ok',wordChoice:'ok',punctuation:'ok',flow:'ok',taskFit:'The printed task was not supplied, so it cannot be checked.'};
const renderWriting=writing=>renderToStaticMarkup(React.createElement(SentenceComparison,{writing}));
test('an unchanged reading with uncertainty stays open and is counted even with a retained correction',()=>{
 const original='I wanted to say sorry for the bulling. I hape you are not mad at me.';
 const html=renderWriting({original,corrected:original,model:'I wanted to say sorry for bullying you. I hope you are not angry with me.',comparisons:[{original:'I wanted to say sorry for the bulling.',corrected:'I wanted to say sorry for the bulling.',improved:'',note:"Please confirm the reading of 'bulling' before judging its spelling.",checks:{...checks,spelling:'Reading needs confirmation; no spelling error is marked.'}},{original:'I hape you are not mad at me.',corrected:'',improved:'',note:"Please confirm whether the handwritten word reads 'hope' or 'hape'.",checks}]});
 assert.match(html,/2 sentences need.*reading confirmation/);assert.doesNotMatch(html,/writing-checked/);assert.match(html,/not a confirmed reading of your work/);assert.match(html,/does not confirm their spelling/);
});
test('missing corrections are distinguished from handwriting uncertainty',()=>{
 const html=renderWriting({original:'I enjoy music.',comparisons:[{original:'I enjoy music.',corrected:'',improved:'',note:'Check the intended meaning here.'}]});
 assert.match(html,/1 sentence has.*no complete correction saved/);assert.doesNotMatch(html,/needs.*reading confirmation/);assert.match(html,/No complete correction saved/);
});
test('unchanged sentences do not claim unavailable task requirements were checked',()=>{
 const html=renderWriting({original:'I enjoy music.',comparisons:[{original:'I enjoy music.',corrected:'I enjoy music.',improved:'',note:'Correct.',checks}]});
 assert.match(html,/No language change suggested/);assert.match(html,/printed task was not supplied/);assert.doesNotMatch(html,/Checked:.*task fit/);assert.match(html,/No issue found/);
});
const exercises=[{id:'sample-choice-pattern',type:'choice',prompt:'We met ___ a concert.',focus:'Events',options:['on','at','in'],example:'at',explanation:'Use at for events.'}];
test('read-only teacher and parent views show choices without permitting a saved attempt',()=>{
 for(const role of [{teacher:true},{parent:true}]){
  const html=renderToStaticMarkup(React.createElement(Practice,{code:'sample',documentId:'sample-document',version:'v1',exercises,attempts:[],...role}));
  assert.match(html,/Answer choices for exercise 1/);for(const option of exercises[0].options)assert.ok(html.includes('<li>'+option+'</li>'));
  assert.doesNotMatch(html,/<select|Check my answer/);if(role.parent)assert.doesNotMatch(html,/Answer guidance/);
 }
});
test('student practice still offers choices and keeps guidance hidden before a saved attempt',()=>{
 const html=renderToStaticMarkup(React.createElement(Practice,{code:'sample',documentId:'sample-document',version:'v1',exercises,attempts:[]}));
 assert.match(html,/<select/);assert.match(html,/Check my answer/);assert.doesNotMatch(html,/One possible answer|Answer guidance|Use at for events/);assert.match(html,/other correct answers/);
});


test('phone sentence cards retain every sentence and all six checks without a duplicate comparison table',()=>{
 const writing={original:'Yesterday I go home. I enjoy music.',comparisons:[{original:'Yesterday I go home.',corrected:'Yesterday I went home.',improved:'Yesterday I returned home.',note:'Use the past simple.',checks},{original:'I enjoy music.',corrected:'I enjoy music.',improved:'',note:'A clear sentence.',checks}]};
 const rows=load('src/lib/writing-review.ts').sentenceReview(writing).rows;
 const html=renderToStaticMarkup(React.createElement(SentenceCards,{rows}));
 assert.equal((html.match(/class="sentence-reading-card"/g)||[]).length,2);
 for(const label of ['Spelling','Grammar','Word choice','Punctuation','Linking / flow','Fit to the task'])assert.equal((html.match(new RegExp('<dt>'+label+'</dt>','g'))||[]).length,2);
 assert.match(html,/Original · red/);assert.match(html,/Corrected · green/);assert.match(html,/Another way · blue · optional/);
 assert.match(html,/No language change suggested/);assert.match(html,/printed task was not supplied/);assert.doesNotMatch(html,/<table/);
});
test('phone cards preserve source notes and uncertainty without red or green error marking',()=>{
 const rows=load('src/lib/writing-review.ts').sentenceReview({original:'[Crossed-out wording unclear.] I hape you are well.',comparisons:[{original:'I hape you are well.',corrected:'I hope you are well.',improved:'',note:'Please confirm the reading of the handwritten word.',checks}]}).rows;
 const html=renderToStaticMarkup(React.createElement(SentenceCards,{rows}));
 assert.match(html,/Crossed-out wording unclear/);assert.match(html,/Reading needs confirmation/);assert.match(html,/Saved wording; the reading is still unconfirmed/);
 assert.doesNotMatch(html,/class="sentence-red"|class="sentence-green"|No language change suggested/);
});
