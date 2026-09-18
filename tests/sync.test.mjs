import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function fixture(respond) {
  const storage={};
  Object.defineProperties(storage,{
    getItem:{value:k=>storage[k]??null},
    setItem:{value:(k,v)=>{storage[k]=String(v);}},
    removeItem:{value:k=>{delete storage[k];}}
  });
  const exports={},sent=[];
  const api={authed:async(code,event)=>{sent.push(event);return respond(event);},savedSession:()=>({token:"test"})};
  const code=ts.transpileModule(fs.readFileSync("src/lib/sync.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,process:{env:{}},require:()=>api,localStorage:storage,window:{dispatchEvent(){}},navigator:{onLine:true},Event:class{}});
  return {api:exports,storage,sent};
}
test("a failed submission stays in the outbox and retry preserves the original",async()=>{
  let ok=false;const f=fixture(e=>({ok,id:e.id,received:"2026-09-18 12:00"}));
  const event={id:"first-event",code:"demo",action:"submit",answers:{answer:"original"}};
  assert.equal((await f.api.deliver(event)).ok,false);
  assert.equal(f.api.outbox("demo").length,1);
  ok=true;await f.api.deliver({...event,answers:{answer:"later edit"}});
  assert.equal(f.sent[1].answers.answer,"original");
  assert.equal(f.api.outbox("demo").length,0);
});
test("independent queue entries survive concurrent submissions",async()=>{
  const f=fixture(()=>({ok:false}));
  await Promise.all([f.api.deliver({id:"one",code:"demo",action:"submit"}),f.api.deliver({id:"two",code:"demo",action:"submit"})]);
  assert.equal(f.api.outbox("demo").length,2);
  assert.equal(f.api.outbox("other").length,0);
});
test("queued work drains after reconnection and only acknowledged entries disappear",async()=>{
  const f=fixture(()=>({ok:false}));
  await f.api.deliver({id:"one",code:"demo",action:"submit"});
  await f.api.drainSyncQueue();
  assert.equal(f.api.outbox("demo").length,1);
  assert.equal(f.sent.length,2);
});

test("a generic success or mismatched receipt never discards a saved answer",async()=>{
  for(const reply of [{ok:true},{ok:true,id:"other",received:"now"},{ok:true,id:"expected"}]){
    const f=fixture(()=>reply);
    assert.equal((await f.api.deliver({id:"expected",code:"demo",action:"submit",answers:{answer:"keep this"}})).ok,false);
    assert.equal(f.api.outbox("demo").length,1);
  }
});
