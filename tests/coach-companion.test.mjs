import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/coach-companion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Array});
const {supportsFloatingCoach,companionIsVisible,openCoachCompanion}=exports;

function element(tag){return {tag,children:[],append(...items){this.children.push(...items);},cloneNode(){return {...this,copied:true};}};}
function document(){return {title:'',baseURI:'https://demo.invalid/teacher/live/',documentElement:{lang:'en',className:'dark'},head:element('head'),body:element('body'),visibilityState:'visible',createElement:element,querySelectorAll:()=>[{...element('style'),textContent:'body{color:navy}'},{...element('link'),rel:'stylesheet',href:'/app.css'}]};}
function setup(){const owner=document(),childDoc=document();childDoc.head.children=[];const opened={closed:false,document:childDoc,close(){this.closed=true;}};let calls=0;const host={document:owner,open(url,name,features){calls++;assert.equal(url,'');assert.equal(name,'_blank');assert.match(features,/popup/);return opened;}};return {host,opened,childDoc,calls:()=>calls};}

test('unsupported browsers open an ordinary private popup synchronously with honest mode and copied presentation styles',async()=>{
  const h=setup();assert.equal(supportsFloatingCoach(h.host),false);
  const opening=openCoachCompanion(h.host);assert.equal(h.calls(),1,'popup opening must occur within the click activation before awaiting');
  const target=await opening;assert.equal(target.mode,'popup');assert.equal(target.window,h.opened);assert.equal(target.container.id,'private-coach-companion');
  assert.equal(h.childDoc.title,'Private teaching coach · Rory’s English');assert.equal(h.childDoc.documentElement.className,'dark');
  assert.deepEqual(h.childDoc.head.children.map(node=>node.tag),['base','style','link','meta']);assert.equal(h.childDoc.head.children[0].href,h.host.document.baseURI);
  assert.equal(h.childDoc.body.children[0],target.container);
});

test('supported browsers request a genuine document PiP and do not open a popup too',async()=>{
  const h=setup();let requested=0;
  h.host.documentPictureInPicture={requestWindow(options){requested++;assert.equal(options.width,390);assert.equal(options.height,570);return Promise.resolve(h.opened);}};
  assert.equal(supportsFloatingCoach(h.host),true);const target=await openCoachCompanion(h.host);
  assert.equal(requested,1);assert.equal(h.calls(),0);assert.equal(target.mode,'picture-in-picture');
});

test('an explicit separate-window retry bypasses PiP and a denied PiP never silently opens another window',async()=>{
  const h=setup();h.host.documentPictureInPicture={requestWindow(){throw new Error('User activation unavailable');}};
  await assert.rejects(openCoachCompanion(h.host),/activation/);assert.equal(h.calls(),0);
  assert.equal((await openCoachCompanion(h.host,true)).mode,'popup');assert.equal(h.calls(),1);
  h.host.open=()=>null;await assert.rejects(openCoachCompanion(h.host,true),/Allow the private coach window/);
});

test('only a visible, same-origin, open companion allows listening while the main app is hidden',()=>{
  const h=setup(),target={window:h.opened};assert.equal(companionIsVisible(target),true);
  h.childDoc.visibilityState='hidden';assert.equal(companionIsVisible(target),false);
  h.childDoc.visibilityState='visible';h.opened.closed=true;assert.equal(companionIsVisible(target),false);
  assert.equal(companionIsVisible(null),false);
  assert.equal(companionIsVisible({window:{closed:false,get document(){throw new Error('Cross-origin navigation');}}}),false);
});

test('failed document preparation closes the opened window rather than leaving a blank private companion',async()=>{
  const h=setup();h.childDoc.createElement=()=>{throw new Error('Failed to prepare document');};
  await assert.rejects(openCoachCompanion(h.host),/Failed to prepare/);assert.equal(h.opened.closed,true);
});

function eventTarget(object={}){const events=new Map();return Object.assign(object,{addEventListener(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},removeEventListener(type,fn){events.get(type)?.delete(fn);},dispatch(type){for(const fn of [...events.get(type)||[]])fn();},listenerCount(){return [...events.values()].reduce((sum,list)=>sum+list.size,0);}});}
function hookHarness({delayed=false}={}){
  const h=setup();eventTarget(h.host);eventTarget(h.childDoc);eventTarget(h.opened);
  const timers=new Map();let timerId=0,resolve;
  h.host.setInterval=fn=>{timers.set(++timerId,fn);return timerId;};h.host.clearInterval=id=>timers.delete(id);
  h.opened.focus=()=>{};h.opened.close=()=>{h.opened.closed=true;h.opened.dispatch('pagehide');};
  if(delayed)h.host.documentPictureInPicture={requestWindow:()=>new Promise(r=>{resolve=r;})};
  let cursor=0,state;const hooks=[],effects=[];
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
  const react={
    useState(initial){const index=cursor++;const hook=hooks[index]||={value:initial};return [hook.value,value=>{hook.value=typeof value==='function'?value(hook.value):value;}];},
    useRef(initial){return hooks[cursor++]||={current:initial};},
    useCallback(fn,deps){const index=cursor++,previous=hooks[index];if(previous&&same(previous.deps,deps))return previous.fn;hooks[index]={fn,deps};return fn;},
    useEffect(fn,deps){const index=cursor++,previous=hooks[index];if(!previous||!same(previous.deps,deps))effects.push(()=>{previous?.cleanup?.();hooks[index]={deps,cleanup:fn()};});},
  };
  const dependency={react,'react-dom':{createPortal:()=>null},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'@/lib/coach-companion':exports};
  const module={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/CoachCompanion.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:module,window:h.host,require:name=>{assert.ok(name in dependency,`Unexpected dependency ${name}`);return dependency[name];}});
  function render(){cursor=0;state=module.useCoachCompanion();while(effects.length)effects.shift()();return state;}
  render();return {...h,timers,render,get state(){return state;},resolve:()=>resolve(h.opened),unmount(){for(const hook of hooks)hook?.cleanup?.();}};
}

test('companion hook tracks child visibility and user-close without leaking listeners or timers',async()=>{
  const h=hookHarness();await h.state.open();let state=h.render();
  assert.equal(state.isOpen,true);assert.equal(state.activeWhileHidden(),true);assert.equal(h.timers.size,1);
  const revision=state.visibilityRevision;h.childDoc.visibilityState='hidden';h.childDoc.dispatch('visibilitychange');state=h.render();
  assert.ok(state.visibilityRevision>revision);assert.equal(state.activeWhileHidden(),false);
  h.opened.close();state=h.render();assert.equal(state.isOpen,false);assert.equal(state.activeWhileHidden(),false);assert.equal(h.timers.size,0);assert.equal(h.childDoc.listenerCount(),0);
  h.unmount();assert.equal(h.host.listenerCount(),0);
});

test('a delayed floating window cannot reopen after explicit close or app unmount',async()=>{
  for(const unmount of [false,true]){
    const h=hookHarness({delayed:true}),pending=h.state.open();
    if(unmount)h.unmount();else h.state.close();
    h.resolve();await pending;
    assert.equal(h.opened.closed,true);assert.equal(h.render().isOpen,false);assert.equal(h.timers.size,0);
  }
});

test('leaving the app closes the private companion without ending any separate lesson recorder',async()=>{
  const h=hookHarness();await h.state.open();h.render();h.host.dispatch('pagehide');
  assert.equal(h.opened.closed,true);assert.equal(h.render().isOpen,false);assert.equal(h.timers.size,0);
});
