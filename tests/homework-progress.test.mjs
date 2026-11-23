import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
// Keep engine scenarios on their original dates as live homework is carried forward.
// Content and required field IDs come from the maintained tasks; only test dates are fixed.
const homeworkFixtures=new Map(['kashi-writing-spelling-start-2026','kashi-multiplication-start-2026'].map(unit=>{
 const file=path.resolve(`content/kashi/${unit}/homework.json`),data=JSON.parse(fs.readFileSync(file,'utf8'));
 return [file,{default:data.map(week=>({...week,assignmentWeek:'2026-11-16'}))}];
}));
function loader(overrides={}){
 const cache=new Map();
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return homeworkFixtures.get(file)||{default:JSON.parse(fs.readFileSync(file,'utf8'))};const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,process:{env:{}},Intl,Date,Set,Map,URL,Blob,Uint8Array,console,setTimeout,clearTimeout,window:{addEventListener(){},removeEventListener(){}},require:name=>{if(name in overrides)return overrides[name];if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;if(name==='next/link')return {default:({children,href,...props})=>React.createElement('a',{...props,href},children)};let resolved=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);if(!path.extname(resolved))resolved+=fs.existsSync(resolved+'.tsx')?'.tsx':'.ts';return load(resolved);}});return exports;}return load;
}
const load=loader(),{homeworkProgress,usesHomeworkProgress}=load('src/lib/homework-progress.ts');
const code='kashi-test',today='2026-11-17',english='kashi-writing-spelling-start-2026',maths='kashi-multiplication-start-2026';
const saved=(id,unit,week,answers,extra={})=>({id,unit,task:`hw:${week}`,submitted:'2026-11-17T10:00:00Z',answers,status:'submitted',feedback:'',reviewed:'',...extra});
const writing=saved('writing',english,1,{'kashi-start-writing-original':'My own first paragraph.'});
const spelling=saved('spelling',english,2,{'kashi-personal-word-log':'My words and sentences.','kashi-first-revision':'My revised paragraph.'});
const multiplication=saved('maths',maths,1,Object.fromEntries([1,2,3,4,5].map(n=>[`kashi-multiplication-check-${n}`,String(n)])));

test('Kashi and his parent share the three declared homework areas, independently of school courses',()=>{
 assert.equal(usesHomeworkProgress(code),true);assert.equal(usesHomeworkProgress('kashifam-test'),true);assert.equal(usesHomeworkProgress('ferdi-test'),false);
 const p=homeworkProgress(code,[],today);assert.equal(p.assignmentWeek,'2026-11-16');assert.deepEqual(Array.from(p.goals,g=>[g.area,g.required]),[['writing',1],['spelling',2],['multiplication',5]]);assert.equal(p.submitted,0);assert.equal(p.hasWork,false);
 assert.equal(homeworkProgress('valentin-test',[writing],today).total,0);assert.equal(homeworkProgress('kashifam-test',[writing],today).submitted,1);assert.equal(homeworkProgress(code,[],'2026-11-15').total,0);
});
test('receipt counts require saved answers to required fields and never infer an accuracy score',()=>{
 const p=homeworkProgress(code,[writing,spelling,multiplication],today);assert.equal(p.submitted,3);assert.equal(p.total,3);assert.equal(p.hasWork,true);assert.deepEqual(Array.from(p.goals,g=>g.answered),[1,2,5]);assert.doesNotMatch(JSON.stringify(p),/percent|earned|accuracy/);
 const partial=homeworkProgress(code,[saved('part',english,2,{'kashi-personal-word-log':'Only my word log.'}),saved('optional',maths,1,{'kashi-multiplication-check-6':'Optional answer','kashi-multiplication-reflection':'My reflection'})],today);assert.equal(partial.submitted,0);assert.equal(partial.goals[1].answered,1);assert.equal(partial.goals[1].status,'partial');assert.equal(partial.goals[2].answered,0);
});
test('saved photos count as received pages without inventing individual answers or marks',()=>{
 const p=homeworkProgress(code,[saved('photo',maths,1,{handwritten_work:'[Handwritten answer: synthetic-page-00001]'})],today),g=p.goals[2];assert.equal(g.received,true);assert.equal(g.photo,true);assert.equal(g.answered,0);assert.equal(p.submitted,1);
 const fake=homeworkProgress(code,[saved('notphoto',maths,1,{handwritten_work:'https://example.com/page.png'})],today);assert.equal(fake.submitted,0);
});
test('latest revisions and duplicate records never double count or mutate original work',()=>{
 const older={...writing,submitted:'2026-11-14'},revision={...writing,id:'revision',submitted:'2026-11-17T12:00:00Z',status:'revision-needed',feedback:'Add a full stop.'},records=[writing,revision,older,revision],before=JSON.stringify(records),p=homeworkProgress(code,records,today);
 assert.equal(p.submitted,1);assert.equal(p.goals[0].status,'revision');assert.equal(p.goals[0].latest.id,'revision');assert.equal(p.goals[0].versions,2);assert.equal(JSON.stringify(records),before);
 const held=homeworkProgress(code,[{...revision,reviewPending:true}],today);assert.equal(held.goals[0].status,'submitted');
 const carried=homeworkProgress(code,[older],today);assert.equal(carried.submitted,1);assert.equal(carried.goals[0].latest.submitted,'2026-11-14');
});
test('foreign tasks, future records and invalid assignment metadata cannot fill homework rings',()=>{
 const p=homeworkProgress(code,[{...writing,unit:'foreign'},{...writing,task:'hw:7'},{...writing,submitted:'2026-11-18T12:00:00Z'},{...writing,id:''}],today);assert.equal(p.hasWork,false);assert.equal(p.submitted,0);
 const data=homeworkFixtures.get(path.resolve(`content/kashi/${english}/homework.json`)).default;
 const future={...data[0],week:3,assignmentWeek:'2026-11-23'};const invalid={...data[0],week:4,assignmentWeek:'2026-11-16',progress:{area:'writing',requiredTaskIds:['missing']}};
 const custom=loader({'../../content/kashi/kashi-writing-spelling-start-2026/homework.json':{default:[...data,future,invalid]}})('src/lib/homework-progress.ts').homeworkProgress;
 assert.equal(custom(code,[],today).goals.length,3);assert.equal(custom(code,[],'2026-11-24').goals.length,1);assert.equal(custom(code,[],'2026-11-24','2026-11-16').goals.length,3);assert.deepEqual(Array.from(custom(code,[],'2026-11-24').weeks),['2026-11-23','2026-11-16']);
});
const ui=load('src/components/HomeworkProgress.tsx');
function html(Component,props){return renderToStaticMarkup(React.createElement(Component,props));}
test('summary and full panel show real empty progress, clear task links and separate unassessed ability',()=>{
 const progress=homeworkProgress(code,[],today),summary=html(ui.HomeworkProgressSummary,{progress,href:'/progress',status:'ready'}),panel=html(ui.default,{progress,code});
 for(const output of [summary,panel]){assert.match(output,/Writing/);assert.match(output,/Spelling/);assert.match(output,/Multiplication/);assert.match(output,/0\/3/);assert.match(output,/not assessed|Not assessed/);assert.doesNotMatch(output,/unavailable|Speaking practice|Vocabulary practice|30 min/);}
 for(const [unit,week] of [[english,1],[english,2],[maths,1]])assert.ok(panel.includes(`/s/${code}/lessons/${unit}/homework/${week}/`));
 const parent=html(ui.default,{progress,code:'kashifam-test',parent:true});assert.doesNotMatch(parent,/href="\/s\//);
 for(const status of ['loading','error']){const output=html(ui.HomeworkProgressSummary,{href:'/progress',status});assert.doesNotMatch(output,/0\/3|No homework submitted/);assert.match(output,/Checking homework|could not load/);}
});
test('opened saved work preserves the original answer and never releases held teacher feedback',()=>{
 const openUI=loader({react:{...React,useState:()=>[true,()=>{}]},'./WorkFeedback':{default:()=>React.createElement('p',null,'Saved feedback reader')}})('src/components/HomeworkProgress.tsx');
 const progress=homeworkProgress(code,[{...writing,feedback:'PRIVATE HELD REVIEW',reviewPending:true},spelling,multiplication],today),output=html(openUI.default,{progress,code});assert.match(output,/My own first paragraph/);assert.match(output,/Saved feedback reader/);assert.doesNotMatch(output,/PRIVATE HELD REVIEW/);assert.match(output,/3 of 3 tasks submitted/);assert.match(output,/not accuracy or a grade/);
});
async function runLoader(result,{source,teacher=false}={}){
 const states=[],effects=[],reads=[],summaries=[];let cursor=0,effectCursor=0,pending=[];
 const mockedReact={...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useEffect:(fn,deps)=>{const i=effectCursor++,old=effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n]))){effects[i]={fn,deps,cleanup:old?.cleanup};pending.push(i);}}};
 const read=async(...args)=>{reads.push(args);if(result instanceof Error)throw result;return result;};
 const Component=loader({react:mockedReact,'@/lib/api':{authed:read,request:read,savedSession:()=>({token:'synthetic-teacher'})},'@/lib/teacher-metrics':{viennaDay:()=>today,eventDay:load('src/lib/teacher-metrics.ts').eventDay},'./HomeworkProgress':{default:({progress})=>React.createElement('p',null,`${progress.submitted}/${progress.total}`)}})('src/components/HomeworkProgressLoader.tsx').default;
 const props={code,teacher,source,onWeeklySummary:state=>summaries.push(state)};let output='';
 for(let pass=0;pass<4;pass++){cursor=0;effectCursor=0;pending=[];output=html(Component,props);for(const i of pending){effects[i].cleanup?.();effects[i].cleanup=effects[i].fn();}await new Promise(resolve=>setTimeout(resolve,0));}
 for(const effect of effects)effect?.cleanup?.();return {output,reads,summaries};
}
test('Kashi loader reads only authenticated submissions and reports saved counts without a course or calendar',async()=>{
 const p=await runLoader({ok:true,submissions:[writing]});assert.equal(p.reads.length,1);assert.deepEqual(p.reads[0].slice(0,1),[code]);assert.equal(p.reads[0][1].action,'submissions');assert.match(p.output,/1\/3/);assert.equal(p.summaries.at(-1).homework.submitted,1);
 const teacher=await runLoader({ok:true,submissions:[]},{teacher:true});assert.equal(teacher.reads[0][0].session,'synthetic-teacher');assert.equal(teacher.summaries.at(-1).status,'ready');assert.equal(teacher.summaries.at(-1).homework.submitted,0);
 const supplied=await runLoader(null,{source:{submissions:[writing],documents:[],records:[],replies:[],progress:null}});assert.equal(supplied.reads.length,0);assert.match(supplied.output,/1\/3/);
});
test('failed or malformed reads show retry and never turn unknown progress into zero',async()=>{
 for(const result of [{ok:false,error:'Saved homework read failed'},{ok:true},new Error('Network unavailable')]){const p=await runLoader(result);assert.equal(p.summaries.at(-1).status,'error');assert.match(p.output,/Retry|Try again/);assert.doesNotMatch(p.output,/0\/3|No homework submitted/);}
});
