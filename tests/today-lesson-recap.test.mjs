import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

const helper={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/today-task.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:helper,URLSearchParams});
const practice={title:'Friendships · current homework · 17 October reset',lessonDate:'2026-10-17',recap:'The full teacher-prepared recap is retained here.',focus:['Give one clear reason.','Use a fresh example.'],speakingMinutes:6,writingMinutes:5,speakingPrompt:'Describe an invented plan that changed.',writingPrompt:'Write your own ending in five sentences.',successCriteria:['A clear sequence.','One reason in your own words.']};
const record={id:'exact-practice',body:{source:'current-homework-reset-source-synthetic'}};
function components(){
  let state=0;const states=[{record,practice},false,0],exports={};
  const mocks={react:{...React,useState:initial=>[states[state++]??initial,()=>{}],useEffect:()=>{}},'react/jsx-runtime':jsxRuntime,'next/link':{default:({href,children,...props})=>React.createElement('a',{...props,href},children)},'@/components/StatusRow':{default:()=>null},'@/lib/clarity':{readableDate:()=> 'Sat, 17 Oct 2026'},'@/lib/learning':{},'@/lib/lesson-practice':{},'@/lib/today-task':helper};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/LessonPractice.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});
  return exports;
}

test('Today shows a compact focus with an exact route to the unchanged full task',()=>{
  const {LatestLessonPractice}=components(),html=renderToStaticMarkup(React.createElement(LatestLessonPractice,{code:'student',compact:true}));
  assert.match(html,/Friendships<\/h2>/);assert.match(html,/Give one clear reason\./);assert.match(html,/href="\/s\/student\/progress\/#review-exact-practice"/);
  assert.doesNotMatch(html,/full teacher-prepared recap|17 October reset|Practise with AI/);
  assert.equal(practice.recap,'The full teacher-prepared recap is retained here.');
});

test('the lesson task still includes all original speaking, writing and checklist instructions',()=>{
  const {LessonPracticeDetails}=components(),html=renderToStaticMarkup(React.createElement(LessonPracticeDetails,{code:'student',record,practice,mode:'student'}));
  for(const text of [practice.recap,...practice.focus,practice.speakingPrompt,practice.writingPrompt,...practice.successCriteria])assert.ok(html.includes(text),text);
  assert.match(html,/practice=exact-practice/);assert.match(html,/There is no new deadline/);
});
