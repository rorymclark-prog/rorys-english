import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

function load(file,mocks={},globals={}){
  const exports={};
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>{assert.ok(name in mocks,`Missing test dependency: ${name}`);return mocks[name];},...globals});
  return exports;
}
const clarity=load('src/lib/clarity.ts'),speaking=load('src/lib/speaking-homework.ts');
const empty=()=>null;
const link={default:({href,children,...props})=>React.createElement('a',{...props,href},children)};
const week=(number)=>({week:number,title:`Task ${number}`,tasks:[{type:'written'}]});
const unit={id:'unit',homework:[week(1),week(2)]};
const assignment=(id,status='open',date='2026-10-01')=>({id,title:id,date,status,details:'Write an answer.',due:''});
const submission=(task,status='submitted',extra={})=>({id:task,unit:'unit',task,submitted:'2026-10-22T12:00:00Z',status,feedback:'',answers:{},...extra});
function today({assignments=[],submissions=[],error='',loaded=true,lesson=unit,code='student'}={}){
  const states=['',assignments,error,loaded,submissions];let state=0;
  const view=load('src/components/views/TodayView.tsx',{
    react:{...React,useState:()=>[states[state++],()=>{}],useEffect:()=>{}},'react/jsx-runtime':jsxRuntime,'next/link':link,
    '@/components/StudentContext':{useStudent:()=>({code,studentId:code,displayName:'Student'})},
    '@/lib/remote':{isCurrentAssignment:a=>/^2026-(09|10|11|12)-|^2027-(01|02|03|04|05|06|07|08)-/.test(a.date)},
    '@/lib/clarity':clarity,'@/lib/speaking-homework':speaking,'@/lib/student-preview':{isStudentPreview:()=>true},
    '@/components/Icons':{ChevronRightIcon:empty,MessageIcon:empty},'@/components/LearningVisuals':{MicrophoneIcon:empty},
    '@/components/LessonPractice':{LatestLessonPractice:empty},
    ...Object.fromEntries(['NextLesson','YearPlanNotice','EngagementPanel','StatusRow','MomentumStrip'].map(name=>[`@/components/${name}`,{default:empty}])),
  }).default;
  const html=renderToStaticMarkup(React.createElement(view,{unit:lesson}));
  return html.match(/<section class="today-hero".*?<\/section>/s)[0];
}

test('Today recommends the untouched task after reviewed work, including a received teacher assignment',()=>{
  const hero=today({assignments:[assignment('Assigned answer')],submissions:[submission('hw:1','reviewed',{feedback:'Good work'}),submission('Assigned answer','submitted',{unit:'assigned'})]});
  assert.match(hero,/<h2[^>]*>Task 2<\/h2>/);
  assert.match(hero,/href="\/s\/student\/lessons\/unit\/homework\/2\/">Start<\/a>/);
  assert.doesNotMatch(hero,/more task/);
});

test('Today treats the latest revision request as actionable, including an assignment marked complete earlier',()=>{
  const hero=today({submissions:[submission('hw:1','reviewed',{feedback:'Done'}),submission('hw:2','submitted',{submitted:'2026-10-20'}),submission('hw:2','revision-needed')]});
  assert.match(hero,/<h2[^>]*>Task 2<\/h2>/);assert.match(hero,/Revision requested/);assert.match(hero,/>Revise<\/a>/);
  const assigned=today({assignments:[assignment('Revise my answer','reviewed')],submissions:[submission('Revise my answer','revision-needed',{unit:'assigned'})]});
  assert.match(assigned,/<h2[^>]*>Revise my answer<\/h2>/);assert.match(assigned,/>Revise<\/a>/);
});

test('Today offers feedback or a receipt when every unit task has been received, without restarting it',()=>{
  const reviewed=today({submissions:[submission('hw:1','reviewed',{feedback:'Good work'}),submission('hw:2')]});
  assert.match(reviewed,/Feedback from Rory ready/);assert.match(reviewed,/>View feedback<\/a>/);assert.doesNotMatch(reviewed,/>Start<|more task/);
  const waiting=today({submissions:[submission('hw:1','revision-needed',{submitted:'2026-10-20'}),submission('hw:1'),submission('hw:2','reviewed',{feedback:'Held feedback',reviewPending:true})]});
  assert.match(waiting,/Received by Rory · waiting for review/);assert.match(waiting,/>View saved work<\/a>/);assert.doesNotMatch(waiting,/>Start<|>Revise<|>View feedback</);
});

test('Today never claims no homework after a failed check or recommends stale cached tasks',()=>{
  for(const lesson of [null,unit]){
    const hero=today({error:'Could not load your latest update.',lesson});
    assert.match(hero,/Latest update unavailable/);assert.match(hero,/>Open homework<\/a>/);
    assert.doesNotMatch(hero,/Nothing new|No new homework|>Start<|>Speak</);
  }
  const loading=today({loaded:false});
  assert.match(loading,/aria-busy="true"/);assert.match(loading,/Checking with Rory/);assert.doesNotMatch(loading,/<a|No new homework/);
});

test('Today preserves current-year, replaced-homework and optional earlier-practice boundaries',()=>{
  const old=assignment('Previous year','open','2025-10-01'),archived=assignment('Replaced','archived'),reset=assignment('homework-reset-current');
  const hero=today({assignments:[old,archived,reset]});
  assert.match(hero,/<h2[^>]*>homework-reset-current<\/h2>/);assert.doesNotMatch(hero,/Previous year|Replaced|Task 1|more task/);
  const completed=today({assignments:[old,archived,{...reset,status:'complete'}]});
  assert.match(completed,/No new homework right now/);assert.doesNotMatch(completed,/Task 1|>Start</);
  const upcoming=today({lesson:{id:'unit',homework:[{...week(1),availableFrom:'2099-01-01'}]}});
  assert.match(upcoming,/No new homework right now/);
});

test('Today preserves the combined speaking assignment instead of resurfacing its replaced unit tasks',()=>{
  const combined={...assignment('Combined practice'),details:'Chat 1: Tell a story. Chat 2: Compare your ideas.'};
  const hero=today({code:'ferdi-7h3k',assignments:[combined]});
  assert.match(hero,/Family life · Speaking and writing practice/);assert.doesNotMatch(hero,/more task|Task 1/);
});

function findShareButton(element){
  if(!React.isValidElement(element))return null;
  if(element.type==='button'&&element.props.children==='Send my progress to Rory')return element;
  for(const child of React.Children.toArray(element.props.children)){const found=findShareButton(child);if(found)return found;}
  return null;
}
test('progress sharing is disabled and guarded in teacher preview, while normal sharing still works',async()=>{
  for(const preview of [true,false]){
    const shared=[];let summaries=0;
    const view=load('src/components/views/ProgressView.tsx',{
      react:{...React,useState:value=>[value,()=>{}],useEffect:()=>{}},'react/jsx-runtime':jsxRuntime,'next/link':link,
      '@/lib/remote':{},'@/components/Icons':{},'@/lib/storage':{buildProgressSummary:()=>{summaries++;return 'My progress';}},
      '@/lib/student-preview':{isStudentPreview:()=>preview},'@/components/SkillProgressPanel':{SharedSkillProgress:empty},
      './LearningView':{default:empty},'./DocumentsView':{default:empty},
    },{navigator:{share:async data=>{shared.push(data);}}}).default;
    const button=findShareButton(view({fetchCode:'student',studentCode:'student',studentId:'student',displayName:'Student',mode:'student'}));
    assert.ok(button);assert.equal(button.props.disabled,preview);
    button.props.onClick();await Promise.resolve();
    assert.equal(shared.length,preview?0:1);assert.equal(summaries,preview?0:1);
  }
});
