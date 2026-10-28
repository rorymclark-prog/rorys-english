import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
// Reuse the authenticated service fixture, including its actual public router.
const source=fs.readFileSync('tests/backend.test.mjs','utf8');
const fixture=vm.runInNewContext(source.slice(source.indexOf('function fixture()'),source.indexOf('test("GET'))+';fixture',{fs,vm,assert,createHash,randomUUID,Buffer,Date,Map,Proxy,console});
function setup(){const f=fixture();for(const name of ['Documents','Learning','Inbox'])vm.runInContext(fs.readFileSync(`apps-script/progress-sync/${name}.gs`,'utf8'),f.ctx);return f;}
const send=(f,extra={})=>({action:'messageSend',code:'student-a',session:f.student(),id:randomUUID(),text:'Could you explain the homework?',...extra});
test('messages require authentication, exact student scope and a permitted role',()=>{
 const f=setup();assert.equal(f.post({action:'messages',code:'student-a'}).authRequired,true);
 for(const action of ['messages','messageSend','messagesRead','notifications','notificationsRead','teacherNotifications']){
  const parent=f.ctx.issueSession_('parent-a','parent').token;
  assert.equal(f.post({action,code:'parent-a',session:parent,id:randomUUID(),text:'Hello',ids:[]}).ok,false);
  assert.equal(f.post({action,code:'different-student',session:f.student(),id:randomUUID(),text:'Hello',ids:[]}).ok,false);
 }
 assert.equal(f.post({action:'teacherNotifications',code:'student-a',session:f.student()}).ok,false);
});
test('a lost response retries the same message once, preserves literal content and rejects changed identifier reuse',()=>{
 const f=setup(),p=send(f,{text:'=SUM(1,2)\n<script>my actual words</script>',sender:'teacher'});
 const first=f.post(p);assert.equal(first.ok,true);assert.equal(first.message.sender,'student');assert.equal(f.post(p).received,true);
 assert.equal(f.sheets.get('Messages').data.length,2);
 assert.equal(f.post({...p,text:'Changed answer'}).ok,false);
 const got=f.post({action:'messages',code:p.code,session:f.teacher()});assert.equal(got.messages[0].text,p.text);
 assert.equal(f.sheets.get('Messages').data[1][3],JSON.stringify(p.text));
});
test('read-only preview never sends or marks read; actual readers have separate durable receipts',()=>{
 const f=setup(),p=send(f);f.post(p);const t=f.teacher();
 for(const action of ['messageSend','messagesRead','notificationsRead'])assert.equal(f.post({...p,action,session:t,preview:true,ids:['message:'+p.id]}).ok,false);
 assert.equal(f.sheets.has('Inbox reads'),false);
 const read={action:'messagesRead',code:p.code,session:t,ids:['message:'+p.id]};assert.equal(f.post(read).ok,true);assert.equal(f.post(read).ok,true);assert.equal(f.sheets.get('Inbox reads').data.length,2);
 assert.equal(f.post({action:'notifications',code:p.code,session:t}).unread,0);
 const reply=send(f,{session:t,text:'Yes, let’s look at your question.'});assert.equal(f.post(reply).message.sender,'teacher');
 assert.equal(f.post({action:'notifications',code:p.code,session:p.session}).unread,1);
 assert.equal(f.post({action:'notifications',code:p.code,session:t}).unread,0);
 f.post({...read,session:p.session,ids:['message:'+reply.id]});assert.equal(f.post({action:'notifications',code:p.code,session:p.session}).unread,0);
});
test('source notifications deduplicate speaking versions, exclude attached audio and teacher analysis updates',()=>{
 const f=setup(),ss=f.ctx.studentSheet_('student-a');
 const reviews=ss.insertSheet('Learning reviews');reviews.appendRow(f.ctx.LEARNING_HEADERS_);
 const original='2026-10-03T09:32:00Z';
 reviews.appendRow(['speaking-original-id',original,'2026-10-03','speaking','My unit','shared',JSON.stringify({submittedAt:original}),'Student']);
 reviews.appendRow(['speaking-original-id','2026-10-27T09:00:00Z','2026-10-03','speaking','Updated title','shared',JSON.stringify({submittedAt:original}),'Student']);
 reviews.appendRow(['private-review-id','2026-10-27T09:00:00Z','2026-10-27','test','Private assessment','teacher','{}','AI draft']);
 const docs=ss.insertSheet('Documents');docs.appendRow(f.ctx.DOCUMENT_HEADERS_);docs.appendRow(['audio-file-id','Audio',original,'Student',JSON.stringify([{type:'audio/webm'}]),'saved']);docs.appendRow(['writing-file-id','My school work','2026-10-08T12:00:00Z','Student','[]','ready']);
 const r=f.post({action:'teacherNotifications',session:f.teacher()});assert.equal(r.ok,true);assert.equal(r.events.length,2);assert.equal(r.events.find(e=>e.kind==='speaking').at,'2026-10-03T09:32:00.000Z');assert.equal(JSON.stringify(r).includes('Private assessment'),false);
 assert.equal(f.sheets.has('Inbox reads'),false);
});
test('feedback notifications wait for release and a real teacher review',()=>{
 const f=setup(),ss=f.ctx.studentSheet_('student-a'),docs=ss.insertSheet('Documents');docs.appendRow(f.ctx.DOCUMENT_HEADERS_);
 const reviewed='2026-10-27T08:00:00Z',future=new Date(Date.now()+86400000).toISOString();
 docs.appendRow(['held-document-id','Writing',reviewed,'Student','[]','ready','{}','Private teacher feedback',reviewed,'','','','','',future]);
 assert.equal(f.post({action:'notifications',code:'student-a',session:f.student()}).events.length,0);
 docs.data[1][14]='2026-01-01T00:00:00Z';assert.equal(f.post({action:'notifications',code:'student-a',session:f.student()}).events.length,1);
 docs.data[1][7]='';assert.equal(f.post({action:'notifications',code:'student-a',session:f.student()}).events.length,0);
});
test('reading a notification leaves the private feedback check outstanding until Rory checks that analysis',()=>{
 const f=setup(),ss=f.ctx.studentSheet_('student-a'),docs=ss.insertSheet('Documents'),id=randomUUID();docs.appendRow(f.ctx.DOCUMENT_HEADERS_);
 docs.appendRow([id,'School worksheet','2026-10-08T12:00:00Z','Student','[]','ready',JSON.stringify({workType:'worksheet'}),'','','','[Document role: answer]']);
 const t=f.teacher(),read=()=>f.post({action:'teacherNotifications',session:t});
 const first=read().events.find(e=>e.id==='document:'+id);assert.equal(first.needsCheck,true);assert.equal(first.title,'Check feedback');
 f.post({action:'notificationsRead',code:'student-a',session:t,ids:[first.id]});assert.equal(read().events.find(e=>e.id===first.id).needsCheck,true);
 const d=f.post({action:'document',id,code:'student-a',session:t}).document;
 assert.equal(f.post({action:'teacherDocumentCheck',id,code:'student-a',session:t,analysisVersion:d.analysisVersion}).ok,true);
 assert.equal(read().events.find(e=>e.id===first.id).needsCheck,false);
 assert.equal(f.post({action:'notifications',code:'student-a',session:f.student()}).events.length,0);
});
test('unknown event ids cannot manufacture read receipts and long/blank messages are refused',()=>{
 const f=setup();for(const text of ['', '  ', 'x'.repeat(2001)])assert.equal(f.post(send(f,{text})).ok,false);
 assert.equal(f.sheets.has('Messages'),false);
 assert.equal(f.post({action:'notificationsRead',code:'student-a',session:f.student(),ids:['invented']}).ok,true);assert.equal(f.sheets.has('Inbox reads'),false);
});
test('school test notifications attribute student edits and cancellation to the actual actor',()=>{
 const f=setup(),p={action:'calendarTestSave',code:'student-a',session:f.student(),id:randomUUID(),mutationId:randomUUID(),date:'2026-11-06',title:'English test',scope:'Unit one',updatedBy:'teacher'};
 assert.equal(f.post(p).ok,true);
 let events=f.post({action:'teacherNotifications',session:f.teacher()}).events;
 assert.equal(events.length,1);assert.equal(events[0].title,'School test added');
 assert.equal(f.post({...p,action:'teacherCalendarTestCancel',session:f.teacher(),mutationId:randomUUID(),expectedSequence:0}).ok,true);
 assert.equal(f.post({action:'teacherNotifications',session:f.teacher()}).events.length,0);
});
test('message history paginates without gaps and daily limits preserve existing messages',()=>{
 const f=setup();for(let i=0;i<30;i++)assert.equal(f.post(send(f)).ok,true);
 assert.equal(f.post(send(f)).ok,false);assert.equal(f.sheets.get('Messages').data.length,31);
 const sh=f.sheets.get('Messages');for(let i=0;i<275;i++)sh.appendRow([randomUUID(),'2026-10-01T08:00:00Z','teacher',JSON.stringify('Earlier sample '+i)]);
 const p={action:'messages',code:'student-a',session:f.student()},latest=f.post(p);assert.equal(latest.messages.length,300);assert.equal(latest.hasEarlier,true);
 const earlier=f.post({...p,before:latest.messages[0].id});assert.equal(earlier.messages.length,5);assert.equal(earlier.hasEarlier,false);
 assert.equal(new Set([...earlier.messages,...latest.messages].map(m=>m.id)).size,305);
});
