import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/coach-library.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:api,ArrayBuffer,URL,Map,Number,Error});
const origin = api.COACH_LIBRARY_ORIGIN;
const pack = {id:'Ferdi/Unit01',learner:'Ferdi',title:'Family life',focus:'Past simple',format:'Unit pack'};

function hostFixture() {
  const listeners = new Set(), timers = new Map(), intervals = new Map(), sent = [];
  let sequence = 0, timer = 0, url = '';
  const popup = {closed:false,focus(){},close(){this.closed=true;},postMessage(message,target){sent.push({message,target});}};
  const host = {
    location:{origin:'https://english.example'},crypto:{randomUUID:()=>`nonce-${++sequence}`},
    addEventListener(type,listener){assert.equal(type,'message');listeners.add(listener);},
    removeEventListener(type,listener){assert.equal(type,'message');listeners.delete(listener);},
    setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout(id){timers.delete(id);},
    setInterval(fn){intervals.set(++timer,fn);return timer;},clearInterval(id){intervals.delete(id);},
    open(next){url=next;popup.closed=false;return popup;},
  };
  const emit = (data,changed={}) => { for (const listener of listeners) listener({origin,source:popup,data,...changed}); };
  return {host,popup,timers,intervals,sent,emit,get url(){return url;},get session(){return new URLSearchParams(new URL(url).hash.slice(1)).get('session');},listeners};
}

test('private catalogue and context require the exact selected learner and lesson', () => {
  const catalogue = {edition:'20 October',packs:[{...pack,files:[{name:'Deck.pptx',label:'PowerPoint',type:'pptx',size:1000}]}]};
  assert.equal(api.readLibraryCatalogue(catalogue,'Ferdi').packs.length,1);
  assert.throws(()=>api.readLibraryCatalogue(catalogue,'Valentin'));
  assert.throws(()=>api.readLibraryCatalogue({...catalogue,packs:[{...pack,files:[{name:'Bad',label:'bad',type:'pdf',size:Infinity}]}]},'Ferdi'));
  const context = {pack,edition:'20 October',guide:'Current exercise',teacherNotes:'Older baseline answer',notesHistorical:true};
  assert.equal(api.readLibraryContext(context,'Ferdi',pack.id).guide,'Current exercise');
  assert.throws(()=>api.readLibraryContext(context,'Ferdi','other lesson'));
  assert.throws(()=>api.readLibraryContext({...context,guide:'x'.repeat(500001)},'Ferdi',pack.id));
  const reference = api.libraryReference(context);
  assert.match(reference,/Current exercise/);
  assert.doesNotMatch(reference,/Older baseline answer/);
  assert.match(reference,/not evidence of work completed/);
  assert.doesNotMatch(api.libraryReference({...context,guide:''}),/Older baseline answer/);
  assert.ok(api.libraryReference({...context,guide:'x'.repeat(500000)}).length<=12000);
});

test('binary lesson material requires bounded genuine ArrayBuffer bytes, matching size, MIME and learner', () => {
  const value = {pack,edition:'20 October',name:'Student_Slides.pdf',type:'application/pdf',size:20,data:new ArrayBuffer(20),historical:true,warning:'Older supporting PDF'};
  assert.equal(api.readLibraryMaterial(value,'Ferdi',pack.id,'pdf').historical,true);
  for (const change of [{data:{}},{data:{byteLength:20}},{size:21},{type:'text/html'},{historical:undefined},{data:new ArrayBuffer(25_000_001),size:25_000_001}]) assert.throws(()=>api.readLibraryMaterial({...value,...change},'Ferdi',pack.id,'pdf'));
  assert.throws(()=>api.readLibraryMaterial(value,'Valentin',pack.id,'pdf'));
  assert.throws(()=>api.readLibraryMaterial(value,'Ferdi','another-pack','pdf'));
});

test('bridge checks exact origin, popup source, connection nonce and request id before resolving', async () => {
  const fixture = hostFixture(), client = new api.CoachLibraryClient(fixture.host);
  const connection = client.connect();
  assert.equal(new URL(fixture.url).pathname,'/teaching-bridge.html');
  assert.equal(new URLSearchParams(new URL(fixture.url).hash.slice(1)).get('origin'),'https://english.example');
  fixture.emit({type:'rory-library-ready',session:fixture.session},{origin:'https://malicious.example'});
  fixture.emit({type:'rory-library-ready',session:fixture.session},{source:{}});
  fixture.emit({type:'rory-library-ready',session:'stale'});
  await assert.rejects(client.request({action:'catalogue',learner:'Ferdi'}),/Reconnect/);
  fixture.emit({type:'rory-library-ready',session:fixture.session}); await connection;
  let resolved = false;
  const pending = client.request({action:'catalogue',learner:'Ferdi'}).then(data=>{resolved=true;return data;});
  const sent = fixture.sent[0];
  assert.equal(sent.target,origin); assert.equal(sent.message.learner,'Ferdi');
  const response = {type:'rory-library-response',session:fixture.session,requestId:sent.message.requestId,ok:true,data:{edition:'Current'}};
  fixture.emit(response,{origin:'https://malicious.example'});
  fixture.emit(response,{source:{}});
  fixture.emit({...response,session:'old'});
  fixture.emit({...response,requestId:'unknown'});
  await Promise.resolve(); assert.equal(resolved,false);
  fixture.emit(response); assert.equal((await pending).edition,'Current');
  client.close(); assert.equal(fixture.listeners.size,0); assert.equal(fixture.timers.size,0); assert.equal(fixture.intervals.size,0);
});

test('closing a connection rejects in-flight work and late messages cannot apply to a reopened connection', async () => {
  const fixture = hostFixture(), client = new api.CoachLibraryClient(fixture.host);
  let connection = client.connect(); fixture.emit({type:'rory-library-ready',session:fixture.session}); await connection;
  const oldSession = fixture.session;
  const request = client.request({action:'lesson',learner:'Ferdi',packId:pack.id,asset:'context'});
  const rejection = assert.rejects(request,/connection changed/); client.close(); await rejection;
  connection = client.connect();
  fixture.emit({type:'rory-library-ready',session:oldSession});
  await assert.rejects(client.request({action:'catalogue',learner:'Valentin'}),/Reconnect/);
  fixture.emit({type:'rory-library-ready',session:fixture.session}); await connection;
  client.close();
});

test('blocked popups and handshake timeouts report a usable reconnect or import route', async () => {
  const fixture = hostFixture(); fixture.host.open = ()=>null;
  const blocked = new api.CoachLibraryClient(fixture.host);
  await assert.rejects(blocked.connect(),/Allow the private library window/);
  const readyFixture = hostFixture(), timed = new api.CoachLibraryClient(readyFixture.host);
  const connection = timed.connect(), rejection = assert.rejects(connection,/Sign in.*reconnect.*import a document/);
  [...readyFixture.timers.values()][0](); await rejection;
  assert.equal(readyFixture.popup.closed,true);
});
