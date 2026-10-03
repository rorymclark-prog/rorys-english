import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createHash,randomUUID} from "node:crypto";
function fixture() {
  let time;
  class Clock extends Date {constructor(...args){super(...(args.length?args:[Clock.now()]));}static now(){return time??Date.now();}}
  const props=new Map([["TEACHER_PASSWORD","synthetic-teacher"],["sheet_student-a","sheet-a"]]);
  const cache=new Map(), sheets=new Map();
  const identity={status:200,user:{localId:'managed-user',emailVerified:true,customAttributes:JSON.stringify({studentCode:'student-a',role:'student'})},calls:0};
  const property={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props)};
  function sheet(name) {
    const data=[];
    const s={data,getDataRange:()=>({getValues:()=>data.map(r=>r.slice())}),appendRow:r=>data.push(r.slice()),getRange:(r,c,rows=1,cols=1)=>({
      setValues:values=>{values.forEach((v,i)=>{data[r-1+i]||=[];v.forEach((x,j)=>data[r-1+i][c-1+j]=x);});},
      setValue:v=>{data[r-1]||=[];data[r-1][c-1]=v;}
    })};
    sheets.set(name,s);return s;
  }
  const ss={getSheetByName:name=>sheets.get(name)||null,insertSheet:sheet};
  sheet("Vocab & Quizzes").appendRow(["Date","Tool","Section","Score","Total","Percent"]);
  sheet("Writing").appendRow(["Date","Title","CEFR","Grammar","Vocab","Coherence","Errors","Feedback","Link"]);
  const roster={code:"student-a",parentCode:"parent-a",name:"Demo learner"};
  const ctx={
    console,Date:Clock,JSON,Object,Array,String,Number,isFinite,SECRET:"server-internal-v2",TEACHER_PASSWORD_PROP:"TEACHER_PASSWORD",AI_DAILY_CAP:40,
    PropertiesService:{getScriptProperties:()=>property},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:"sha256"},computeDigest:(_a,t)=>createHash("sha256").update(t).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString("base64url"),base64DecodeWebSafe:t=>Buffer.from(t,'base64url'),formatDate:(d,z,fmt)=>fmt==="yyyy-MM-dd'T'HH:mm"?new Intl.DateTimeFormat('sv-SE',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d).replace(' ','T'):"2026-09-17",newBlob:t=>({getBytes:()=>Buffer.from(t),getDataAsString:()=>Buffer.from(t).toString()})},
    UrlFetchApp:{fetch:()=>{identity.calls++;return {getResponseCode:()=>identity.status,getContentText:()=>JSON.stringify({users:[identity.user]})};}},
    Session:{getScriptTimeZone:()=>"Europe/Vienna"},SpreadsheetApp:{openById:()=>ss},
    DriveApp:new Proxy({}, {get(){throw Error("Resource read touched Drive");}}),
    getRoster_:()=>[roster],
    studentByAnyCode_:code=>[roster.code,roster.parentCode].includes(code)?roster:null,
    json_:x=>x,now_:()=>"2026-09-17 12:00",sanitize_:x=>/^[=+\-@]/.test(String(x))?"'"+x:x,
    aiCount_:code=>Number(props.get("ai_"+code)||0),aiKey_:code=>"ai_"+code,
    legacyPost_:e=>{const p=JSON.parse(e.postData.contents);assert.equal(p.callback,undefined);return {ok:true,action:p.action};},
    upsertHomework_(){},setAssignmentStatus_(){},pruneAiCounters_(){},
  };
  vm.createContext(ctx);vm.runInContext(fs.readFileSync("apps-script/progress-sync/V2.gs","utf8"),ctx);
  vm.runInContext(fs.readFileSync("apps-script/progress-sync/FirebaseAuth.gs","utf8"),ctx);
  vm.runInContext(fs.readFileSync("apps-script/progress-sync/Calendar.gs","utf8"),ctx);
  const post=p=>ctx.doPost({postData:{contents:JSON.stringify(p)}});
  const teacher=()=>ctx.issueSession_("__teacher__","teacher").token;
  const student=()=>ctx.issueSession_("student-a","student").token;
  return {ctx,post,teacher,student,sheets,props,cache,identity,setTime:t=>{time=t;}};
}
test("GET is version-only; route codes and legacy secret do not authenticate",()=>{
  const f=fixture();assert.equal(f.ctx.doGet({parameter:{action:"progress"}}).version,2);
  assert.equal(f.post({action:"progress",code:"student-a",secret:"server-internal-v2"}).authRequired,true);
});
test("remembered teacher sign-in lasts 30 days despite cache eviction and stores only a token hash",()=>{
  const f=fixture(),before=Date.now();
  const s=f.post({action:"login",code:"__teacher__",credential:"synthetic-teacher",remember:true});
  assert.equal(s.ok,true);assert.equal(s.role,"teacher");
  assert.ok(s.expires>=before+30*86400000&&s.expires<=Date.now()+30*86400000);
  f.cache.clear();
  assert.equal(f.post({action:"teacherDashboard",session:s.token}).ok,true);
  const records=[...f.props].filter(([k])=>k.startsWith("remembered_teacher_"));
  assert.equal(records.length,1);
  assert.equal(JSON.stringify(records).includes(s.token),false);
  assert.equal(f.post({action:"logout",session:s.token}).ok,true);
  assert.equal(f.post({action:"teacherDashboard",session:s.token}).authRequired,true);
});
test("remembered teacher sessions are invalidated by expiry or password rotation",()=>{
  for(const reason of ["expiry","password"]){
    const f=fixture(),s=f.post({action:"login",code:"__teacher__",credential:"synthetic-teacher",remember:true});
    if(reason==="password")f.props.set("TEACHER_PASSWORD","different-synthetic-password");
    else {const k=[...f.props.keys()].find(k=>k.startsWith("remembered_teacher_"));f.props.set(k,JSON.stringify({...JSON.parse(f.props.get(k)),expires:Date.now()-1}));}
    assert.equal(f.post({action:"teacherDashboard",session:s.token}).authRequired,true);
  }
});
test("an unticked box keeps the six-hour limit, and no sign-in can mint a teacher device",()=>{
  const f=fixture(),s=f.post({action:"login",code:"__teacher__",credential:"synthetic-teacher",remember:false});
  assert.ok(s.expires-Date.now()<=21600000);f.cache.clear();
  assert.equal(f.post({action:"teacherDashboard",session:s.token}).authRequired,true);
  assert.equal(f.post({action:"login",code:"__teacher__",credential:"wrong",remember:true}).ok,false);
  const access=f.post({action:"teacherAccess",code:"student-a",session:f.teacher()});
  const plain=f.post({action:"login",code:"student-a",credential:access.access});
  assert.equal(plain.role,"student");assert.ok(plain.expires-Date.now()<=21600000);
  // A student ticking the box gets a student device, never a teacher one.
  const remembered=f.post({action:"login",code:"student-a",credential:access.access,remember:true});
  assert.equal(remembered.role,"student");
  assert.equal([...f.props.keys()].some(k=>k.startsWith("remembered_teacher_")),false);
});
test("remembered session storage is bounded and prunes invalid records without deleting other properties",()=>{
  const f=fixture();
  for(let i=0;i<23;i++)assert.equal(f.ctx.issueRememberedTeacher_().ok,true);
  assert.equal([...f.props.keys()].filter(k=>k.startsWith("remembered_teacher_")).length,20);
  f.props.set("remembered_teacher_bad","not json");f.ctx.issueRememberedTeacher_();
  assert.equal(f.props.has("remembered_teacher_bad"),false);assert.equal(f.props.get("sheet_student-a"),"sheet-a");
});
test("photo-only homework submits and retries without replacing the original reference",()=>{
  const f=fixture(),s=f.student(),event={action:"submit",id:randomUUID(),code:"student-a",session:s,unit:"synthetic-unit",task:"synthetic-photo-task",answers:{handwritten_work:"[Handwritten answer: synthetic-document-0001]"}};
  assert.equal(f.post(event).ok,true);assert.equal(f.post(event).ok,true);
  const received=f.ctx.submissions_({code:"student-a"}).submissions;
  assert.equal(received.length,1);assert.equal(received[0].answers.handwritten_work,event.answers.handwritten_work);
});
test("generated access credentials are salted hashes; rotation revokes sessions",()=>{
  const f=fixture();const issued=f.post({action:"teacherAccess",code:"student-a",session:f.teacher()});
  assert.equal(issued.ok,true);assert.equal(issued.access.length,64);
  assert.ok(!f.props.get("access_student-a").includes(issued.access));
  assert.equal(f.post({action:"login",code:"student-a",credential:"wrong"}).ok,false);
  const session=f.post({action:"login",code:"student-a",credential:issued.access});
  assert.equal(session.ok,true);
  assert.equal(f.post({action:"note",code:"student-a",session:session.token,callback:"steal"}).ok,true);
  f.post({action:"teacherAccess",code:"student-a",session:f.teacher()});
  assert.equal(f.post({action:"note",code:"student-a",session:session.token}).authRequired,true);
});
test("roles isolate students, parents, and teacher-only writes",()=>{
  const f=fixture(), s=f.student(), p=f.ctx.issueSession_("parent-a","parent").token;
  for(const action of ["teacherAccess","teacherResources","teacherReview","teacherPublishAssessment","teacherAnalyseWriting"])
    assert.equal(f.post({action,code:"student-a",session:s,teacherSecret:"synthetic-teacher"}).ok,false);
  assert.equal(f.post({action:"progress",code:"other-student",session:s}).ok,false);
  for(const action of ["ai","submit","event","submissions"]) assert.equal(f.post({action,code:"parent-a",session:p}).ok,false);
  assert.equal(f.post({action:"progress",code:"parent-a",session:p}).ok,true);
});
test("resource reads neither search Drive nor change sharing",()=>{
  const f=fixture();f.props.set("approved_resources_student-a",JSON.stringify([{name:"Approved lesson",url:"https://docs.google.com/document/d/demo"}]));
  assert.equal(f.ctx.getResources_({code:"student-a"}).resources.length,1);
  assert.equal(f.post({action:"teacherResources",code:"student-a",session:f.teacher(),resources:[{name:"Bad",url:"https://docs.google.com.evil.example/x"}]}).ok,false);
});
test("submissions preserve exact originals and deduplicate retries",()=>{
  const f=fixture(), s=f.student(), event={action:"submit",code:"student-a",session:s,id:randomUUID(),task:"hw:1",unit:"unit1",answers:{writing:"My original\nsecond line = 1"}};
  assert.equal(f.post(event).ok,true);
  assert.equal(f.post({...event,answers:{writing:"changed after first request"}}).ok,true);
  const rows=f.ctx.submissions_({code:"student-a"}).submissions;
  assert.equal(rows.length,1);assert.equal(rows[0].answers.writing,event.answers.writing);
  assert.equal(f.post({...event,id:randomUUID(),answers:{writing:" "}}).ok,false);
  assert.equal(f.post({...event,id:randomUUID(),answers:{writing:{nested:true}}}).ok,false);
});
test("review and revision states are teacher-only and preserve original",()=>{
  const f=fixture(), id=randomUUID();f.post({action:"submit",code:"student-a",session:f.student(),id,task:"hw:1",unit:"unit1",answers:{answer:"Original"}});
  const review={action:"teacherReview",code:"student-a",session:f.teacher(),id,status:"revision-needed",feedback:"Try the article again."};
  assert.equal(f.post(review).ok,true);
  const row=f.ctx.submissions_({code:"student-a"},{role:"teacher"}).submissions[0];
  assert.equal(row.feedback,review.feedback);assert.equal(row.answers.answer,"Original");
  assert.equal(f.post({...review,feedback:"a".repeat(2001)}).ok,false);
});
test("teacher approval releases automatically at exactly five hours, never before and never without review",()=>{
  const f=fixture(),start=Date.parse('2026-09-23T10:00:00Z');f.setTime(start);
  const id=randomUUID(),event={action:'submit',code:'student-a',session:f.student(),id,task:'hw:1',unit:'unit1',answers:{answer:'Original'},feedbackAvailableAt:'2000-01-01',submitted:'2000-01-01'};
  assert.equal(f.post(event).ok,true);
  const deadline=f.ctx.submissions_({code:'student-a'}).submissions[0].feedbackAvailableAt;
  assert.equal(Date.parse(deadline),start+5*3600000);
  f.setTime(start+3600000);assert.equal(f.post(event).ok,true);
  assert.equal(f.ctx.submissions_({code:'student-a'}).submissions[0].feedbackAvailableAt,deadline);
  const review={action:'teacherReview',code:'student-a',session:f.teacher(),id,status:'revision-needed',feedback:'Private approved feedback'};
  assert.equal(f.post(review).ok,true);
  f.setTime(Date.parse(deadline)-1);
  for(const preview of [false,true]) {
    const r=f.post({action:'submissions',code:'student-a',session:preview?f.teacher():f.student(),preview,role:'teacher'}).submissions[0];
    assert.equal(r.feedback,'');assert.equal(r.reviewed,'');assert.equal(r.status,'submitted');assert.equal(r.answers.answer,'Original');
  }
  assert.equal(f.ctx.submissions_({code:'student-a'},{role:'teacher'}).submissions[0].feedback,review.feedback);
  f.setTime(Date.parse(deadline));const released=f.ctx.submissions_({code:'student-a'}).submissions[0];
  assert.equal(released.feedback,review.feedback);assert.equal(released.status,'revision-needed');
  const fresh={...event,id:randomUUID(),session:f.student()};f.post(fresh);f.setTime(Date.parse(deadline)+5*3600000);
  const unreviewed=f.ctx.submissions_({code:'student-a'}).submissions[1];assert.equal(unreviewed.status,'submitted');assert.equal(unreviewed.feedback,'');
});
test("legacy feedback stays available and a malformed review deadline fails closed",()=>{
  const f=fixture();f.post({action:'submit',code:'student-a',session:f.student(),id:randomUUID(),task:'hw:1',unit:'u',answers:{answer:'Old work'}});
  const row=f.sheets.get('Submissions').data[1];row[6]='Existing feedback';row[5]='reviewed';row[10]='';
  assert.equal(f.ctx.submissions_({code:'student-a'}).submissions[0].feedback,'Existing feedback');
  row[10]='invalid';assert.equal(f.ctx.submissions_({code:'student-a'}).submissions[0].feedback,'');
});
test("extending an existing sheet backs up its original records once without changing sharing",()=>{
  const f=fixture(),data=[['Old header'],['Original work']],calls=[];
  const backup={setName:n=>{calls.push(n);return backup;},hideSheet:()=>calls.push('hidden')};
  const sh={getDataRange:()=>({getValues:()=>data}),getName:()=> 'Submissions',copyTo:()=>{calls.push('copy');return backup;},getRange:(_r,c)=>({setValue:v=>{data[0][c-1]=v;}})};
  f.ctx.ensureReviewColumn_('student-a',sh,11,'Feedback available after');f.ctx.ensureReviewColumn_('student-a',sh,11,'Feedback available after');
  assert.equal(calls.filter(c=>c==='copy').length,1);assert.ok(calls.includes('hidden'));assert.equal(data[1][0],'Original work');
});
test("quiz event id is atomic with score; retry cannot duplicate it",()=>{
  const f=fixture(), event={action:"event",code:"student-a",session:f.student(),id:randomUUID(),type:"quiz",score:2,total:3,tool:"demo",section:"first attempt"};
  assert.equal(f.post(event).ok,true);assert.equal(f.post(event).ok,true);
  assert.equal(f.sheets.get("Vocab & Quizzes").data.length,2);
  assert.equal(f.sheets.get("Vocab & Quizzes").data[1][6],event.id);
  assert.equal(f.post({...event,id:randomUUID(),score:4}).ok,false);
});
test("teacher-approved assessments are idempotent and retain zero scores",()=>{
  const f=fixture(), p={action:"teacherPublishAssessment",code:"student-a",session:f.teacher(),id:randomUUID(),title:"Demo",assessment:{cefr:"B1",grammar:0,vocab:5,coherence:6,errors:[],feedback:"Teacher checked."}};
  assert.equal(f.post(p).ok,true);assert.equal(f.post(p).ok,true);
  const rows=f.sheets.get("Writing").data;assert.equal(rows.length,2);assert.equal(rows[1][3],0);
  assert.equal(f.post({...p,id:randomUUID(),assessment:{...p.assessment,grammar:11}}).ok,false);
  assert.equal(f.post({...p,id:randomUUID(),assessment:{...p.assessment,cefr:"B1+"}}).ok,true);
});
test("changing the teacher password invalidates existing teacher sessions",()=>{
  const f=fixture(),session=f.teacher();
  f.props.set("TEACHER_PASSWORD","different-synthetic-password");
  assert.equal(f.post({action:"teacherDashboard",session}).authRequired,true);
});
test("rate limits reserve quota before AI work and reject expired sessions",()=>{
  const f=fixture(), session=f.student();f.props.set("ai_student-a","40");
  assert.equal(f.post({action:"ai",session,code:"student-a",q:"test"}).ok,false);
  f.cache.clear();assert.equal(f.post({action:"progress",session,code:"student-a"}).authRequired,true);
});
test("production Apps Script parses and has one public entry point of each kind",()=>{
  const code=fs.readFileSync("apps-script/progress-sync/Code.gs","utf8")+fs.readFileSync("apps-script/progress-sync/V2.gs","utf8")+fs.readFileSync("apps-script/progress-sync/FirebaseAuth.gs","utf8");
  new vm.Script(code);
  assert.equal((code.match(/function doPost\(/g)||[]).length,1);
  assert.equal((code.match(/function doGet\(/g)||[]).length,1);
  assert.ok(code.includes("archived for optional revision, not outstanding catch-up"));
});
function identityToken(changes={}) {
  const now=Math.floor(Date.now()/1000);
  return 'header.'+Buffer.from(JSON.stringify({aud:'rory-automation',iss:'https://securetoken.google.com/rory-automation',sub:'managed-user',iat:now,exp:now+1800,...changes})).toString('base64url')+'.signature';
}
test('managed login requires Google validation and the server-controlled learner permission',()=>{
  const f=fixture(), token=identityToken();
  const r=f.post({action:'firebaseLogin',code:'student-a',idToken:token});
  assert.equal(r.ok,true);assert.equal(r.role,'student');assert.equal(f.identity.calls,1);
  assert.ok(r.expires-Date.now()<=1800000);
  assert.equal(f.post({action:'teacherDashboard',code:'student-a',session:r.token}).ok,false);
  for(const update of [{emailVerified:false},{disabled:true},{localId:'wrong-user'},{customAttributes:'{"studentCode":"other-student","role":"student"}'},{customAttributes:'{"studentCode":"student-a","role":"teacher"}'}]) {
    const rejected=fixture();Object.assign(rejected.identity.user,update);
    assert.equal(rejected.post({action:'firebaseLogin',code:'student-a',idToken:token}).ok,false);
  }
  const forged=fixture();forged.identity.status=400;
  assert.equal(forged.post({action:'firebaseLogin',code:'student-a',idToken:token}).ok,false);
});
test('expired and wrong-project identity tokens cannot create sessions',()=>{
  for(const claims of [{exp:1},{aud:'different-project'},{iss:'https://attacker.example'},{sub:''},{iat:Date.now()/1000+3600}]) {
    const f=fixture();assert.equal(f.post({action:'firebaseLogin',code:'student-a',idToken:identityToken(claims)}).ok,false);assert.equal(f.identity.calls,0);
  }
});
test("a remembered student sign-in survives the six-hour cache, and only as a student",()=>{
  const f=fixture();
  const granted=f.ctx.setAccess_({code:"student-a"});
  const remembered=f.ctx.login_({code:"student-a",credential:granted.access,remember:true});
  assert.equal(remembered.ok,true);
  assert.ok(remembered.token.startsWith("rs_"),"a remembered student token is durable, not a cache key");
  assert.ok(remembered.expires-Date.now()>29*24*60*60*1000,"remembered means days, not hours");
  // The whole point: CacheService can be evicted, and closing the app used to
  // lose the session anyway. A durable record has to outlive both.
  f.cache.clear();
  assert.equal(f.ctx.session_(remembered.token).code,"student-a");
  // Unticked still behaves exactly as before.
  const plain=f.ctx.login_({code:"student-a",credential:granted.access});
  assert.ok(!plain.token.startsWith("rs_"));
  assert.ok(plain.expires-Date.now()<=21600*1000);
  f.cache.clear();
  assert.equal(f.ctx.session_(plain.token),null);
  // A remembered student token must never resolve to teacher rights, whatever
  // the stored record claims.
  const key=Object.keys(Object.fromEntries(f.props)).find(k=>k.startsWith("remembered_student_"));
  f.props.set(key,JSON.stringify({code:"__teacher__",role:"teacher",expires:Date.now()+1e9,version:f.ctx.version_("__teacher__")}));
  assert.equal(f.ctx.session_(remembered.token),null);
});
test("signing out, and replacing the access code, both revoke a remembered device",()=>{
  for (const revoke of ["logout","rotate"]) {
    const f=fixture();
    const granted=f.ctx.setAccess_({code:"student-a"});
    const session=f.ctx.login_({code:"student-a",credential:granted.access,remember:true});
    assert.equal(f.ctx.session_(session.token).role,"student");
    if (revoke==="logout") f.post({action:"logout",session:session.token});
    else f.ctx.setAccess_({code:"student-a"});
    f.cache.clear();
    assert.equal(f.ctx.session_(session.token),null,`${revoke} must end a remembered device`);
  }
});
test("one student's devices are capped without evicting another student's",()=>{
  const f=fixture();
  const granted=f.ctx.setAccess_({code:"student-a"});
  const parent=f.ctx.setAccess_({code:"student-a",parent:true});
  const parentSession=f.ctx.login_({code:"parent-a",credential:parent.access,remember:true});
  const tokens=[];
  for (let i=0;i<7;i++) tokens.push(f.ctx.login_({code:"student-a",credential:granted.access,remember:true}).token);
  const live=tokens.filter(t=>f.ctx.session_(t));
  assert.equal(live.length,5,"at most five remembered devices per code");
  assert.deepEqual(live,tokens.slice(-5),"the oldest devices are the ones dropped");
  assert.equal(f.ctx.session_(parentSession.token).role,"parent","pruning one code must not touch another");
});

test('lesson calendar keeps fortnightly Vienna times across DST and skips breaks without shifting the pattern',()=>{
  const f=fixture(),session=f.teacher();
  assert.equal(f.post({action:'teacherCalendarBreak',code:'student-a',session,id:randomUUID(),from:'2026-10-24',to:'2026-11-01',label:'Autumn break'}).ok,true);
  const create={action:'teacherCalendarSave',code:'student-a',session,id:randomUUID(),date:'2026-10-03',time:'15:00',duration:90,repeat:'fortnightly',until:'2026-11-28',title:'English lesson'};
  const reply=f.post(create);assert.equal(reply.ok,true);assert.equal(reply.created,4);assert.equal(reply.skipped,1);
  const lessons=f.post({action:'calendarLessons',code:'student-a',session}).lessons;
  assert.deepEqual(Array.from(lessons,l=>l.date),['2026-10-03','2026-10-17','2026-11-14','2026-11-28']);
  assert.equal(lessons[0].start,'2026-10-03T13:00:00.000Z');assert.equal(lessons[2].start,'2026-11-14T14:00:00.000Z');
  assert.equal(f.post(create).duplicate,true);assert.equal(f.sheets.get('Lessons').data.length,5);
});
test('lesson edits retain identifiers, increment sequence and refuse conflicts or stale saves',()=>{
  const f=fixture(),session=f.teacher(),base={action:'teacherCalendarSave',code:'student-a',session,date:'2026-10-03',time:'15:00',duration:90,repeat:'once'};
  assert.equal(f.post({...base,id:randomUUID()}).ok,true);
  const l=f.post({action:'calendarLessons',code:'student-a',session}).lessons[0];
  assert.equal(f.post({...base,id:randomUUID(),time:'16:00'}).ok,false);
  assert.equal(f.post({...base,id:randomUUID(),time:'16:30'}).ok,true);
  assert.equal(f.post({...base,id:l.id,expectedSequence:0,time:'13:00'}).ok,true);
  assert.equal(f.post({...base,id:l.id,expectedSequence:0,time:'12:00'}).ok,false);
  const edited=f.post({action:'calendarLessons',code:'student-a',session}).lessons.find(x=>x.id===l.id);assert.equal(edited.sequence,1);
  assert.equal(f.post({action:'teacherCalendarCancel',code:'student-a',session,id:l.id,expectedSequence:1}).ok,true);
  const cancelled=f.post({action:'calendarLessons',code:'student-a',session}).lessons.find(x=>x.id===l.id);assert.equal(cancelled.sequence,2);assert.equal(cancelled.status,'cancelled');
});
test('calendar rejects invalid dates, durations, spring missing times and autumn ambiguous times',()=>{
  const f=fixture(),session=f.teacher(),base={action:'teacherCalendarSave',code:'student-a',session,date:'2026-10-03',time:'15:00',duration:90,repeat:'once'};
  for(const invalid of [{date:'2026-02-30'},{time:'25:00'},{duration:0},{duration:NaN},{date:'2026-03-29',time:'02:30'},{date:'2026-10-25',time:'02:30'},{repeat:'daily'},{repeat:'fortnightly',until:'2028-10-03'}])assert.equal(f.post({...base,id:randomUUID(),...invalid}).ok,false,JSON.stringify(invalid));
  assert.equal(f.sheets.has('Lessons'),false);
});
test('students and parents see only their calendar and cannot schedule or modify lessons in preview',()=>{
  const f=fixture(),teacher=f.teacher(),student=f.student(),parent=f.ctx.issueSession_('parent-a','parent').token;
  assert.equal(f.post({action:'teacherCalendarSave',code:'student-a',session:teacher,id:randomUUID(),date:'2026-10-03',time:'15:00',duration:90,repeat:'once'}).ok,true);
  for(const [code,session] of [['student-a',student],['parent-a',parent]]){
    assert.equal(f.post({action:'calendarLessons',code,session}).lessons.length,1);
    assert.equal(f.post({action:'teacherCalendarSave',code,session,id:randomUUID(),date:'2026-10-03',time:'15:00',duration:90,repeat:'once'}).ok,false);
    assert.equal(f.post({action:'calendarLessons',code:'other-student',session}).ok,false);
  }
  for(const action of ['calendarLink','calendarRevoke','calendarRequest','teacherCalendarSave'])assert.equal(f.post({action,code:'student-a',session:teacher,preview:true}).ok,false);
  assert.equal(f.post({action:'calendarLessons',code:'student-a',session:teacher,preview:true}).ok,true);
  assert.equal(f.post({action:'calendarLessons',code:'student-a'}).authRequired,true);
});
test('calendar bearer links are scoped, hashed, revocable and never reveal requests or homework',()=>{
  const f=fixture(),session=f.teacher();
  f.post({action:'teacherCalendarSave',code:'student-a',session,id:randomUUID(),date:'2026-10-03',time:'15:00',duration:90,repeat:'once'});
  const own=f.post({action:'calendarLink',code:'student-a',session:f.student()});assert.equal(own.ok,true);
  const feed=f.post({action:'calendarFeed',code:'student-a',token:own.calendarToken});assert.equal(feed.ok,true);assert.equal(feed.lessons.length,1);
  assert.equal(feed.requests,undefined);assert.equal(feed.lessons[0].studentName,undefined);assert.equal(feed.lessons[0].studentCode,undefined);
  assert.equal([...f.props.values()].join('').includes(own.calendarToken),false);
  const teacherSelected=f.post({action:'calendarLink',code:'student-a',session});assert.equal(teacherSelected.scope,'__teacher__:student-a');assert.equal(f.post({action:'calendarFeed',code:teacherSelected.scope,token:teacherSelected.calendarToken}).ok,true);assert.equal(f.post({action:'calendarFeed',code:'student-a',token:own.calendarToken}).ok,true);
  assert.equal(f.post({action:'calendarFeed',code:'parent-a',token:own.calendarToken}).ok,false);
  const parent=f.post({action:'calendarLink',code:'parent-a',session:f.ctx.issueSession_('parent-a','parent').token});assert.equal(parent.ok,true);
  const replacement=f.post({action:'calendarLink',code:'student-a',session:f.student()});assert.equal(f.post({action:'calendarFeed',code:'student-a',token:own.calendarToken}).ok,false);
  assert.equal(f.post({action:'calendarFeed',code:'parent-a',token:parent.calendarToken}).ok,true);
  assert.equal(f.post({action:'calendarRevoke',code:'student-a',session:f.student()}).ok,true);assert.equal(f.post({action:'calendarFeed',code:'student-a',token:replacement.calendarToken}).ok,false);
  const teacher=f.post({action:'calendarLink',code:'__teacher__',session});assert.equal(f.post({action:'calendarFeed',code:'__teacher__',token:teacher.calendarToken}).lessons[0].title,'Demo learner · English lesson with Rory');
  f.props.set('TEACHER_PASSWORD','rotated');assert.equal(f.post({action:'calendarFeed',code:'__teacher__',token:teacher.calendarToken}).ok,false);
});
test('rescheduling waits for approval, retries without duplication and declines retain original booking',()=>{
  const f=fixture();f.setTime(new Date('2026-10-01T12:00:00Z').getTime());const teacher=f.teacher(),student=f.student();
  f.post({action:'teacherCalendarSave',code:'student-a',session:teacher,id:randomUUID(),date:'2026-10-03',time:'15:00',duration:90,repeat:'once'});
  const l=f.post({action:'calendarLessons',code:'student-a',session:student}).lessons[0];
  const req={action:'calendarRequest',code:'student-a',session:student,id:randomUUID(),lessonId:l.id,date:'2026-10-04',time:'16:00',message:'Could we do Sunday?'};
  assert.equal(f.post(req).ok,true);assert.equal(f.post(req).ok,true);assert.equal(f.sheets.get('Lesson requests').data.length,2);
  assert.equal(f.post({...req,id:randomUUID()}).ok,false);
  assert.equal(f.post({action:'calendarLessons',code:'student-a',session:student}).lessons[0].date,'2026-10-03');
  assert.equal(f.post({action:'teacherCalendarRespond',code:'student-a',session:student,id:req.id,status:'accepted'}).ok,false);
  assert.equal(f.post({action:'teacherCalendarRespond',code:'student-a',session:teacher,id:req.id,status:'accepted'}).ok,true);
  assert.equal(f.post({action:'teacherCalendarRespond',code:'student-a',session:teacher,id:req.id,status:'accepted'}).ok,true);
  const changed=f.post({action:'calendarLessons',code:'student-a',session:student}).lessons[0];assert.equal(changed.id,l.id);assert.equal(changed.date,'2026-10-04');assert.equal(changed.sequence,1);
  const second={...req,id:randomUUID(),date:'2026-10-05'};assert.equal(f.post(second).ok,true);
  assert.equal(f.post({action:'teacherCalendarRespond',code:'student-a',session:teacher,id:second.id,status:'declined'}).ok,true);
  assert.equal(f.post({action:'calendarLessons',code:'student-a',session:student}).lessons[0].date,'2026-10-04');
});
test('adding a break cancels existing lessons and removing it does not silently rebook them',()=>{
  const f=fixture(),session=f.teacher();f.post({action:'teacherCalendarSave',code:'student-a',session,id:randomUUID(),date:'2026-10-03',time:'15:00',duration:90,repeat:'fortnightly',until:'2026-10-31'});
  const b={action:'teacherCalendarBreak',code:'student-a',session,id:randomUUID(),from:'2026-10-17',to:'2026-10-31',label:'Confirmed break'};
  assert.equal(f.post(b).cancelled,2);assert.equal(f.post(b).cancelled,0);
  assert.equal(f.post({action:'teacherCalendarRemoveBreak',code:'student-a',session,id:b.id}).ok,true);
  const result=f.post({action:'calendarLessons',code:'student-a',session});assert.equal(result.breaks.length,0);assert.equal(result.lessons.filter(l=>l.status==='cancelled').length,2);
});

test('teacher calendar reads and links are rejected for students and parents',()=>{
 const f=fixture();for(const role of ['student','parent']){const code=role==='student'?'student-a':'parent-a',session=f.ctx.issueSession_(code,role).token;for(const action of ['teacherCalendarLessons','teacherCalendarLink','teacherCalendarRevoke'])assert.equal(f.post({action,code,session}).ok,false);}
 const teacher=f.teacher();assert.equal(f.post({action:'teacherCalendarLessons',code:'__teacher__',session:teacher}).ok,true);assert.equal(f.post({action:'teacherCalendarLink',code:'student-a',session:teacher}).scope,'__teacher__:student-a');
});

function testCalendarFixture(){
 const f=fixture(),files=new Map();vm.runInContext(fs.readFileSync('apps-script/progress-sync/Documents.gs','utf8'),f.ctx);
 f.ctx.Utilities.base64Decode=s=>Array.from(Buffer.from(s,'base64'));f.ctx.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
 f.ctx.Utilities.newBlob=(bytes,type,name)=>({getBytes:()=>bytes,type,name});
 f.ctx.documentFolder_=()=>({createFile:blob=>{const id=randomUUID();files.set(id,{blob,trashed:false});return {getId:()=>id};}});
 f.ctx.DriveApp={getFileById:id=>({getBlob:()=>files.get(id).blob,setTrashed:v=>{files.get(id).trashed=v;}})};
 return {...f,files};
}
const scopePhoto={name:'scope.png',type:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10,1,2,3,4]).toString('base64')};
function testDraft(f,extra={}){return {action:'calendarTestSave',code:'student-a',session:f.student(),id:randomUUID(),mutationId:randomUUID(),date:'2026-10-31',title:'English test',scope:'Unit 1\nPast simple and a letter',...extra};}
test('school tests save written scopes literally, survive school breaks and retry without duplicating',()=>{
 const f=testCalendarFixture(),p=testDraft(f,{scope:'=Unit 1\n<script>literal scope</script>'});
 assert.equal(f.post(p).ok,true);assert.equal(f.post(p).duplicate,true);
 f.post({action:'teacherCalendarBreak',code:'student-a',session:f.teacher(),id:randomUUID(),from:'2026-10-24',to:'2026-11-01'});
 const t=f.post({action:'calendarLessons',code:'student-a',session:p.session}).tests[0];assert.equal(t.scope,p.scope);assert.equal(t.date,p.date);assert.equal(t.status,'scheduled');assert.equal(f.sheets.get('School test calendar').data.length,2);
 assert.equal(f.sheets.has('Documents'),false);assert.equal(f.files.size,0);
});
test('photo-only scope is private, byte-preserving and independent from writing submissions or AI',()=>{
 const f=testCalendarFixture(),p=testDraft(f,{scope:'',files:[scopePhoto]});assert.equal(f.post(p).ok,true);assert.equal(f.post(p).duplicate,true);assert.equal(f.files.size,1);
 const t=f.post({action:'calendarLessons',code:'student-a',session:p.session}).tests[0];assert.equal(t.files[0].id,undefined);assert.equal(t.files[0].index,0);
 const file=f.post({action:'calendarTestFile',code:'student-a',session:p.session,id:t.id,index:0,expectedSequence:0});assert.equal(file.file.data,scopePhoto.data);
 assert.equal(f.sheets.has('Documents'),false);assert.equal(f.sheets.has('Submissions'),false);
 const link=f.post({action:'calendarLink',code:'student-a',session:p.session}),feed=f.post({action:'calendarFeed',code:'student-a',token:link.calendarToken});assert.equal(feed.lessons[0].date,p.date);assert.equal(feed.lessons[0].scope,undefined);assert.equal(feed.lessons[0].files,undefined);assert.equal(JSON.stringify(feed).includes(scopePhoto.name),false);
});
test('test editing preserves photos, detects stale updates and permits cancellation and restoration',()=>{
 const f=testCalendarFixture(),p=testDraft(f,{files:[scopePhoto]});f.post(p);
 const edit={...p,files:[],mutationId:randomUUID(),expectedSequence:0,date:'2026-11-02',scope:'Updated scope'};assert.equal(f.post(edit).ok,true);assert.equal(f.post(edit).duplicate,true);assert.equal(f.files.size,1);
 assert.equal(f.post({...edit,mutationId:randomUUID()}).ok,false);
 assert.equal(f.post({action:'calendarTestFile',code:p.code,session:p.session,id:p.id,index:0,expectedSequence:0}).ok,false);
 const cancel={action:'calendarTestCancel',code:p.code,session:p.session,id:p.id,mutationId:randomUUID(),expectedSequence:1};assert.equal(f.post(cancel).ok,true);assert.equal(f.post(cancel).ok,true);
 const t=f.post({action:'calendarLessons',code:p.code,session:p.session}).tests[0];assert.equal(t.sequence,2);assert.equal(t.status,'cancelled');assert.equal(t.files.length,1);
 assert.equal(f.post({...edit,mutationId:randomUUID(),expectedSequence:2,removeFiles:[0]}).ok,true);
 assert.equal(f.post({action:'calendarLessons',code:p.code,session:p.session}).tests[0].files.length,0);
});
test('scope validation refuses impossible dates, empty scope, wrong file types and excess photos',()=>{
 const f=testCalendarFixture();for(const extra of [{date:'2026-02-30'},{scope:''},{scope:'a'.repeat(4001)},{scope:'',files:[{...scopePhoto,type:'image/jpeg'}]},{files:Array(7).fill(scopePhoto)},{removeFiles:[0]}])assert.equal(f.post(testDraft(f,extra)).ok,false);
 assert.equal(f.files.size,0);assert.equal(f.sheets.has('School test calendar'),false);
});
test('test scopes and photos respect student, parent and read-only-preview boundaries',()=>{
 const f=testCalendarFixture(),p=testDraft(f,{files:[scopePhoto]});f.post(p);const parent=f.ctx.issueSession_('parent-a','parent').token,teacher=f.teacher();
 assert.equal(f.post({...p,code:'other-student'}).ok,false);
 assert.equal(f.post({...p,code:'parent-a',session:parent}).ok,false);
 assert.equal(f.post({...p,session:teacher,preview:true}).ok,false);
 assert.equal(f.post({...p,action:'teacherCalendarTestSave'}).ok,false);
 for(const [code,session,preview] of [['parent-a',parent,false],['student-a',teacher,true]]){assert.equal(f.post({action:'calendarLessons',code,session,preview}).tests.length,1);assert.equal(f.post({action:'calendarTestFile',code,session,preview,id:p.id,index:0,expectedSequence:0}).file.data,scopePhoto.data);}
 assert.equal(f.post({action:'calendarTestFile',code:'student-a',id:p.id,index:0,expectedSequence:0}).authRequired,true);
});
