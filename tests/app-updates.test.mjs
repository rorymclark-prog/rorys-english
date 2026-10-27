import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
test('installed windows check for updates on focus and preserve work until a manual reload',async()=>{
 let effect,cleanup,tick,updates=0,reloads=0,clock=100000,registerOptions;
 const win=new EventTarget(),worker=new EventTarget(),doc=new EventTarget();worker.controller=null;doc.readyState='complete';doc.hidden=false;doc.querySelector=()=>null;win.location={reload(){reloads++;}};
 const states=[];const react={useState:initial=>[initial,v=>states.push(v)],useEffect:f=>{effect=f;}};
 worker.register=async(url,options)=>{assert.equal(url,'/sw.js');registerOptions=options;return {update:async()=>{updates++;}};};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ServiceWorkerRegister.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?react:{jsx:()=>null,jsxs:()=>null},window:win,navigator:{serviceWorker:worker,onLine:true},document:doc,process:{env:{}},Date:{now:()=>clock},setInterval:f=>{tick=f;return 1;},clearInterval(){}});
 exports.default();cleanup=effect();await new Promise(resolve=>setImmediate(resolve));assert.equal(registerOptions.updateViaCache,'none');
 win.dispatchEvent(new Event('focus'));await new Promise(resolve=>setImmediate(resolve));assert.equal(updates,1);
 win.dispatchEvent(new Event('focus'));assert.equal(updates,1);
 clock+=61000;doc.hidden=true;tick();assert.equal(updates,1);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await new Promise(resolve=>setImmediate(resolve));assert.equal(updates,2);
 worker.dispatchEvent(new Event('controllerchange'));assert.equal(states.includes(true),false);
 worker.dispatchEvent(new Event('controllerchange'));assert.equal(states.includes(true),true);assert.equal(reloads,0);
 cleanup();clock+=61000;win.dispatchEvent(new Event('focus'));await new Promise(resolve=>setImmediate(resolve));assert.equal(updates,2);
});
