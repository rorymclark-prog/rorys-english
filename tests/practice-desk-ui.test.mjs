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

const practiceCard=(id,state='first')=>({id,sourceId:'source-'+id,documentId:'document-'+id,version:'v1',sourceTitle:'Saved '+id,sourceDate:'2026-10-20',exercise:{...exercise,id:'exercise-'+id},attempts:[],state,lastPractised:null});
const deskData=(cards=[],extra={})=>({sources:cards.map(card=>({id:card.sourceId})),cards,warnings:[],hasMore:true,checked:8,remaining:8,failed:0,total:16,continuation:{},...extra});
function deskHarness(){
 const calls=[],extensions=[];let preview=false,token='student-one';
 const Exercise=props=>React.createElement('span',{'data-practice-exercise':props.documentId},props.exercise.prompt);
 const h=componentHarness('src/components/PracticeDesk.tsx',{'next/link':{default:props=>React.createElement('a',props)},'@/lib/api':{savedSession:()=>({token})},'@/lib/student-preview':{isStudentPreview:()=>preview},'@/lib/practice-desk':{loadPracticeDesk:(...args)=>new Promise((resolve,reject)=>calls.push({args,resolve,reject})),extendPracticeDesk:(...args)=>new Promise((resolve,reject)=>extensions.push({args,resolve,reject}))},'./PracticeExercise':{default:Exercise}},{code:'sample',name:'Sample'});
 const button=label=>find(h.render(),node=>node.type==='button'&&node.props.children===label);
 return {...h,calls,extensions,button,exercise:()=>find(h.render(),node=>node.type===Exercise),card:()=>find(h.render(),node=>node.props.className==='practice-desk-card'),preview:value=>{preview=value;},token:value=>{token=value;}};
}
const settle=()=>new Promise(setImmediate);

test('an empty first batch still offers older work and separates checked sources from practice sources',async()=>{
 const h=deskHarness();h.render();await settle();h.calls[0].resolve(deskData([]));await settle();
 assert.match(h.html(),/Checked 8 of 16 pieces of saved work/);assert.match(h.html(),/0 pieces include practice prompts/);assert.ok(h.button('Check older saved work'));
 assert.equal(h.extensions.length,0,'Loading the first batch never automatically scans older work.');
 h.button('Check older saved work').props.onClick();h.button('Check older saved work').props.onClick();await settle();
 assert.equal(h.extensions.length,1,'Repeated clicks create only one request.');assert.equal(h.extensions[0].args[3],'older');assert.equal(h.button('Check older saved work').props.disabled,true);
 h.extensions[0].resolve(deskData([practiceCard('older')],{checked:16,remaining:0,hasMore:false,continuation:null}));await settle();assert.match(h.html(),/Saved older/);assert.equal(h.button('Check older saved work'),null);
});
test('append and retry preserve the current filter, page, exercise identity and saved-this-visit progress',async()=>{
 const h=deskHarness(),initial=deskData([1,2,3,4].map(id=>practiceCard(String(id),'revisit')),{failed:1,warnings:['One check failed.']});
 h.render();await settle();h.calls[0].resolve(initial);await settle();
 const revisit=find(h.render(),node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children[0]==='Revisit');revisit.props.onClick();
 h.button('Another short set').props.onClick();const before=h.card().key,documentId=h.exercise().props.documentId;h.exercise().props.onSaved();assert.match(h.html(),/1 of 1 saved this visit/);
 h.button('Check older saved work').props.onClick();await settle();assert.equal(h.extensions[0].args[2],initial);
 h.extensions[0].resolve({...initial,cards:[...initial.cards,practiceCard('five','revisit')],checked:15,remaining:0,hasMore:false});await settle();
 assert.equal(h.card().key,before);assert.equal(h.exercise().props.documentId,documentId);assert.match(h.html(),/1 of 2 saved this visit/);assert.match(h.html(),/Set 2 of 2/);
 const retry=h.button('Retry unchecked work');retry.props.onClick();await settle();assert.equal(h.extensions[1].args[3],'retry');h.extensions[1].resolve({...initial,cards:[...initial.cards,practiceCard('five','revisit'),practiceCard('six','revisit')],checked:16,remaining:0,failed:0,warnings:[],hasMore:false,continuation:null});await settle();
 assert.equal(h.card().key,before);assert.equal(h.exercise().props.documentId,documentId);assert.match(h.html(),/1 of 3 saved this visit/);assert.equal(h.button('Retry unchecked work'),null);
 assert.equal(find(h.render(),node=>node.type==='button'&&node.props['aria-pressed']===true).props.children[0],'Revisit');
 h.unmount();
});
test('failed incremental reads keep active prompts and offer a retry without restarting the list',async()=>{
 const h=deskHarness();h.render();await settle();h.calls[0].resolve(deskData([practiceCard('one')]));await settle();const before=h.card().key;
 h.button('Check older saved work').props.onClick();await settle();h.extensions[0].reject(new Error('Sample connection lost'));await settle();
 assert.match(h.html(),/Sample connection lost/);assert.equal(h.card().key,before);assert.equal(h.calls.length,1);assert.equal(h.button('Check older saved work').props.disabled,false);
 h.button('Check older saved work').props.onClick();await settle();assert.equal(h.extensions.length,2);
});
test('late older-work responses are suppressed after auth, learner, preview or unmount changes',async()=>{
 for(const change of ['auth','learner','preview','unmount']){
  const h=deskHarness();h.render();await settle();h.calls[0].resolve(deskData([practiceCard('one')]));await settle();h.button('Check older saved work').props.onClick();await settle();
  if(change==='auth'){h.token('another-student');h.event('re-auth-change');h.render();}else if(change==='learner'){h.props.code='another-learner';h.render();}else if(change==='preview'){h.preview(true);h.render();}else h.unmount();
  assert.equal(h.calls.length,1,'A new identity waits for the old pool to settle.');
  h.extensions[0].resolve(deskData([practiceCard('STALE-SECRET')],{remaining:0}));await settle();
  if(change!=='unmount')assert.doesNotMatch(h.html(),/STALE-SECRET/);
  h.unmount();
 }
});
test('explicit list refresh creates a new metadata snapshot while ordinary append never reloads it',async()=>{
 const h=deskHarness();h.render();await settle();h.calls[0].resolve(deskData([practiceCard('one')],{remaining:0,failed:0,hasMore:false,continuation:null}));await settle();
 assert.equal(h.calls.length,1);h.button('Refresh saved-work list').props.onClick();h.render();await settle();assert.equal(h.calls.length,2);assert.match(h.html(),/Finding practice/);
 h.calls[1].resolve(deskData([],{checked:0,remaining:0,total:0,continuation:null}));await settle();assert.doesNotMatch(h.html(),/Saved one/);
});
