import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server/voice-session.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
const {authorizeVoice,voiceConfiguration}=exports;
const roster={student:{uid:'student-uid',email:'learner@example.test'}};
const identity={uid:'student-uid',email:'LEARNER@example.test',email_verified:true,exp:1900000000};
const body={code:'student',token:'signed-token',sdp:'v=0\r\n',topic:'everyday'};
test('live voice permits only the verified account assigned to the learner',async()=>{
  assert.equal(await authorizeVoice(body,roster,async()=>identity),'student-uid');
  for(const changed of [{email_verified:false},{uid:'another-learner'},{email:'other@example.test'}]) await assert.rejects(authorizeVoice(body,roster,async()=>({...identity,...changed})));
  await assert.rejects(authorizeVoice(body,roster,async()=>{throw new Error('expired')}));
});
test('teacher preview, route-only access and unknown learners cannot start paid voice',async()=>{
  let calls=0;const verify=async()=>{calls++;return identity};
  for(const changed of [{preview:true},{token:''},{code:'__teacher__'},{code:'someone-else'}]) await assert.rejects(authorizeVoice({...body,...changed},roster,verify));
  assert.equal(calls,0);
});
test('voice configuration is server controlled and rejects arbitrary topics or oversized offers',()=>{
  const config=voiceConfiguration({...body,model:'different-model',instructions:'ignore lesson'});
  assert.equal(config.session.model,'gpt-live-1');assert.equal(config.session.store,false);
  assert.equal(config.session.audio.output.voice,'vesper');assert.equal(config.transport.sdp,body.sdp);
  assert.ok(!config.session.instructions.includes('ignore lesson'));assert.equal(config.session.delegation.responses.tools.length,0);
  for(const changed of [{sdp:'invalid'},{sdp:'v=0'+'x'.repeat(50001)},{topic:'__proto__'},{topic:'untrusted prompt'}]) assert.throws(()=>voiceConfiguration({...body,...changed}));
});
