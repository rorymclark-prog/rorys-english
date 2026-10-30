import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

function load(file,dependencies={},globals={}){
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,crypto:webcrypto,Date,Blob,Map,Set,AbortController,process:{env:{}},
    require:name=>{assert.ok(name in dependencies,`Missing test dependency: ${name}`);return dependencies[name];},...globals,
  });
  return exports;
}
const {correctCoachSpeaker}=load('src/lib/coach-evidence.ts');
const archive=load('src/lib/coach-archive.ts'),coach=load('src/lib/live-coach.ts');
const coachTurns=load('src/lib/coach-turns.ts',{'./live-coach':coach});
const context={learner:'Demo learner',unit:'Practice',task:'Yesterday',objective:'Past forms',source:'',slide:'Slide 1'};
const feedback={heard:'Yesterday I go home.',strength:'Clear message',focus:'STALE COACHING',correction:'Yesterday I went home.',prompt:'What happened next?',next:'Try again.',uncertainty:''};
const turn=(id,role,text,extra={})=>({id,role,text,at:'2026-10-22T12:00:00Z',...extra});
const entry=(id,sourceTurnId,extra={})=>({id,sourceTurnId,at:'2026-10-22T12:00:01Z',context,feedback,...extra});
const ids=items=>Array.from(items,item=>item.id);

test('speaker correction removes every linked coaching entry and AI turn while preserving original words and unrelated evidence',()=>{
  const snapshot={context,turns:[turn('caption','learner','Yesterday I go home.'),turn('ai-1','ai','STALE COACHING',{sourceTurnId:'caption'}),turn('ai-2','ai','ANOTHER STALE SUGGESTION',{sourceTurnId:'caption'}),turn('other','learner','I go home.'),turn('other-ai','ai','KEEP THIS COACHING',{sourceTurnId:'other'}),turn('private-ai','ai','KEEP PRIVATE ANSWER')],entries:[entry('stale-1','caption'),entry('stale-2','caption'),entry('other-entry','other'),entry('unlinked',undefined)]};
  const before=JSON.stringify(snapshot),corrected=correctCoachSpeaker(snapshot,'caption','teacher');
  assert.deepEqual(ids(corrected.turns),['caption','other','other-ai','private-ai']);
  assert.deepEqual(ids(corrected.entries),['other-entry','unlinked']);
  assert.equal(corrected.turns[0].role,'teacher');assert.equal(corrected.turns[0].text,'Yesterday I go home.');
  assert.equal(corrected.turns[1],snapshot.turns[3]);assert.equal(corrected.entries[0],snapshot.entries[2]);
  assert.equal(JSON.stringify(snapshot),before,'correction must not mutate the original snapshot');
  const unassigned=correctCoachSpeaker(corrected,'caption','unknown');
  assert.equal(unassigned.turns[0].role,'unknown');assert.equal(unassigned.turns[0].text,'Yesterday I go home.');
});

test('missing, unchanged and AI speaker labels are no-ops',()=>{
  const snapshot={context,turns:[turn('caption','learner','My original words'),turn('ai','ai','Advice')],entries:[]};
  assert.equal(correctCoachSpeaker(snapshot,'missing','teacher'),snapshot);
  assert.equal(correctCoachSpeaker(snapshot,'caption','learner'),snapshot);
  assert.equal(correctCoachSpeaker(snapshot,'ai','teacher'),snapshot);
});

test('new archived lessons and downloaded notes retain corrected speakers and exclude stale coaching',()=>{
  const snapshot={context,turns:[turn('caption','learner','Yesterday I go home.'),turn('stale-ai','ai','STALE COACHING',{sourceTurnId:'caption'}),turn('other','learner','My own answer.'),turn('other-ai','ai','KEEP THIS COACHING',{sourceTurnId:'other'})],entries:[entry('stale','caption'),entry('keep','other',{feedback:{...feedback,heard:'My own answer.',focus:'KEEP THIS COACHING',correction:''}})]};
  const saved=archive.makeArchivedLesson('demo',correctCoachSpeaker(snapshot,'caption','teacher'));
  const notes=archive.lessonNotes(saved);
  assert.match(notes,/Rory\nYesterday I go home\./);assert.match(notes,/Demo learner\nMy own answer\./);
  assert.match(notes,/KEEP THIS COACHING/);assert.doesNotMatch(notes,/STALE COACHING|Yesterday I went home/);
  assert.deepEqual(ids(saved.entries),['keep']);assert.equal(saved.turns[0].role,'teacher');
});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
// Run the component's real event handlers using deterministic browser adapters.
// Every request, audio stream and WebRTC event below is local to this test.
function liveHarness({delayTyped=false,audioMode='room',speaker='learner'}={}){
  const hooks=[],effects=[],downloads=[],requests=[],audioRequests=[],responseRequests=new Map(),intervals=new Map();let cursor=0,ui,dataChannel,releaseTyped,timerSequence=0;
  let audioLevels={microphone:0,call:0};
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
  const react={
    useState(initial){const index=cursor++,hook=hooks[index]||={value:initial};return [hook.value,value=>{hook.value=typeof value==='function'?value(hook.value):value;}];},
    useRef(initial){return hooks[cursor++]||={current:initial};},
    useCallback(fn,deps){const index=cursor++,previous=hooks[index];if(previous&&same(previous.deps,deps))return previous.fn;hooks[index]={fn,deps};return fn;},
    useEffect(fn,deps){const index=cursor++,previous=hooks[index];if(!previous||!same(previous.deps,deps))effects.push(()=>{previous?.cleanup?.();hooks[index]={deps,cleanup:fn()};});},
  };
  class Peer{
    addTrack(){}
    createDataChannel(){dataChannel={readyState:'open',sent:[],send(text){this.sent.push(JSON.parse(text));},close(){}};return dataChannel;}
    async createOffer(){return {sdp:'synthetic local SDP'};}
    async setLocalDescription(){}
    async setRemoteDescription(){dataChannel.onopen();}
    close(){}
  }
  const microphone={getAudioTracks:()=>[{stop(){}}],getTracks:()=>[]};
  const jsx=(type,props)=>({type,props:props||{}}),Archive=()=>null;
  const component=load('src/components/views/LiveTeachingCoach.tsx',{
    react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/live-coach':coach,'@/app/teacher/live-coach.css':{},
    '@/components/CoachSlidePresenter':{default:()=>null},'@/components/CoachLessonArchive':{default:Archive},
    '@/lib/coach-evidence':{correctCoachSpeaker},
    '@/lib/coach-turns':coachTurns,
    '@/lib/lesson-audio':{LessonAudioInput:class{async acquire(mode){audioRequests.push(mode);return microphone;}async connectCall(){return true;}levels(){return audioLevels;}close(){}disconnectCall(){}},releaseLessonAudio(){}},
  },{
    navigator:{mediaDevices:{getUserMedia:async()=>microphone}},RTCPeerConnection:Peer,
    window:{RTCPeerConnection:Peer,addEventListener(){},removeEventListener(){}},
    document:{addEventListener(){},removeEventListener(){},createElement:()=>({click(){}})},
    URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:notes';},revokeObjectURL(){}},
    setInterval(fn,ms){const id=++timerSequence;intervals.set(id,{fn,ms});return id;},clearInterval(id){intervals.delete(id);},setTimeout:()=>1,clearTimeout(){},
    fetch:async(_url,options)=>{
      const body=JSON.parse(options.body);requests.push(body);
      if(body.action==='analyse'&&delayTyped)await new Promise(resolve=>{releaseTyped=resolve;});
      return {ok:true,json:async()=>body.action==='status'?{available:true}:body.action==='connect'?{sdp:'synthetic answer'}:{feedback}};
    },
  }).default;
  function render(){cursor=0;ui=component({token:'synthetic teacher token',learners:[{code:'demo',name:'Demo learner'}],onBack(){}});while(effects.length)effects.shift()();return ui;}
  function walk(predicate,node){if(Array.isArray(node))return node.map(child=>walk(predicate,child)).find(Boolean);if(!node||typeof node!=='object')return undefined;return predicate(node)?node:walk(predicate,node.props?.children);}
  const find=predicate=>walk(predicate,ui),button=text=>find(node=>node.type==='button'&&node.props.children===text);
  const snapshot=()=>find(node=>node.type===Archive).props.snapshot;
  async function settle(){await tick();render();}
  async function prepare(){render();await settle();find(node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});render();}
  async function start(){
    await prepare();
    if(audioMode==='online'){
      find(node=>node.type==='select'&&node.props.value==='room').props.onChange({target:{value:'online'}});render();
      assert.equal(button('Start listening').props.disabled,true,'online capture cannot start before the call tab is connected');
      button('Connect call audio').props.onClick();await settle();
    }
    if(speaker!==null)find(node=>node.type==='select'&&node.props.value==='unknown').props.onChange({target:{value:speaker}});render();button('Start listening').props.onClick();await settle();
  }
  const event=value=>{dataChannel.onmessage({data:JSON.stringify(value)});render();};
  function responseStarted(responseId,turnId){
    const request=dataChannel.sent.findLast(item=>item.type==='response.create'&&item.response.metadata.source_turn_id===turnId);
    assert.ok(request,`No explicit coaching request for ${turnId}`);responseRequests.set(responseId,request);
    event({type:'response.created',response:{id:responseId,metadata:request.response.metadata}});
  }
  function caption(id,text,responseId){event({type:'input_audio_buffer.speech_started',item_id:id});event({type:'input_audio_buffer.committed',item_id:id});event({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});if(responseId)responseStarted(responseId,id);}
  function done(responseId,focus='STALE COACHING',overrides={}){
    const request=responseRequests.get(responseId);assert.ok(request);
    const source=snapshot().turns.find(item=>item.id===request.response.metadata.source_turn_id);
    event({type:'response.done',response:{id:responseId,metadata:request.response.metadata,status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...feedback,heard:source.text,focus,...overrides})}]}]}});
  }
  function relabel(id,role){const original=snapshot().turns.find(item=>item.id===id);const article=find(node=>node.type==='article'&&walk(child=>child.type==='p'&&child.props.children===original.text,node));const select=walk(node=>node.type==='select',article);assert.ok(select);select.props.onChange({target:{value:role}});render();}
  const pulse=ms=>{for(const timer of [...intervals.values()])if(timer.ms===ms)timer.fn();render();};
  return {prepare,start,caption,done,responseStarted,event,relabel,snapshot,button,find,render,settle,downloads,requests,audioRequests,pulse,setAudioLevels:value=>{audioLevels=value;},archiveProps:()=>find(node=>node.type===Archive).props,sent:()=>dataChannel.sent,releaseTyped:()=>releaseTyped()};
}

test('live captions link both coaching surfaces to their source and correction reaches archive props and exported notes',async()=>{
  const h=liveHarness();await h.start();
  h.caption('first-caption','Yesterday I go home.','response-1');h.done('response-1');
  h.caption('other-caption','My own answer.','response-2');h.done('response-2','KEEP THIS COACHING');
  assert.equal(h.snapshot().entries.find(item=>item.sourceTurnId==='first-caption').feedback.focus,'STALE COACHING');
  assert.equal(h.snapshot().turns.find(item=>item.role==='ai'&&item.sourceTurnId==='first-caption').text.includes('STALE COACHING'),true);
  h.relabel('first-caption','teacher');
  const corrected=h.snapshot();assert.equal(corrected.turns[0].role,'teacher');assert.equal(corrected.turns[0].text,'Yesterday I go home.');
  assert.equal(corrected.entries.length,1);assert.equal(corrected.entries[0].sourceTurnId,'other-caption');
  assert.equal(corrected.turns.filter(item=>item.role==='ai').length,1);
  h.button('Export notes').props.onClick();const notes=await h.downloads[0].text();
  assert.match(notes,/Rory\nYesterday I go home\./);assert.match(notes,/KEEP THIS COACHING/);assert.doesNotMatch(notes,/STALE COACHING/);
  const saved=archive.makeArchivedLesson('demo',corrected);assert.equal(saved.entries.length,1);assert.equal(saved.turns[0].role,'teacher');
});

test('feedback arriving after a live caption was relabelled cannot recreate invalidated evidence',async()=>{
  const h=liveHarness();await h.start();h.caption('caption','Yesterday I go home.','late-response');h.relabel('caption','teacher');h.done('late-response');
  assert.equal(h.snapshot().entries.length,0);assert.equal(h.snapshot().turns.length,1);assert.equal(h.snapshot().turns[0].role,'teacher');
  h.caption('next-caption','My own answer.','next-response');h.done('next-response','KEEP THIS COACHING');
  assert.equal(h.snapshot().entries.length,1);assert.equal(h.snapshot().entries[0].sourceTurnId,'next-caption');
});

test('typed-answer coaching is invalidated by its speaker correction, including responses still in flight',async()=>{
  const h=liveHarness({delayTyped:true});await h.prepare();
  h.find(node=>node.type==='textarea'&&node.props.placeholder==='Keep the learner’s original wording and mistakes.').props.onChange({target:{value:'Yesterday I go home.'}});h.render();
  h.button('Get teaching feedback').props.onClick();await h.settle();
  const original=h.snapshot().turns.find(item=>item.role==='learner');assert.ok(original);
  h.relabel(original.id,'teacher');h.releaseTyped();await h.settle();
  assert.equal(h.snapshot().turns[0].text,'Yesterday I go home.');assert.equal(h.snapshot().turns[0].role,'teacher');
  assert.equal(h.snapshot().entries.length,0);assert.equal(h.snapshot().turns.filter(item=>item.role==='ai').length,0);
});

test('completed typed feedback retains its source link and is removed when the original speaker is corrected',async()=>{
  const h=liveHarness();await h.prepare();
  h.find(node=>node.type==='textarea'&&node.props.placeholder==='Keep the learner’s original wording and mistakes.').props.onChange({target:{value:'Yesterday I go home.'}});h.render();
  h.button('Get teaching feedback').props.onClick();await h.settle();
  const original=h.snapshot().turns.find(item=>item.role==='learner');assert.ok(original);
  assert.equal(h.snapshot().entries[0].sourceTurnId,original.id);
  assert.equal(h.snapshot().turns.find(item=>item.role==='ai').sourceTurnId,original.id);
  h.relabel(original.id,'unknown');
  assert.equal(h.snapshot().turns.length,1);assert.equal(h.snapshot().turns[0].role,'unknown');
  assert.equal(h.snapshot().turns[0].text,'Yesterday I go home.');assert.equal(h.snapshot().entries.length,0);
});

test('duplicate final ASR retains the selected learner speaker and cannot duplicate captions or requests',async()=>{
  const h=liveHarness();await h.start();h.caption('same-caption','We played a game.','one-response');
  h.event({type:'conversation.item.input_audio_transcription.completed',item_id:'same-caption',transcript:'We played a game.'});
  assert.equal(h.snapshot().turns.length,1);assert.equal(h.snapshot().turns[0].role,'learner');
  assert.equal(h.sent().filter(item=>item.type==='response.create').length,1);
  h.done('one-response');assert.equal(h.snapshot().entries[0].sourceTurnId,'same-caption');
});

test('delayed ASR and rapidly alternating speakers keep explicit responses attached to the right caption',async()=>{
  const h=liveHarness();await h.start();
  h.event({type:'input_audio_buffer.speech_started',item_id:'delayed-learner'});
  h.event({type:'input_audio_buffer.committed',item_id:'delayed-learner'});
  h.find(node=>node.type==='select'&&node.props.value==='learner').props.onChange({target:{value:'teacher'}});h.render();
  h.caption('rory-explanation','Now tell me what happened next.');
  assert.equal(h.sent().filter(item=>item.type==='response.create').length,0);
  h.event({type:'conversation.item.input_audio_transcription.completed',item_id:'delayed-learner',transcript:'I arrived at noon.'});
  h.responseStarted('learner-response','delayed-learner');
  assert.equal(h.snapshot().turns.find(item=>item.id==='delayed-learner').role,'learner');
  assert.equal(h.sent().filter(item=>item.type==='response.create').length,1,'teacher feedback waits for learner feedback to finish');
  h.done('learner-response','Learner feedback');
  assert.equal(h.snapshot().entries[0].sourceTurnId,'delayed-learner');assert.equal(h.snapshot().entries[0].context.learner,'Demo learner');
  h.responseStarted('teacher-response','rory-explanation');h.done('teacher-response','Teacher context');
  const teacher=h.snapshot().entries.find(item=>item.sourceTurnId==='rory-explanation');
  assert.equal(teacher.context.learner,'Rory');assert.equal(teacher.feedback.correction,'');
});

test('teacher and unassigned audio cannot display grammar coaching even when the model ignores its speaker instructions',async()=>{
  const h=liveHarness();await h.start();
  h.find(node=>node.type==='select'&&node.props.value==='learner').props.onChange({target:{value:'teacher'}});h.render();
  h.caption('teacher-caption','Yesterday I go home.','teacher-response');h.done('teacher-response','Correct the past tense now');
  const teacher=h.snapshot().entries[0];
  assert.equal(teacher.context.learner,'Rory');assert.match(teacher.feedback.focus,/Teacher context only/);
  for(const field of ['correction','strength','prompt','next'])assert.equal(teacher.feedback[field],'');
  h.find(node=>node.type==='select'&&node.props.value==='teacher').props.onChange({target:{value:'unknown'}});h.render();
  h.caption('unassigned-caption','Yesterday I go home.','unassigned-response');h.done('unassigned-response','Correct the past tense now');
  const unassigned=h.snapshot().entries[0];
  assert.equal(unassigned.context.learner,'Lesson conversation');assert.doesNotMatch(unassigned.feedback.focus,/Confirm who spoke/);
  for(const field of ['correction','strength'])assert.equal(unassigned.feedback[field],'');
  assert.ok(unassigned.feedback.prompt);assert.ok(unassigned.feedback.next);
  assert.ok(!h.snapshot().turns.filter(item=>item.role==='ai').some(item=>item.text.includes('Correct the past tense now')));
});

test('shared online conversation keeps useful prompts on both surfaces without assigning either voice to the learner',async()=>{
  const h=liveHarness({audioMode:'online',speaker:'unknown'});await h.start();
  assert.deepEqual(h.audioRequests,['online']);
  assert.equal(h.requests.find(request=>request.action==='connect').context.audioMode,'online');
  h.caption('mixed-one','I arrived with a chocolate cake. Zoe looked annoyed.','mixed-response');
  h.done('mixed-response','The learner needs a past-tense correction.',{prompt:'Why did Zoe look annoyed?',next:'Invite one detail about what happened before lunch.'});
  const first=h.snapshot().entries[0],ai=h.snapshot().turns.find(item=>item.role==='ai');
  assert.equal(first.context.learner,'Lesson conversation');assert.equal(first.context.audioMode,'online');
  assert.equal(first.feedback.heard,'I arrived with a chocolate cake. Zoe looked annoyed.');
  assert.equal(first.feedback.prompt,'Why did Zoe look annoyed?');assert.equal(first.feedback.next,'Invite one detail about what happened before lunch.');
  assert.equal(first.feedback.correction,'');assert.equal(first.feedback.strength,'');
  assert.match(first.feedback.uncertainty,/Speaker identity is unconfirmed/);
  assert.equal(first.sourceTurnId,'mixed-one');assert.equal(ai.sourceTurnId,'mixed-one');
  assert.match(ai.text,/Ask: Why did Zoe look annoyed/);assert.doesNotMatch(ai.text,/past-tense correction|Yesterday I went/);
  assert.equal(h.snapshot().turns.find(item=>item.id==='mixed-one').role,'unknown');

  h.caption('mixed-two','The models were on the kitchen table.','next-mixed-response');
  const request=h.sent().findLast(item=>item.type==='response.create');
  assert.match(request.response.input[1].content[0].text,/Why did Zoe look annoyed/,'the next turn sees accepted earlier suggestions to avoid repeating them');
  h.done('next-mixed-response','Context only',{prompt:'Where could the models go?',next:'Ask about a practical solution.'});
  h.relabel('mixed-one','teacher');
  assert.equal(h.snapshot().entries.length,1);assert.equal(h.snapshot().entries[0].sourceTurnId,'mixed-two');
  h.button('Export notes').props.onClick();const notes=await h.downloads[0].text();
  assert.match(notes,/Rory\nI arrived with a chocolate cake/);assert.match(notes,/Where could the models go/);
  assert.doesNotMatch(notes,/Why did Zoe look annoyed/,'speaker correction removes the linked suggestion from exported history');
});

test('shared online coaching suppresses model grammar assessment and retains quote-conflict warnings',async()=>{
  const h=liveHarness({audioMode:'online',speaker:'unknown'});await h.start();
  h.caption('mixed-correct','Yesterday I went to the park.','misheard-response');
  h.done('misheard-response','Correct the verb.',{heard:'Yesterday I go to the park.',prompt:'What is the past of go?',next:'Ask for a correct verb form.',uncertainty:'The learner lacks fluency.'});
  const accepted=h.snapshot().entries[0];
  assert.equal(accepted.feedback.heard,'Yesterday I went to the park.');
  assert.equal(accepted.feedback.correction,'');assert.equal(accepted.feedback.strength,'');
  assert.equal(accepted.feedback.prompt,'What happened next, and why?');
  assert.match(accepted.feedback.next,/Check what was actually said/);
  assert.match(accepted.feedback.uncertainty,/Either may have misheard/);assert.match(accepted.feedback.uncertainty,/Speaker identity is unconfirmed/);
  assert.doesNotMatch(JSON.stringify(accepted.feedback),/lacks fluency|Correct the verb|past of go|correct verb/);
});

test('independent microphone and call signal meters remain available when AI ends but recording continues',async()=>{
  const h=liveHarness({audioMode:'online',speaker:'unknown'});await h.start();
  h.setAudioLevels({microphone:.35,call:.72});h.pulse(150);
  const meter=label=>h.find(node=>node.type==='meter'&&node.props['aria-label']===label);
  assert.equal(meter('My microphone signal').props.value,.35);assert.equal(meter('Student call audio signal').props.value,.72);
  h.archiveProps().onBusy(true);h.render();
  h.button('End listening').props.onClick();h.render();
  h.setAudioLevels({microphone:.67,call:.18});h.pulse(150);
  assert.equal(meter('My microphone signal').props.value,.67);assert.equal(meter('Student call audio signal').props.value,.18);
  h.archiveProps().onBusy(false);h.render();h.render();
  assert.equal(meter('My microphone signal').props.value,0);assert.equal(meter('Student call audio signal').props.value,0);
  assert.equal(h.audioRequests.length,1,'meter updates must not acquire additional audio devices');
});

test('default automatic and fast mode label alternating voices without manual clicks and preserve estimated provenance',async()=>{
  const h=liveHarness({speaker:null});await h.start();
  const connection=h.requests.find(request=>request.action==='connect');
  assert.equal(connection.context.responseSpeed,'fast');
  assert.ok(h.find(node=>node.type==='select'&&node.props.value==='unknown'));
  h.caption('rory','What did you do yesterday?','rory-response');
  h.done('rory-response','Correct the grammar.',{speaker:'teacher',speakerConfidence:'high',prompt:'Where did you go?',next:'Invite a detail about the place.'});
  let snapshot=h.snapshot();
  assert.equal(snapshot.turns[0].role,'unknown');assert.equal(snapshot.turns[0].speakerEstimate.role,'teacher');
  assert.equal(snapshot.entries[0].feedback.correction,'');
  assert.match(snapshot.entries[0].context.learner,/Rory · AI estimate/);
  h.caption('student','Yesterday I go home.','student-response');
  h.done('student-response','Past simple',{speaker:'learner',speakerConfidence:'high'});
  snapshot=h.snapshot();
  const student=snapshot.turns.find(turn=>turn.id==='student');
  assert.equal(student.role,'unknown');assert.equal(student.speakerEstimate.role,'learner');
  assert.equal(snapshot.entries[0].feedback.correction,'Yesterday I went home.');
  assert.match(snapshot.entries[0].feedback.uncertainty,/not confirmed learner evidence/);
  assert.equal(h.requests.filter(request=>request.action==='connect').length,1);
  const request=h.sent().findLast(item=>item.type==='response.create');
  assert.equal(request.response.input[2].id,'rory','earlier audio is sent for voice comparison');
  assert.match(request.response.input[1].content[0].text,/unconfirmed AI estimate/);
  h.button('Export notes').props.onClick();
  assert.match(await h.downloads[0].text(),/Demo learner · AI estimate/);
  const saved=archive.makeArchivedLesson('demo',snapshot);
  assert.match(archive.lessonNotes(saved),/Rory · AI estimate \(unconfirmed\)/);
  assert.equal(saved.turns.find(turn=>turn.id==='student').role,'unknown');
  h.relabel('student','teacher');
  assert.equal(h.snapshot().turns.find(turn=>turn.id==='student').speakerEstimate,undefined);
  assert.ok(!h.snapshot().entries.some(entry=>entry.sourceTurnId==='student'));
});

test('an estimate can be cleared without confirming a speaker and late output cannot restore a corrected role',async()=>{
  const h=liveHarness({speaker:null});await h.start();
  h.caption('mixed','Tell me. Yesterday I go home.','mixed-response');
  h.done('mixed-response','Correct now',{speaker:'mixed',speakerConfidence:'high'});
  assert.equal(h.snapshot().entries[0].feedback.correction,'');
  h.relabel('mixed','unknown');
  assert.equal(h.snapshot().turns[0].speakerEstimate,undefined);assert.equal(h.snapshot().entries.length,0);
  h.caption('late','That is the past tense.','late-response');h.relabel('late','teacher');
  h.done('late-response','Wrong teacher attribution',{speaker:'learner',speakerConfidence:'high'});
  assert.equal(h.snapshot().turns.find(turn=>turn.id==='late').role,'teacher');
  assert.equal(h.snapshot().turns.find(turn=>turn.id==='late').speakerEstimate,undefined);
  assert.equal(h.snapshot().entries.length,0);
});

test('response speed can change during the same listening session without restarting or opening a new microphone',async()=>{
  const h=liveHarness({speaker:null});await h.start();
  h.find(node=>node.type==='select'&&node.props.value==='fast').props.onChange({target:{value:'balanced'}});h.render();
  let update=h.sent().findLast(item=>item.type==='session.update');
  assert.equal(update.session.audio.input.turn_detection.silence_duration_ms,1100);
  h.find(node=>node.type==='select'&&node.props.value==='balanced').props.onChange({target:{value:'fast'}});h.render();
  update=h.sent().findLast(item=>item.type==='session.update');
  assert.equal(update.session.audio.input.turn_detection.silence_duration_ms,650);
  assert.equal(h.audioRequests.length,1);assert.equal(h.requests.filter(request=>request.action==='connect').length,1);
});
