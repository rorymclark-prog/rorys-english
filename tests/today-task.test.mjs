import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/today-task.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams});
const {learnerTaskTitle,assignmentTargetId,assignmentTaskHref,selectedAssignmentId,revealAssignment}=exports;

test('learner titles remove only the known operational homework suffix, preserving learning content',()=>{
  const original='Friendships · current homework · 17 October reset';
  assert.equal(learnerTaskTitle(original),'Friendships');assert.equal(original,'Friendships · current homework · 17 October reset');
  assert.equal(learnerTaskTitle('Family life · current homework'),'Family life');
  for(const title of ['17 October · Friendships and helping others','Past simple · telling a story','How we reset a game','Current homework','Friendships · 17 October reset','Friendships · current homework · useful verbs'])assert.equal(learnerTaskTitle(title),title);
});

test('exact task links round-trip punctuation and learner identifiers without selecting a different assignment',()=>{
  for(const id of ['homework-reset-current','a / b & c?#','Über Freunde']){
    const href=assignmentTaskHref('learner-code',id),url=new URL(href,'https://app.test');
    assert.equal(url.pathname,'/s/learner-code/homework/');assert.equal(selectedAssignmentId(url.search,url.hash),id);
    assert.equal(decodeURIComponent(url.hash.slice(1)),assignmentTargetId(id));assert.equal(selectedAssignmentId('',url.hash),id);
  }
  assert.equal(selectedAssignmentId('?assignment=chosen','#assignment-other'),'chosen');
  assert.equal(selectedAssignmentId('','#unrelated'),'');assert.equal(selectedAssignmentId('','#assignment-%E0%A4%A'),'');
});

test('a deep link expands the exact task and archive, focuses its heading and keeps neighbouring work closed',()=>{
  const archive={tagName:'DETAILS',open:false,parentElement:null},other={open:false};
  let focused=false,scrolled=false;
  const summary={focus:options=>{focused=options.preventScroll===true;}};
  const target={tagName:'DETAILS',open:false,parentElement:archive,querySelector:selector=>selector==='summary'?summary:null,scrollIntoView:options=>{scrolled=options.block==='start'&&options.behavior==='auto';}};
  const root={getElementById:id=>id===assignmentTargetId('chosen')?target:null};
  assert.equal(revealAssignment('chosen',root),true);assert.equal(target.open,true);assert.equal(archive.open,true);assert.equal(other.open,false);assert.equal(focused,true);assert.equal(scrolled,true);
  assert.equal(revealAssignment('not-this-learner',root),false);
});

test('the combined speaking assignment can be targeted without pretending it is a collapsed details card',()=>{
  let focused=false,scrolled=false;
  const special={tagName:'SECTION',parentElement:null,querySelector:()=>null,focus:()=>{focused=true;},scrollIntoView:()=>{scrolled=true;}};
  assert.equal(revealAssignment('combined',{getElementById:id=>id===assignmentTargetId('combined')?special:null}),true);assert.equal(focused,true);assert.equal(scrolled,true);
});
