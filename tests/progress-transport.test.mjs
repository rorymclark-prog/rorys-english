import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server/progress-transport.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, AbortSignal });
const { postProgress } = exports;
const endpoint = 'https://script.google.com/macros/s/test/exec';
const redirect = () => new Response(null, {status:302, headers:{location:'https://script.googleusercontent.com/macros/echo?test-response'}});
test('a temporary Google response failure retries only GET and never repeats the write', async () => {
  const calls=[]; const responses=[redirect(), new Response(null,{status:404}), Response.json({ok:true,id:'original-receipt'})];
  const result=await postProgress(endpoint,{action:'submit',session:'private-session',answers:{a:'exact original'}},async (url,opts)=>{calls.push({url:String(url),...opts});return responses.shift();});
  assert.equal(result.id,'original-receipt');assert.deepEqual(calls.map(c=>c.method),['POST','GET','GET']);
  assert.equal(JSON.parse(calls[0].body).answers.a,'exact original');
  assert.equal(calls[1].body,undefined);assert.equal(calls[1].headers,undefined);assert.equal(calls[1].redirect,'error');
});
test('an uncertain initial operation is never automatically replayed', async()=>{
  let calls=0;await assert.rejects(postProgress(endpoint,{action:'ai'},async()=>{calls++;return new Response(null,{status:503});}));assert.equal(calls,1);
});
test('credentials cannot follow an unexpected redirect destination',async()=>{
  let calls=0;await assert.rejects(postProgress(endpoint,{action:'login',credential:'private'},async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://unrelated.example/'}});}));assert.equal(calls,1);
});
test('health HTML and malformed responses never count as a saved answer receipt',async()=>{
  await assert.rejects(postProgress(endpoint,{action:'submit'},async()=>Response.json({ok:true,service:'rorys-english'})));
  await assert.rejects(postProgress(endpoint,{action:'submit'},async()=>new Response('<html>Not found</html>')));
});
