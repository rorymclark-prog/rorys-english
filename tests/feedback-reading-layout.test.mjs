import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import React from 'react';import * as jsx from 'react/jsx-runtime';import {renderToStaticMarkup} from 'react-dom/server';
const load=(file,deps={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>deps[n]||(()=>{throw Error(n)})()});return exports;};
const assessment=load('src/lib/lesson-assessment.ts'),panel=load('src/components/LessonAssessmentPanel.tsx',{'react':React,'react/jsx-runtime':jsx,'@/lib/lesson-assessment':assessment,'@/lib/clarity':{readableDate:d=>d},'@/lib/learning':{},'@/components/LessonProgressSummary':{SupportChart:()=>React.createElement('div',null,'support chart')}});
test('evidence and recording method are closed initially while unscored work has no empty score bar',()=>{
 const record=JSON.parse(fs.readFileSync('tests/fixtures/dashboard-lesson.json','utf8'))[0];
 record.body.tutorPrivate.lessonAssessment.checks.forEach(c=>c.score=null);
 const html=renderToStaticMarkup(React.createElement(panel.default,{record,records:[record],code:'fixture',onSaved:()=>{}}));
 assert.match(html,/^<details[^>]*lesson-assessment-details[^>]*><summary/);assert.doesNotMatch(html.slice(0,html.indexOf('>')+1),/\sopen/);
 assert.match(html,/<summary[^>]*>Recording scope and method<\/summary>/);assert.match(html,/Not scored/);assert.doesNotMatch(html,/class="h-2 flex-1/);
 assert.match(html,/Approve and share this summary/,'actual formal approval stays explicit');
});
