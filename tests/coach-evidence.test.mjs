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
function liveHarness({delayTyped=false}={}){
  const hooks=[],effects=[],downloads=[],requests=[];let cursor=0,ui,dataChannel,releaseTyped;
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
    '@/lib/lesson-audio':{LessonAudioInput:class{async acquire(){return microphone;}close(){}},releaseLessonAudio(){}},
  },{
    navigator:{mediaDevices:{getUserMedia:async()=>microphone}},RTCPeerConnection:Peer,
    window:{RTCPeerConnection:Peer,addEventListener(){},removeEventListener(){}},
    document:{addEventListener(){},removeEventListener(){},createElement:()=>({click(){}})},
    URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:notes';},revokeObjectURL(){}},
    setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},
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
  async function start(){await prepare();find(node=>node.type==='select'&&node.props.value==='unknown').props.onChange({target:{value:'learner'}});render();button('Start listening').props.onClick();await settle();}
  const event=value=>{dataChannel.onmessage({data:JSON.stringify(value)});render();};
  function caption(id,text,responseId){event({type:'input_audio_buffer.speech_started',item_id:id});event({type:'input_audio_buffer.committed',item_id:id});event({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});event({type:'response.created',response:{id:responseId}});}
  function done(responseId,focus='STALE COACHING'){event({type:'response.done',response:{id:responseId,status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...feedback,focus})}]}]}});}
  function relabel(id,role){const original=snapshot().turns.find(item=>item.id===id);const article=find(node=>node.type==='article'&&walk(child=>child.type==='p'&&child.props.children===original.text,node));const select=walk(node=>node.type==='select',article);assert.ok(select);select.props.onChange({target:{value:role}});render();}
  return {prepare,start,caption,done,relabel,snapshot,button,find,render,settle,downloads,requests,releaseTyped:()=>releaseTyped()};
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
