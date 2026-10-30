import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {deflateRawSync, inflateRawSync} from 'node:zlib';

function load(path, dependencies={}, globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,Request,Response,FormData,AbortSignal,URL,Map,Set,Date,process:{env:{}},require:name=>{if(name in dependencies)return dependencies[name];throw Error(name);},...globals});
  return exports;
}
const shared=load('src/lib/live-coach.ts');
const service=load('src/lib/server/live-coach-service.ts',{'../live-coach':shared});
const material=load('src/lib/server/coach-material.ts',{'node:zlib':{inflateRawSync}});
const context={learner:'Demo learner',unit:'Original practice',task:'Tell a story',objective:'Past simple',source:'Ask about yesterday.',slide:'Slide 1'};
const body={code:'__teacher__',token:'teacher-session',context,sdp:'v=0\r\n'};

test('lesson context preserves valid audio modes and rejects ambiguous source modes without breaking older saved contexts',()=>{
  assert.equal(shared.coachContext(context).audioMode,undefined);
  for(const audioMode of ['room','online'])assert.equal(shared.coachContext({...context,audioMode}).audioMode,audioMode);
  for(const audioMode of [null,'mixed','ONLINE',false,{},[]])assert.throws(()=>shared.coachContext({...context,audioMode}));
  const native=service.coachSession({...body,context:{...context,audioMode:'online'}});
  assert.match(native.instructions,/"audioMode":"online"/);
});

test('only a verified teacher session can reach paid coaching or private imports',async()=>{
  let verifications=0;
  const verify=async token=>{verifications++;return token==='teacher-session';};
  for(const changed of [{code:'student'},{preview:true},{token:''},{token:'expired'},{token:'x'.repeat(4097)}]) await assert.rejects(service.authorizeCoach({...body,...changed},verify));
  await service.authorizeCoach(body,verify);
  assert.equal(verifications,2);
});
test('native listening returns text only, caps output, and rejects malformed SDP and context',()=>{
  const config=service.coachSession({...body,model:'untrusted',instructions:'untrusted'});
  assert.equal(config.model,'gpt-realtime-2.1');
  assert.equal(JSON.stringify(config.output_modalities),'["text"]');
  assert.equal(config.max_output_tokens,700);
  assert.equal(config.tools.length,0);
  assert.equal(config.audio.input.turn_detection.create_response,false);
  for(const changed of [{sdp:'not SDP'},{sdp:'v=0'+'x'.repeat(50001)},{context:{...context,source:'x'.repeat(12001)}},{context:{...context,learner:[]}}]) assert.throws(()=>service.coachSession({...body,...changed}));
});
test('typed coaching cannot receive arbitrary models, tools or oversized learner input',()=>{
  const request=service.coachAnalysis({...body,text:'Yesterday I go home.',model:'untrusted',tools:[{name:'publish'}]});
  assert.equal(request.model,'gpt-6-sol');assert.equal(request.store,false);assert.equal(request.tools.length,0);
  assert.match(request.input,/Yesterday I go home\./);
  for(const text of ['', ' ', 'x'.repeat(4001), {}])assert.throws(()=>service.coachAnalysis({...body,text}));
});
test('feedback parsing accepts one bare, fenced or parenthesized object without repairing grammar',()=>{
  const feedback={...shared.coachRehearsal[0],heard:'Yesterday I go home.'};
  assert.equal(shared.parseCoachFeedback(JSON.stringify(feedback)).heard,'Yesterday I go home.');
  assert.equal(shared.parseCoachFeedback('```json\n'+JSON.stringify(feedback)+'\n```').heard,feedback.heard);
  assert.equal(shared.parseCoachFeedback('('+JSON.stringify(feedback)+')').heard,feedback.heard);
  assert.equal(shared.parseCoachFeedback('```json\n('+JSON.stringify(feedback)+')\n```').heard,feedback.heard);
  assert.equal(service.feedbackFromResponse({output:[{content:[{type:'output_text',text:JSON.stringify(feedback)}]}]}).heard,feedback.heard);
});
test('feedback parsing rejects prose extraction, multiple objects, nested wrappers and incomplete fields',()=>{
  const json=JSON.stringify(shared.coachRehearsal[0]);
  for(const text of ['[]','null','{"heard":"hello"}','not json','Here is the result: '+json,json+'\n'+json,'(('+json+'))','```json\n'+json,'```json\n'+json+'\n``` trailing','('+json+'); alert(1)',JSON.stringify({...shared.coachRehearsal[0],correction:null})])assert.throws(()=>shared.parseCoachFeedback(text));
});
test('native object-body output accepts exactly seven known string fields without inventing grammar',()=>{
  const body='"heard":"I\'m Ella. I arrived at the party.","strength":"Good use of arrived.","focus":"No correction needed; add a reason.","correction":"","prompt":"Why did Zoe look annoyed?","next":"Add one sentence with because.","uncertainty":""';
  const parsed=shared.parseCoachFeedback(body);
  assert.equal(parsed.heard,"I'm Ella. I arrived at the party.");assert.equal(parsed.correction,'');assert.equal(parsed.prompt,'Why did Zoe look annoyed?');
  const escaped={...shared.coachRehearsal[0],heard:'I said "hello", then I go.\nA new line.'};
  assert.equal(shared.parseCoachFeedback(JSON.stringify(escaped).slice(1,-1)).heard,escaped.heard);
  assert.equal(shared.parseCoachFeedback('('+body+')').heard,parsed.heard);
  for(const invalid of [body+',"extra":"prose"',body+',"heard":"duplicate"',body.replace('"strength":','"heard":'),body.replace('"strength":"Good use of arrived."','"strength":{}'),body.replace(',"uncertainty":""',''),body+',',body+' trailing prose','Here is the result: '+body,body+'\n'+body])assert.throws(()=>shared.parseCoachFeedback(invalid));
});
test('native feedback cannot invent an arrival error by changing an ASR final quote',()=>{
  const falseCorrection={heard:'When I arrive home, Zoe looked annoyed.',strength:'A clear past-time story.',focus:'Use arrived rather than arrive for the past.',correction:'When I arrived home, Zoe looked annoyed.',prompt:'What was the reason Zoe looked annoyed?',next:'Practise the past form arrived.',uncertainty:''};
  const caption='When I arrived home, Zoe looked annoyed.';
  const bounded=shared.boundCoachFeedback(falseCorrection,caption);
  assert.equal(bounded.heard,caption);assert.equal(bounded.correction,'');assert.equal(bounded.strength,'');
  assert.doesNotMatch(bounded.focus,/use arrived|rather than arrive/i);
  assert.equal(bounded.prompt,falseCorrection.prompt);
  assert.match(bounded.uncertainty,/AI quote did not match the machine caption/);
  assert.match(bounded.uncertainty,/Either may have misheard/);
  assert.equal(falseCorrection.correction,'When I arrived home, Zoe looked annoyed.');
});
test('faithful error quotes tolerate punctuation, case, curly quotes and whitespace without grammar changes',()=>{
  const feedback={...shared.coachRehearsal[0],heard:'“YESTERDAY  I go to the park.”'};
  const bounded=shared.boundCoachFeedback(feedback,'Well, yesterday I go to the park. Then I come home.');
  assert.equal(bounded.heard,feedback.heard);assert.equal(bounded.correction,feedback.correction);assert.equal(bounded.strength,feedback.strength);
  assert.notEqual(bounded,feedback);
});
test('a corrected retry cannot inherit the preceding answer’s false error or correction prompt',()=>{
  const prior={...shared.coachRehearsal[0],heard:'Yesterday I go to the park.',prompt:'What is the past of go?'};
  const bounded=shared.boundCoachFeedback(prior,'Yesterday I went to the park.');
  assert.equal(bounded.correction,'');assert.equal(bounded.strength,'');assert.doesNotMatch(bounded.focus,/past simple/);
  assert.equal(bounded.prompt,'Could you tell me a little more?');
  for(const prompt of ["What is wrong with 'I go'?",'How can you improve the verb?', 'Which sentence is correct?'])assert.equal(shared.boundCoachFeedback({...prior,prompt},'Yesterday I went to the park.').prompt,'Could you tell me a little more?');
  for(const [heard,caption] of [['I arrive','I arrived'],['we play','we played'],['...','I went home.'],['I went home.','']]){
    const result=shared.boundCoachFeedback({...prior,heard},caption);
    assert.equal(result.correction,'');assert.ok(result.uncertainty);
  }
  const success={...shared.coachRehearsal[1],heard:'We played football and then we went home because it was raining.'};
  assert.equal(shared.boundCoachFeedback(success,success.heard).focus,success.focus);
  assert.equal(shared.boundCoachFeedback(success,success.heard).correction,'');
});
test('shared online conversation retains useful content prompts without assessing either speaker as the learner',()=>{
  const caption='We went to the park because it was sunny.';
  const feedback={heard:caption,strength:'Correct past tense.',focus:'The learner improved.',correction:'We had gone to the park.',prompt:'What did you enjoy most at the park?',next:'Invite one detail about the game.',uncertainty:'The learner has poor pronunciation.'};
  const sharedFeedback=shared.conversationCoachFeedback(feedback,caption);
  assert.equal(sharedFeedback.heard,caption);assert.equal(sharedFeedback.strength,'');assert.equal(sharedFeedback.correction,'');
  assert.equal(sharedFeedback.prompt,feedback.prompt);assert.equal(sharedFeedback.next,feedback.next);
  assert.match(sharedFeedback.uncertainty,/Speaker identity is unconfirmed/);
  assert.doesNotMatch(sharedFeedback.uncertainty,/poor pronunciation/);
  assert.doesNotMatch(sharedFeedback.focus,/improved|tense|learner/i);
});
test('shared conversation rejects correction questions and assessment steps even when their quote matches',()=>{
  const caption='Yesterday I go to the park.';
  for(const [prompt,next] of [
    ['What is the past of go?','Ask for a correct past tense.'],
    ['Which sentence is correct?','Listen for accurate pronunciation.'],
    ['How can you fix the verb?','The learner has improved significantly.'],
    ['Say it again.','Invite a CEFR score for this attempt.'],
  ]){
    const feedback=shared.conversationCoachFeedback({...shared.coachRehearsal[0],heard:caption,prompt,next},caption);
    assert.equal(feedback.correction,'');assert.equal(feedback.strength,'');
    assert.equal(feedback.prompt,'What happened next, and why?');
    assert.equal(feedback.next,'Invite one more detail or reason, then listen to the answer.');
  }
});
test('shared conversation still flags conflicting quotations and never turns them into grammar evidence',()=>{
  const feedback=shared.conversationCoachFeedback({...shared.coachRehearsal[0],heard:'Yesterday I go to the park.'},'Yesterday I went to the park.');
  assert.equal(feedback.heard,'Yesterday I went to the park.');assert.equal(feedback.correction,'');
  assert.match(feedback.uncertainty,/Either may have misheard/);
});
test('private teacher questions retain slide context and reject invalid images and oversized questions',()=>{
  const question=service.coachQuestion({...body,question:'How can I explain this?',image:'data:image/jpeg;base64,YWJj',evidence:'learner: Yesterday I go.'});
  assert.equal(question.store,false);assert.equal(question.input[0].content[1].type,'input_image');
  assert.ok(question.instructions.includes('Past simple'));assert.ok(question.input[0].content[0].text.includes('Yesterday I go.'));
  for(const changed of [{question:''},{question:'x'.repeat(4001)},{image:'https://untrusted.test/private'},{image:'data:image/svg+xml;base64,YWJj'},{image:'data:image/jpeg;base64,'+'a'.repeat(1000000)}])assert.throws(()=>service.coachQuestion({...body,question:'Explain',...changed}));
});

// Small real ZIP fixtures, without needing another archive dependency.
function zip(entries) {
  const records=[],directories=[];let offset=0;
  for(const [name,text] of Object.entries(entries)){
    const nameBytes=Buffer.from(name),raw=Buffer.from(text),compressed=deflateRawSync(raw);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(nameBytes.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
    const record=Buffer.concat([local,nameBytes,compressed]);records.push(record);directories.push(Buffer.concat([central,nameBytes]));offset+=record.length;
  }
  const directory=Buffer.concat(directories),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(records.length,8);end.writeUInt16LE(records.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...records,directory,end]);
}
test('PowerPoint text respects presentation order, not slide archive filenames',()=>{
  const slides=material.readCoachPptx(zip({
    'ppt/slides/slide1.xml':'<p:sld><a:t>Second &amp; final</a:t></p:sld>',
    'ppt/slides/slide2.xml':'<p:sld><a:t>First</a:t><a:t>What happened?</a:t></p:sld>',
    'ppt/presentation.xml':'<p:sldIdLst><p:sldId id="1" r:id="rId2"/><p:sldId id="2" r:id="rId1"/></p:sldIdLst>',
    'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>',
  }));
  assert.equal(slides[0].number,1);assert.equal(slides[0].text,'First\nWhat happened?');assert.equal(slides[1].text,'Second & final');
});
test('PowerPoint importer rejects corrupt archives, oversized inputs and decompression bombs',()=>{
  for(const bytes of [Buffer.from('not a pptx'),Buffer.alloc(3000001),zip({'hello.txt':'no slides'})])assert.throws(()=>material.readCoachPptx(bytes));
  const bomb=zip({'ppt/slides/slide1.xml':'x'.repeat(500001)});
  assert.throws(()=>material.readCoachPptx(bomb));
  const forged=Buffer.from(bomb);const central=forged.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));forged.writeUInt32LE(10,central+24);
  assert.throws(()=>material.readCoachPptx(forged));
});
test('private coaching route rejects student tokens and cross-origin requests before paid calls',async()=>{
  let payments=0,verifications=0,modelChecks=0;
  const {createHash}=await import('node:crypto');
  const route=load('src/app/api/live-coach/route.ts',{
    'node:crypto':{createHash},
    '@/lib/server/progress-transport':{postProgress:async(_endpoint,payload)=>{verifications++;return payload.session==='teacher-session'?{ok:true,students:[]}:{ok:false};}},
    '@/lib/server/google-http':{googleHttp:()=>{}},
    '@/lib/server/live-coach-service':service,
    '@/lib/server/coach-material':material,
  },{process:{env:{APPS_SCRIPT_URL:'https://example.test/progress',LIVE_COACH_ENABLED:'true',OPENAI_API_KEY:'synthetic-key'}},fetch:async url=>{if(String(url).includes('/v1/models/')){modelChecks++;return Response.json({id:'synthetic-model'});}payments++;return new Response('v=0\r\n');}});
  const req=(origin,payload)=>new Request('https://example.test/api/live-coach/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await route.POST(req('https://other.test',{...body,action:'connect'}))).status,403);
  assert.equal((await route.POST(req('https://example.test',{...body,code:'student',action:'connect'}))).status,403);
  assert.equal((await route.POST(req('https://example.test',{...body,token:'expired',action:'connect'}))).status,403);
  assert.equal(verifications,1);assert.equal(payments,0);
  const status=await route.POST(req('https://example.test',{...body,action:'status'}));
  assert.equal((await status.json()).available,true);assert.equal(payments,0);assert.equal(modelChecks,2);
  await route.POST(req('https://example.test',{...body,action:'status'}));assert.equal(modelChecks,2);
  const connected=await route.POST(req('https://example.test',{...body,action:'connect'}));
  assert.equal(connected.status,201);assert.equal(payments,1);
  const publicResult=JSON.stringify(await connected.json());assert.ok(!publicResult.includes('synthetic-key'));assert.match(publicResult,/v=0/);
});

test('failed model-access checks keep the coach unavailable without sending audio or exposing credentials',async()=>{
  const {createHash}=await import('node:crypto');
  for(const status of [401,403,404,429]){
    let paidCalls=0;
    const route=load('src/app/api/live-coach/route.ts',{
      'node:crypto':{createHash},
      '@/lib/server/progress-transport':{postProgress:async()=>({ok:true,students:[]})},
      '@/lib/server/google-http':{googleHttp:()=>{}},
      '@/lib/server/live-coach-service':service,
      '@/lib/server/coach-material':material,
    },{process:{env:{APPS_SCRIPT_URL:'https://example.test/progress',LIVE_COACH_ENABLED:'true',OPENAI_API_KEY:'synthetic-key'}},fetch:async url=>{if(!String(url).includes('/v1/models/'))paidCalls++;return Response.json({error:{code:'synthetic'}},{status});}});
    const request=new Request('https://example.test/api/live-coach/',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({...body,action:'status'})});
    const result=await route.POST(request),json=await result.json();
    assert.equal(result.status,503);assert.ok(!json.available);assert.equal(paidCalls,0);assert.ok(!JSON.stringify(json).includes('synthetic-key'));
  }
});

test('speaker estimates parse separately from feedback and malformed estimates safely stay unassigned',()=>{
  const value={...shared.coachRehearsal[0],speaker:'learner',speakerConfidence:'high'};
  for(const text of [JSON.stringify(value),JSON.stringify(value).slice(1,-1),'```json\n'+JSON.stringify(value)+'\n```']){
    assert.equal(shared.parseCoachSpeaker(text).role,'learner');
    assert.equal(shared.parseCoachSpeaker(text).confidence,'high');
    assert.equal(shared.parseCoachFeedback(text).heard,value.heard);
    assert.equal('speaker' in shared.parseCoachFeedback(text),false);
  }
  for(const extra of [{},{speaker:'administrator',speakerConfidence:'high'},{speaker:[],speakerConfidence:100}]){
    assert.equal(shared.parseCoachSpeaker(JSON.stringify({...shared.coachRehearsal[0],...extra})).role,'unknown');
  }
  assert.equal(shared.parseCoachSpeaker(JSON.stringify({...value,speakerConfidence:'certain'})).confidence,'low');
});

test('only a high learner estimate can retain a tentative correction and conflicting quotes still suppress it',()=>{
  const caption='Yesterday I go to the park with my brother.';
  const feedback={...shared.coachRehearsal[0],heard:caption,prompt:'What did you enjoy at the park?',next:'Invite one detail about the park.'};
  for(const [role,confidence] of [['teacher','high'],['mixed','high'],['unknown','low'],['learner','low']]){
    const result=shared.automaticCoachFeedback(feedback,caption,{role,confidence});
    assert.equal(result.correction,'');assert.equal(result.strength,'');
    assert.equal(result.prompt,feedback.prompt);
    assert.doesNotMatch(result.focus,/past simple/i);
    assert.doesNotMatch(result.uncertainty,/Confirm who spoke/);
  }
  const result=shared.automaticCoachFeedback(feedback,caption,{role:'learner',confidence:'high'});
  assert.equal(result.correction,feedback.correction);assert.equal(result.strength,'');
  assert.match(result.uncertainty,/not confirmed learner evidence/);
  const mismatch=shared.automaticCoachFeedback(feedback,'Yesterday I went to the park with my brother.',{role:'learner',confidence:'high'});
  assert.equal(mismatch.correction,'');assert.match(mismatch.uncertainty,/Either may have misheard/);
});

test('fast and balanced session settings change endpoint timing without downgrading the audio model',()=>{
  for(const [responseSpeed,milliseconds] of [['fast',650],['balanced',1100]]){
    const session=service.coachSession({...body,context:{...context,responseSpeed}});
    assert.equal(session.model,'gpt-realtime-2.1');
    assert.equal(session.audio.input.turn_detection.silence_duration_ms,milliseconds);
    assert.equal(session.audio.input.turn_detection.create_response,false);
  }
  for(const responseSpeed of [null,'fastest',100,{}])assert.throws(()=>shared.coachContext({...context,responseSpeed}));
});


test('lesson maps are validated and estimated page fields never become feedback or confirmed completion',()=>{
 const lessonPosition={page:1,total:3,mode:'auto',index:'PAGE 1: Cover\nPAGE 2: School\nPAGE 3: Volcano'};
 assert.equal(shared.coachContext({...context,lessonPosition}).lessonPosition.index,lessonPosition.index);
 for(const changed of [{page:0},{page:4},{total:301},{mode:['auto']},{index:'x'.repeat(40001)}])assert.throws(()=>shared.coachContext({...context,lessonPosition:{...lessonPosition,...changed}}));
 const text=JSON.stringify({...shared.coachRehearsal[0],lessonPage:'3',lessonConfidence:'high'});
 assert.equal(shared.parseCoachPosition(text).page,3);assert.equal(shared.parseCoachPosition(text).confidence,'high');
 assert.equal('lessonPage' in shared.parseCoachFeedback(text),false);
 assert.equal(shared.parseCoachPosition(JSON.stringify({...shared.coachRehearsal[0],lessonPage:3,lessonConfidence:'high'})).page,0);
});
