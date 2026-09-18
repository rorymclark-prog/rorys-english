import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function client(fetch) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync("src/lib/api.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,fetch,process:{env:{NEXT_PUBLIC_SYNC_URL:"https://example.test/exec"}},AbortController,setTimeout:(fn,ms)=>ms===500?(fn(),0):0,clearTimeout:()=>{}});
  return exports;
}
test("temporary Google response errors retry reads without retrying writes or AI",async()=>{
  for(const action of ["login","submissions","teacherDashboard"]){
    let calls=0;
    const api=client(async()=>++calls===1?{ok:false,status:404}:{ok:true,json:async()=>({ok:true,token:"test",expires:1789750000000,role:"student"})});
    assert.equal((await api.request({action})).ok,true);assert.equal(calls,2);
  }
  for(const action of ["submit","teacherAccess","teacherAssignHomework","ai"]){
    let calls=0;
    const api=client(async()=>{calls++;throw new Error("lost response")});
    assert.equal((await api.request({action})).ok,false);assert.equal(calls,1);
  }
});
test("rejected credentials and permanent HTTP denials are not retried",async()=>{
  for(const response of [{ok:true,json:async()=>({ok:false,error:"Sign-in failed"})},{ok:false,status:403}]){
    let calls=0;
    const api=client(async()=>{calls++;return response});
    assert.equal((await api.request({action:"login"})).ok,false);assert.equal(calls,1);
  }
});

test("a health response or incomplete sign-in is never accepted as login success",async()=>{
  for(const reply of [{ok:true,service:"rorys-english",version:2},{ok:true}]){
    let calls=0;
    const api=client(async()=>{calls++;return {ok:true,json:async()=>reply}});
    assert.equal((await api.request({action:"login"})).ok,false);assert.equal(calls,2);
  }
});
