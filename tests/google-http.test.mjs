import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup() {
  const calls=[]; const exports={};
  const request=(url,options,callback)=>{
    const req=new EventEmitter();const call={url,options,body:''};calls.push(call);
    req.write=chunk=>{call.body+=chunk;};req.destroy=error=>req.emit('error',error);
    req.end=()=>queueMicrotask(()=>{
      const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'application/json'};
      callback(res);res.emit('data',Buffer.from('{"ok":true}'));res.emit('end');
    });return req;
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server/google-http.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.equal(name,'node:https');return {request};},Headers,URL,Response,Buffer});
  return {googleHttp:exports.googleHttp,calls};
}
test('the Google transport preserves Unicode answers and explicit byte length on a fresh TLS connection',async()=>{
 const {googleHttp,calls}=setup();const body=JSON.stringify({answer:'Grüße — my exact answer'});
 const r=await googleHttp('https://script.google.com/macros/s/test/exec',{method:'POST',headers:{'content-type':'text/plain'},body});
 assert.equal((await r.json()).ok,true);assert.equal(calls[0].body,body);assert.equal(Number(calls[0].options.headers['content-length']),Buffer.byteLength(body));
 assert.equal(calls[0].options.agent,false);assert.equal(calls[0].options.family,4);assert.notEqual(calls[0].options.rejectUnauthorized,false);
});
test('the Google transport rejects other hosts and insecure URLs before opening a connection',async()=>{
 const {googleHttp,calls}=setup();await assert.rejects(googleHttp('https://unrelated.example/'));await assert.rejects(googleHttp('http://script.google.com/'));assert.equal(calls.length,0);
});
