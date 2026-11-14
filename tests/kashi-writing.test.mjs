import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
function load(file,mocks={}){
 const exports={};
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>{assert.ok(name in mocks,`Missing dependency ${name}`);return mocks[name];}});
 return exports;
}
const guided=load('src/lib/guided-speaking.ts');
const voice=load('src/lib/server/voice-session.ts',{'../guided-speaking':guided,'../lesson-practice':{}});
const weeks=JSON.parse(fs.readFileSync('content/kashi/kashi-writing-spelling-start-2026/homework.json','utf8'));
const empty=()=>null;
function homework(week){
 const view=load('src/components/views/HomeworkWeekView.tsx',{
  'react/jsx-runtime':jsxRuntime,'next/link':{default:({href,children,...props})=>React.createElement('a',{href,...props},children)},
  '@/components/StudentContext':{useStudent:()=>({studentId:'kashi',code:'kashi-route'})},
  '@/components/Screen':{default:({title,subtitle,children})=>React.createElement('main',null,title,subtitle,children)},
  '@/components/SubmissionForm':{default:({fields})=>React.createElement('form',null,...fields.map(field=>React.createElement('textarea',{key:field.id,'aria-label':field.id})))},
  '@/components/HomeworkAudioRecorder':{default:()=>React.createElement('div',null,'UNWANTED RECORDING CONTROL')},
  '@/lib/storage':{getTaskValue:()=>''},'@/lib/momentum':{},'@/lib/ics':{parseDueDate:()=>null},
  '@/lib/guided-speaking':guided,'@/lib/clarity':{},'@/lib/homework-release':{},
  '@/lib/lesson-calendar':{},'@/components/Icons':{ClockIcon:empty,MessageIcon:empty,PencilIcon:empty},
  '@/components/LearningVisuals':{MicrophoneIcon:empty},
 }).default;
 return renderToStaticMarkup(React.createElement(view,{unitId:'kashi-writing-spelling-start-2026',week,backHref:'/homework/'}));
}
test('both Kashi sessions put two writing fields before optional speaking, without requiring a recording',()=>{
 for(const week of weeks){
  const html=homework(week);
  assert.match(html,/Writing and spelling/);
  assert.equal((html.match(/<textarea/g)||[]).length,2);
  assert.doesNotMatch(html,/UNWANTED RECORDING CONTROL|aria-label="kashi-start-conversation"|aria-label="kashi-revision-conversation"/);
  assert.ok(html.indexOf('<form>')<html.indexOf('<details'));
  assert.match(html,/Open optional AI chat/);
  assert.match(html,new RegExp(`guided=kashi-chat-${week.week}`));
 }
 assert.match(homework(weeks[0]),/Start writing/);
 assert.match(homework(weeks[1]),/Open my Session 1 writing in another tab/);
 assert.deepEqual(weeks.flatMap(w=>w.tasks.filter(t=>!t.optional).map(t=>t.id)),['kashi-start-writing-original','kashi-start-reflection','kashi-personal-word-log','kashi-first-revision']);
});
test('session topics and return paths are scoped to Kashi, not other learners',()=>{
 for(const week of weeks){
  const chat=guided.guidedSpeakingForHomework('kashi-route','kashi-writing-spelling-start-2026',week.week);
  assert.equal(chat.id,`kashi-chat-${week.week}`);assert.equal(chat.maxSeconds,180);assert.equal(chat.optional,true);
  for(const code of ['ferdi-route','valentin-route','unknown'])assert.equal(guided.guidedSpeaking(code,chat.id),null);
 }
 assert.equal(guided.optionalGuidedSpeaking('kashi-route').length,2);
 assert.equal(guided.optionalGuidedSpeaking('ferdi-route').length,0);
 assert.equal(guided.guidedSpeakingForHomework('kashi-route','another-unit',1),null);
});
test('the live partner and delegated tutor both receive the selected writing-session instructions',()=>{
 for(const week of weeks){
  const chat=guided.guidedSpeaking('kashi-route',`kashi-chat-${week.week}`);
  const request={code:'kashi-route',sdp:'v=0\r\n',topic:'story',homeworkFocus:chat.id};
  const config=voice.voiceConfiguration(request).session;
  assert.ok(config.instructions.includes(chat.instructions));
  assert.ok(config.delegation.responses.instructions.includes(chat.instructions));
  assert.match(chat.instructions,/one short question|one short question at a time/);
  assert.match(chat.instructions,/Do not (?:assess spelling|infer misspellings)/);
  assert.doesNotMatch(voice.voiceConfiguration({...request,code:'ferdi-route'}).session.instructions,/Kashi's optional/);
  assert.doesNotMatch(voice.voiceConfiguration({...request,topic:'everyday'}).session.instructions,/Kashi's optional/);
 }
});
