import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
function storage() {
  const data={};
  Object.defineProperties(data,{
    getItem:{value:key=>data[key]??null},setItem:{value:(key,value)=>{data[key]=String(value);}},
    removeItem:{value:key=>{delete data[key];}},key:{value:i=>Object.keys(data)[i]??null},length:{get:()=>Object.keys(data).length},
  });return data;
}
function fixture() {
  const localStorage=storage(),sessionStorage=storage(),sent=[];
  const window={localStorage,sessionStorage,location:{pathname:'/s/learner/'},dispatchEvent(){}};
  const cache=new Map();
  function load(file) {
    file=path.resolve(file);if(cache.has(file))return cache.get(file);
    const exports={};cache.set(file,exports);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{exports,window,localStorage,sessionStorage,Date,Set,Event:class{},CustomEvent:class{},crypto:{randomUUID:()=>"test-event"},navigator:{onLine:true},process:{env:{NEXT_PUBLIC_SYNC_URL:'/api/service',NEXT_PUBLIC_FIREBASE_API_KEY:'enabled'}},AbortController,setTimeout:()=>0,clearTimeout(){},fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,submissions:[]})};},require:name=>{assert.ok(name.startsWith('.'),'unexpected module '+name);return load(path.resolve(path.dirname(file),name+'.ts'));}});
    return exports;
  }
  const preview=load('src/lib/student-preview.ts');
  const teacher={role:'teacher',token:'synthetic-teacher-session',expires:Date.now()+60000};
  return {preview,teacher,window,localStorage,sessionStorage,sent,load,signIn(){sessionStorage.setItem('re_session_v2___teacher__',JSON.stringify(teacher));}};
}
test('student preview requires a current teacher session and stays scoped to the selected route',()=>{
  const f=fixture();assert.equal(f.preview.startStudentPreview('learner'),false);
  f.sessionStorage.setItem('re_session_v2___teacher__',JSON.stringify({...f.teacher,role:'student'}));
  assert.equal(f.preview.startStudentPreview('learner'),false);
  f.signIn();assert.equal(f.preview.startStudentPreview('learner'),true);
  assert.equal(f.preview.isStudentPreview('learner'),true);
  assert.equal(f.preview.isStudentPreview('other'),false);
  f.window.location.pathname='/teacher/';assert.equal(f.preview.isStudentPreview(),false);
  f.window.location.pathname='/s/learner/homework/';assert.equal(f.preview.isStudentPreview(),true);
});
test('preview reads use teacher authentication even when Firebase is enabled; mutations never reach the network',async()=>{
  const f=fixture();f.signIn();f.preview.startStudentPreview('learner');
  const api=f.load('src/lib/api.ts');
  assert.equal((await api.authed('learner',{action:'submissions'})).ok,true);
  assert.equal(f.sent[0].session,f.teacher.token);assert.equal(f.sent[0].preview,true);assert.equal(f.sent[0].code,'learner');
  for(const action of ['submit','event','ai','teacherReview','teacherAccess','logout'])assert.equal((await api.authed('learner',{action})).ok,false);
  assert.equal(f.sent.length,1);
  f.teacher.expires=Date.now()-1;f.signIn();
  assert.equal((await api.authed('learner',{action:'submissions'})).authRequired,true);
  assert.equal(f.preview.isStudentPreview(),true);assert.equal(f.sent.length,1);
});
test('preview preserves learner drafts and queued work, while allowing separate teacher appearance preferences',async()=>{
  const f=fixture();f.signIn();f.preview.startStudentPreview('learner');
  f.localStorage.setItem('learner_unit_hw1_answer','original student draft');
  f.localStorage.setItem('re_outbox_v2_learner:old',JSON.stringify({id:'old',code:'learner',action:'submit'}));
  const sync=f.load('src/lib/sync.ts'),progress=f.load('src/lib/storage.ts');
  assert.equal((await sync.deliver({action:'submit',id:'new',code:'learner'})).ok,false);
  await sync.drainSyncQueue();assert.equal(f.sent.length,0);assert.equal(sync.outbox('learner').length,0);
  assert.ok(f.localStorage.getItem('re_outbox_v2_learner:old'));assert.equal(f.localStorage.getItem('re_outbox_v2_learner:new'),null);
  progress.setTaskValue('learner','unit',1,'answer','teacher typing');progress.resetProgress('learner');
  assert.equal(f.localStorage.getItem('learner_unit_hw1_answer'),'original student draft');
  progress.saveSettings('__teacher__',{theme:'light',textScale:'xl'});
  assert.equal(progress.getSettings('__teacher__').theme,'light');assert.equal(progress.getSettings('__teacher__').textScale,'xl');
  progress.saveSettings('learner',{theme:'dark',textScale:'large'});assert.equal(f.localStorage.getItem('learner_settings'),null);
  f.preview.endStudentPreview();progress.setTaskValue('learner','unit',1,'answer','student revision');
  assert.equal(f.localStorage.getItem('learner_unit_hw1_answer'),'student revision');
});
