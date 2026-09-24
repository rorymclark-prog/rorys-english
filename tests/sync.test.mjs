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
  vm.runInNewContext(code,{exports,process:{env:{}},require:name=>name.includes("student-preview")?{isStudentPreview:()=>false}:api,localStorage:storage,window:{dispatchEvent(){}},navigator:{onLine:true},Event:class{}});
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

test("a refused submission no longer blocks the ones queued behind it",async()=>{
  let accept=false;
  const f=fixture(e=>accept&&e.id!=="stuck"?{ok:true,id:e.id,received:"2026-09-24 10:00"}:{ok:false,error:"Invalid answers"});
  await f.api.deliver({id:"stuck",code:"demo",action:"submit",answers:{answer:"first"}});
  await f.api.deliver({id:"fine",code:"demo",action:"submit",answers:{answer:"second"}});
  assert.equal(f.api.outbox("demo").length,2);
  accept=true;
  await f.api.drainSyncQueue();
  // The refused entry is met first. Before this fix it ended the drain and the
  // second answer never left the phone.
  assert.equal(f.api.outbox("demo").map(e=>e.id).join(","),"stuck");
});

test("a submission the service keeps refusing is parked, with the answer intact",async()=>{
  const f=fixture(()=>({ok:false,error:"Invalid answers"}));
  await f.api.deliver({id:"bad",code:"demo",action:"submit",answers:{answer:"keep this"}});
  for(let i=0;i<6;i++) await f.api.drainSyncQueue();
  assert.equal(f.api.outbox("demo").length,0);
  const parked=f.api.parkedItems("demo");
  assert.equal(parked.length,1);
  assert.equal(parked[0].event.answers.answer,"keep this");
  assert.match(parked[0].error,/Invalid answers/);
});

test("being offline never parks a submission or spends its tries",async()=>{
  const f=fixture(()=>({ok:false,offline:true,error:"Could not reach Rory’s app."}));
  await f.api.deliver({id:"waiting",code:"demo",action:"submit",answers:{answer:"on the bus"}});
  for(let i=0;i<8;i++) await f.api.drainSyncQueue();
  assert.equal(f.api.outbox("demo").length,1);
  assert.equal(f.api.parkedItems("demo").length,0);
});

test("a parked submission can be queued again or thrown away by the student",async()=>{
  const f=fixture(()=>({ok:false,error:"Invalid answers"}));
  await f.api.deliver({id:"bad",code:"demo",action:"submit",answers:{answer:"mine"}});
  for(let i=0;i<6;i++) await f.api.drainSyncQueue();
  assert.equal(f.api.parkedItems("demo").length,1);
  f.api.retryParked("demo","bad");
  assert.equal(f.api.outbox("demo").map(e=>e.id).join(","),"bad");
  assert.equal(f.api.parkedItems("demo").length,0);
  for(let i=0;i<6;i++) await f.api.drainSyncQueue();
  f.api.discardParked("demo","bad");
  assert.equal(f.api.parkedItems("demo").length,0);
  assert.equal(f.api.outbox("demo").length,0);
});

test("one student's queue stays bounded and overflow is parked, not lost",async()=>{
  const f=fixture(()=>({ok:false,offline:true}));
  for(let i=0;i<55;i++) await f.api.deliver({id:`e${String(i).padStart(2,"0")}`,code:"demo",action:"submit",answers:{answer:i}});
  assert.equal(f.api.outbox("demo").length,50);
  assert.equal(f.api.parkedItems("demo").length,5);
});
