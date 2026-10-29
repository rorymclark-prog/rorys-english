import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

function componentHarness(file,mocks,props){
 const states=[],refs=[],deps=[],effects=[],listeners=new Map();let cursor=0,refCursor=0,effectCursor=0;
 const react={...React,useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];},useRef(initial){return refs[refCursor++]??(refs[refCursor-1]={current:initial});},useEffect(fn,next){const index=effectCursor++,old=deps[index];if(!old||next.some((value,i)=>value!==old[i])){deps[index]=next;effects.push(fn);}}};
 const exports={},window={addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?jsxRuntime:mocks[name]||(()=>{throw Error(name);})(),window,Intl,Date,Error,encodeURIComponent});
 const cleanups=[];
 function render(){cursor=refCursor=effectCursor=0;const tree=exports.default(props);while(effects.length){const cleanup=effects.shift()();if(cleanup)cleanups.push(cleanup);}return tree;}
 return {render,html:()=>renderToStaticMarkup(render()),event:name=>listeners.get(name)?.(),unmount:()=>cleanups.forEach(fn=>fn()),props};
}
function find(element,predicate){if(!React.isValidElement(element))return null;if(predicate(element))return element;for(const child of React.Children.toArray(element.props.children)){const match=find(child,predicate);if(match)return match;}return null;}
const exercise={id:'past-001',type:'choice',prompt:'Yesterday, I ___ home.',focus:'Past simple',options:['go','went'],example:'SECRET GUIDANCE',explanation:'SECRET EXPLANATION'};
const old={id:'old-attempt',documentId:'document-001',version:'v1',exerciseId:exercise.id,created:'2026-10-20T12:00:00Z',answer:'OLD ANSWER',result:{status:'correct',example:'OLD EXAMPLE',explanation:'OLD EXPLANATION'}};
function exerciseHarness({attempts=[old],disabled=false,teacher=false,preview=false,confirm=true}={}){
 let resolveRequest;const requests=[],receipts=[],saved=[],draft={value:'went',ready:true,pending:false,scopeKey:'account-one',status:'Draft saved on this device',error:'',setValue(){},beginRequest(){draft.pending=true;return 'new-attempt';},confirmSaved(){receipts.push('confirmed');return confirm;},resumeEditing(){draft.pending=false;}};
 const props={code:'sample',documentId:'document-001',version:'v1',sourceType:'document',disabled,teacher,exercise,index:0,attempts,hidePreviousUntilAttempt:true,onSaved:attempt=>saved.push(attempt)};
 const h=componentHarness('src/components/PracticeExercise.tsx',{'@/lib/documents':{documentRequest:(_code,_teacher,body)=>{requests.push(body);return new Promise(resolve=>resolveRequest=resolve);}},'@/lib/student-preview':{isStudentPreview:()=>preview},'@/lib/use-durable-draft':{useDurableDraft:()=>draft}},props);
 const result={ok:true,received:true,attempt:{...old,id:'new-attempt',answer:'went',result:{status:'correct',example:'went',explanation:'Use the past simple for yesterday.'}}};
 return {...h,requests,receipts,saved,draft,result,resolve:value=>resolveRequest(value),start(){const button=find(h.render(),node=>node.type==='button'&&node.props.children==='Save this try');return button.props.onClick();}};
}

test('a revisit hides earlier answers, examples and history on every new mount',()=>{
 for(let visit=0;visit<2;visit++){
  const h=exerciseHarness({attempts:[old,{...old,id:'another-old'}]}),html=h.html();
  assert.match(html,/Yesterday, I/);assert.match(html,/Try from memory first/);assert.doesNotMatch(html,/OLD ANSWER|OLD EXAMPLE|OLD EXPLANATION|SECRET|saved attempts|One possible answer/);
  h.unmount();
 }
});
test('only an exact confirmed source/version/exercise/answer receipt reveals this visit’s example',async()=>{
 const h=exerciseHarness();h.start();assert.equal(h.requests.length,1);assert.doesNotMatch(h.html(),/One possible answer/);
 h.resolve(h.result);await new Promise(setImmediate);
 assert.equal(h.receipts.length,1);assert.equal(h.saved.length,1);assert.match(h.html(),/One possible answer: went/);assert.match(h.html(),/Your saved answer: went/);
});
test('mismatched receipts retain the draft without revealing any example',async()=>{
 for(const patch of [{id:'another-id'},{documentId:'another-document'},{version:'old-version'},{exerciseId:'other-exercise'},{answer:'go'}]){
  const h=exerciseHarness();h.start();h.resolve({...h.result,attempt:{...h.result.attempt,...patch}});await new Promise(setImmediate);
  assert.equal(h.receipts.length,0);assert.equal(h.saved.length,0);assert.equal(h.draft.pending,true);assert.match(h.html(),/Could not confirm your attempt/);assert.doesNotMatch(h.html(),/One possible answer|OLD ANSWER|OLD EXAMPLE/);
 }
});
test('a refusal resumes editing while an uncertain delivery retains the frozen retry',async()=>{
 for(const offline of [false,true]){
  const h=exerciseHarness();h.start();h.resolve({ok:false,offline,error:'Sample refusal'});await new Promise(setImmediate);
  assert.equal(h.draft.pending,offline);assert.equal(h.receipts.length,0);assert.doesNotMatch(h.html(),/One possible answer/);
 }
});
test('account change and unmount suppress returned attempts and callbacks',async()=>{
 for(const change of ['auth','unmount','scope','learner','version']){
  const h=exerciseHarness();h.start();
  if(change==='auth')h.event('re-auth-change');else if(change==='unmount')h.unmount();else if(change==='scope'){h.draft.scopeKey='another-account';h.render();}else{h.props[change==='learner'?'code':'version']='another-value';h.render();}
  h.resolve(h.result);await new Promise(setImmediate);
  assert.equal(h.receipts.length,0);assert.equal(h.saved.length,0);if(change!=='unmount')assert.doesNotMatch(h.html(),/One possible answer/);
 }
});
test('a failed guarded draft confirmation does not expose the result or report a saved session',async()=>{
 const h=exerciseHarness({confirm:false});h.start();h.resolve(h.result);await new Promise(setImmediate);
 assert.equal(h.receipts.length,1);assert.equal(h.saved.length,0);assert.match(h.html(),/device copy could not be cleared/);assert.doesNotMatch(h.html(),/One possible answer/);
});
test('read-only teacher and learner previews retain choices without forms or old guidance',()=>{
 for(const options of [{disabled:true,teacher:true},{disabled:true,preview:true}]){
  const h=exerciseHarness(options),html=h.html();assert.match(html,/<li>go<\/li>/);assert.match(html,/<li>went<\/li>/);assert.doesNotMatch(html,/<select|<textarea|Save this try|OLD ANSWER|OLD EXAMPLE|SECRET/);assert.equal(h.requests.length,0);
 }
});
