import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

function plainModule(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl});return exports;}
const feedback=plainModule('src/lib/feedback-source.ts'),practice=plainModule('src/lib/lesson-practice.ts'),assessment=plainModule('src/lib/lesson-assessment.ts'),clarity=plainModule('src/lib/clarity.ts'),handwriting=plainModule('src/lib/handwritten-answer.ts');
const record=(id,date,kind='homework',body={})=>({id,date,created:date+'T12:00:00Z',kind,title:'Saved '+id,visibility:'shared',author:'Student',body});
const sample=[record('older','2026-10-01'),record('chat','2026-10-26','speaking',{evidenceType:'AI conversation captions',plainAiFeedback:{summary:'A clear account.',nextStep:'Give one more reason.'}}),record('middle','2026-10-17','lesson',{summary:'Lesson recap.'})];
function harness({records=sample,replies=[],mode='student',filter='all',hash='',focusRecordId}={}){
 const states=[records,replies,false,'','',filter,'',{}],refs=[],memo=[],listeners={},scrolled=[];
 let cursor=0,refCursor=0,memoCursor=0,effectCursor=0,dirty=false,effects=[],oldDeps=[],tree;
 const ReactMock={...React,
  useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],next=>{const value=typeof next==='function'?next(states[index]):next;if(value!==states[index]){states[index]=value;dirty=true;}}];},
  useRef(initial){const index=refCursor++;return refs[index]||(refs[index]={current:initial});},
  useCallback(fn,deps){const index=memoCursor++,before=memo[index];if(!before||deps.some((d,i)=>d!==before.deps[i]))memo[index]={fn,deps};return memo[index].fn;},
  useEffect(fn,deps){const index=effectCursor++;if(index===0)return;const before=oldDeps[index];if(!before||deps.some((d,i)=>d!==before[i])){effects.push(fn);oldDeps[index]=deps;}}
 };
 const marker=name=>props=>React.createElement('div',{'data-component':name},props.text||props.children);
 const mocks={react:ReactMock,'react/jsx-runtime':jsxRuntime,'next/link':{default:props=>React.createElement('a',props)},
  '@/lib/feedback-source':feedback,'@/lib/lesson-practice':practice,'@/lib/lesson-assessment':assessment,'@/lib/clarity':clarity,
  '@/lib/student-preview':{isStudentPreview:()=>false},'@/lib/use-durable-draft':{useDurableDraft:(_scope,value)=>({value,ready:true,pending:false,status:'Draft stays on this device',error:'',setValue(){},beginRequest:()=> 'synthetic-id',confirmSaved(){}})},'@/lib/teaching-files':{isTeachingPack:()=>false},'@/lib/handwritten-answer':handwriting,
  '@/lib/practice-rings':{ringAnswerText:value=>value},'@/lib/use-review-refresh':{useReviewRefresh:()=>{}},
  '@/components/FeedbackText':{default:({text})=>React.createElement('span',null,text)}
 };
 const exports={},window={location:{hash},addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]},document={getElementById:id=>({scrollIntoView:()=>scrolled.push(id)})};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/views/LearningView.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>mocks[name]||new Proxy({default:marker(name.split('/').at(-1))},{get:(target,key)=>target[key]||marker(String(key))}),window,document,Intl});
 const props={code:'sample',name:'Learner',mode,initialFilter:filter,focusRecordId};
 function render(){let turns=0;do{dirty=false;cursor=refCursor=memoCursor=effectCursor=0;effects=[];tree=exports.default(props);for(const effect of effects)effect();if(++turns>8)throw Error('Feedback focus did not settle.');}while(dirty);return tree;}
 return {exports,render,states,scrolled,hash(value){window.location.hash=value;listeners.hashchange?.();render();},html:()=>renderToStaticMarkup(render())};
}
function find(element,predicate){if(!React.isValidElement(element))return null;if(predicate(element))return element;for(const child of React.Children.toArray(element.props.children)){const result=find(child,predicate);if(result)return result;}return null;}

test('feedback sorts complete records by actual date without altering source order and retains a linked entry outside its filter',()=>{
 const h=harness(),before=sample.map(r=>r.id),all=h.exports.chronologicalFeedback(sample,'all');
 assert.deepEqual(Array.from(all,r=>r.id),['chat','middle','older']);assert.deepEqual(sample.map(r=>r.id),before);
 assert.deepEqual(Array.from(h.exports.chronologicalFeedback(sample,'homework','chat'),r=>r.id),['chat','older']);
 assert.equal(h.exports.feedbackNextStep(sample[1]),'Give one more reason.');
 assert.equal(h.exports.feedbackNextStep(record('private','2026-10-28','lesson',{tutorPrivate:{plan:'Private teaching reflection'}})),'');
});
test('filters precede results and unrelated uploads, recaps and speaking charts disappear from a selected conversation view',()=>{
 const html=harness({filter:'chat'}).html();
 assert.ok(html.indexOf('Filter learning records')<html.indexOf('Feedback overview'));
 assert.ok(html.indexOf('Filter learning records')<html.indexOf('id="review-chat"'));
 assert.doesNotMatch(html,/data-component="SavedWriting"|Lesson progress overview|id="review-older"|id="review-middle"/);
 assert.match(html,/Give one more reason/);assert.match(html,/id="review-chat"/);
});
test('the next-step preview stays short without changing the complete saved instruction',()=>{
 const h=harness(),instruction='Give advice and explain your reason in your own words. '.repeat(12),source=record('long','2026-10-28','lesson',{nextStep:instruction});
 const preview=h.exports.feedbackNextStep(source);
 assert.ok(preview.length<=281);assert.ok(preview.endsWith('…'));assert.equal(source.body.nextStep,instruction);
 const lessonPractice={version:1,status:'ready',sourceReviewId:'sample-source',lessonDate:'2026-10-26',title:'Friendships',recap:'A sample recap.',focus:['Give advice with a reason.'],speakingPrompt:'Explain one idea.',coaching:'Offer a short hint.',writingPrompt:instruction,speakingMinutes:8,writingMinutes:10,successCriteria:['I explain one reason.']};
 assert.equal(h.exports.feedbackNextStep(record('practice','2026-10-28','lesson',{lessonPractice})),'Give advice with a reason.');
 assert.equal(lessonPractice.writingPrompt,instruction);
});
test('exact conversation links choose Conversations, expand the matching saved entry and scroll after expansion',()=>{
 const h=harness({filter:'homework',hash:'#review-chat'}),tree=h.render();
 assert.equal(h.states[5],'chat');assert.equal(find(tree,e=>e.props.id==='review-chat').props.open,true);
 assert.deepEqual(h.scrolled,['review-chat']);
 const homework=find(tree,e=>e.type==='button'&&e.props.children==='Homework');homework.props.onClick();const filtered=h.render();
 assert.ok(find(filtered,e=>e.props.id==='review-chat'),'The linked entry remains available even outside the selected filter.');
 assert.equal(h.scrolled.length,1,'Changing a filter must not repeatedly steal scroll position.');
 h.hash('#write-older');const older=find(h.render(),e=>e.props.id==='review-older');
 assert.equal(older.props.open,true);assert.equal(h.scrolled.at(-1),'write-older');
});
test('notification focus props expand the exact record and read-only parents never receive response forms or private teaching reflections',()=>{
 const r=record('private-notes','2026-10-28','homework',{summary:'Shared summary.',tutorPrivate:{worked:'PRIVATE SUCCESS',plan:'PRIVATE PLAN'}});
 const h=harness({records:[r],focusRecordId:r.id,mode:'parent'}),html=h.html();
 assert.equal(find(h.render(),e=>e.props.id==='review-private-notes').props.open,true);
 assert.match(html,/Shared summary/);assert.doesNotMatch(html,/PRIVATE SUCCESS|PRIVATE PLAN|Send answer to Rory|Typed answer/);
});
