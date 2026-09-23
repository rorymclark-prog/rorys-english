import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
const guidedExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/guided-speaking.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: guidedExports });
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server/voice-session.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => {
  if(name==='../guided-speaking')return guidedExports;
  throw Error(name);
} });
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
  for(const voice of ['vesper','willow','stone','quartz','gleam','meridian'])assert.equal(voiceConfiguration({...body,voice}).session.audio.output.voice,voice);
  assert.ok(!config.session.instructions.includes('ignore lesson'));assert.equal(config.session.delegation.responses.tools.length,0);
  for(const changed of [{sdp:'invalid'},{sdp:'v=0'+'x'.repeat(50001)},{topic:'__proto__'},{topic:'untrusted prompt'},{voice:'unlisted'},{voice:'__proto__'}]) assert.throws(()=>voiceConfiguration({...body,...changed}));
});
test('practice modes keep unit details trusted and give short, useful coaching',()=>{
  for(const topic of ['general','everyday','opinions','story','unit','grammar']){
    const config=voiceConfiguration({...body,topic,grammar:'past-perfect'},{title:'Unit 1: Family life',vocabulary:['stepfather','keep in touch']});
    assert.match(config.session.instructions,/at most one useful grammar correction/i);
    assert.match(config.session.instructions,/five or six words maximum/i);
    assert.match(config.session.instructions,/Delegate to the backend when:/);
  }
  const unit=voiceConfiguration({...body,topic:'unit'},{title:'Unit 1: Family life',vocabulary:['stepfather']});
  assert.match(unit.session.instructions,/Verified practice words: stepfather/);
  const unknown=voiceConfiguration({...body,topic:'unit'},null);
  assert.match(unknown.session.instructions,/do not invent textbook details/i);
  const grammar=voiceConfiguration({...body,topic:'grammar',grammar:'past-perfect'});
  assert.match(grammar.session.instructions,/past perfect with past simple/);
  assert.throws(()=>voiceConfiguration({...body,topic:'grammar',grammar:'untrusted'}));
});

test('guided conversation focus is limited to the correct learner and mode',()=>{
  const valentin=voiceConfiguration({...body,code:'valentin-q9m2',topic:'unit',homeworkFocus:'valentin-chat-2'},{title:'way2go! 8 · Unit 1',vocabulary:['balanced diet']});
  assert.match(valentin.session.instructions,/two general healthy habits/i);
  const nextWeek=voiceConfiguration({...body,code:'valentin-q9m2',topic:'unit',homeworkFocus:'valentin-chat-3'},{title:'way2go! 8 · Unit 1'});
  assert.match(nextWeek.session.instructions,/school representative/i);
  const ferdi=voiceConfiguration({...body,code:'ferdi-7h3k',topic:'story',homeworkFocus:'ferdi-chat-1'},{title:'Family life'});
  assert.match(ferdi.session.instructions,/first, then and finally/i);
  for(const changed of [{code:'ferdi-7h3k'},{topic:'story'},{homeworkFocus:'invented-chat'}]){
    const config=voiceConfiguration({...body,code:'valentin-q9m2',topic:'unit',homeworkFocus:'valentin-chat-2',...changed});
    assert.doesNotMatch(config.session.instructions,/two general healthy habits/i);
  }
});

test('teacher voice tests require explicit teacher mode and a validated teacher session',async()=>{
  const teacher={...body,code:'__teacher__',teacherTest:true,token:'teacher-session'};
  let verified=0;
  const check=async token=>{verified++;assert.equal(token,'teacher-session');return true;};
  assert.equal(await authorizeVoice(teacher,roster,async()=>{throw Error('Student auth must not be used')},check),'teacher-voice-test');
  assert.equal(verified,1);
  await assert.rejects(authorizeVoice(teacher,roster,async()=>identity,async()=>false));
  await assert.rejects(authorizeVoice(teacher,roster,async()=>identity,async()=>{throw Error('expired')}));
  await assert.rejects(authorizeVoice(teacher,roster,async()=>identity));
  for(const changed of [{preview:true},{token:''},{code:'student'},{teacherTest:false}]) await assert.rejects(authorizeVoice({...teacher,...changed},roster,async()=>identity,check));
  assert.equal(verified,1);
});

test('the teacher route validates the backend role before any paid request and never forwards its session token',async()=>{
  let allowed=false,paidCalls=0;const checks=[];const route={};
  const source=ts.transpileModule(fs.readFileSync('src/app/api/voice/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const {createHash}=await import('node:crypto');
  class TransportError extends Error {}
  vm.runInNewContext(source,{
    exports:route,Response,URL,AbortSignal,console,process:{env:{LIVE_VOICE_ENABLED:'true',OPENAI_API_KEY:'synthetic-api-key',APPS_SCRIPT_URL:'https://script.google.com/synthetic',ACCOUNT_ROSTER_JSON:'{}'}},
    require:name=>{
      if(name==='node:crypto')return {createHash};
      if(name.includes('firebase-admin'))return {};
      if(name.includes('voice-session'))return exports;
      if(name.includes('content/students.json'))return [];
      if(name.includes('content/ferdi/units.json'))return [];
      if(name.includes('content/valentin/units.json'))return [];
      if(name.includes('google-http'))return {googleHttp:async()=>{throw Error('Unexpected direct call')}};
      if(name.includes('progress-transport'))return {ProgressTransportError:TransportError,postProgress:async(_url,body)=>{checks.push(body);return allowed?{ok:true,students:[]}:{ok:false,authRequired:true};}};
      throw Error(name);
    },
    fetch:async(_url,options)=>{
      paidCalls++;assert.equal(options.headers.Authorization,'Bearer synthetic-api-key');assert.ok(!options.body.includes('teacher-test-token'));
      return Response.json({session:{id:'synthetic-live'},transport:{sdp:'v=0 answer'}});
    },
  });
  const request=()=>new Request('https://app.example/api/voice/',{method:'POST',headers:{origin:'https://app.example'},body:JSON.stringify({...body,teacherTest:true,code:'__teacher__',token:'teacher-test-token'})});
  assert.equal((await route.POST(request())).status,403);assert.equal(paidCalls,0);
  allowed=true;assert.equal((await route.POST(request())).status,201);assert.equal(paidCalls,1);
  assert.equal(checks[0].action,'teacherDashboard');assert.equal(checks[0].session,'teacher-test-token');
});
