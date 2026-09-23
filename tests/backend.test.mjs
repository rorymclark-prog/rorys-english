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
    Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:"sha256"},computeDigest:(_a,t)=>createHash("sha256").update(t).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString("base64url"),base64DecodeWebSafe:t=>Buffer.from(t,'base64url'),formatDate:()=> "2026-09-17",newBlob:t=>({getBytes:()=>Buffer.from(t),getDataAsString:()=>Buffer.from(t).toString()})},
    UrlFetchApp:{fetch:()=>{identity.calls++;return {getResponseCode:()=>identity.status,getContentText:()=>JSON.stringify({users:[identity.user]})};}},
    Session:{getScriptTimeZone:()=>"Europe/Vienna"},SpreadsheetApp:{openById:()=>ss},
    DriveApp:new Proxy({}, {get(){throw Error("Resource read touched Drive");}}),
    studentByAnyCode_:code=>[roster.code,roster.parentCode].includes(code)?roster:null,
    json_:x=>x,now_:()=>"2026-09-17 12:00",sanitize_:x=>/^[=+\-@]/.test(String(x))?"'"+x:x,
    aiCount_:code=>Number(props.get("ai_"+code)||0),aiKey_:code=>"ai_"+code,
    legacyPost_:e=>{const p=JSON.parse(e.postData.contents);assert.equal(p.callback,undefined);return {ok:true,action:p.action};},
    upsertHomework_(){},setAssignmentStatus_(){},pruneAiCounters_(){},
  };
  vm.createContext(ctx);vm.runInContext(fs.readFileSync("apps-script/progress-sync/V2.gs","utf8"),ctx);
  vm.runInContext(fs.readFileSync("apps-script/progress-sync/FirebaseAuth.gs","utf8"),ctx);
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
test("shared-device sessions keep the six-hour limit; only an authenticated teacher can remember",()=>{
  const f=fixture(),s=f.post({action:"login",code:"__teacher__",credential:"synthetic-teacher",remember:false});
  assert.ok(s.expires-Date.now()<=21600000);f.cache.clear();
  assert.equal(f.post({action:"teacherDashboard",session:s.token}).authRequired,true);
  assert.equal(f.post({action:"login",code:"__teacher__",credential:"wrong",remember:true}).ok,false);
  const access=f.post({action:"teacherAccess",code:"student-a",session:f.teacher()});
  const student=f.post({action:"login",code:"student-a",credential:access.access,remember:true});
  assert.equal(student.role,"student");assert.ok(student.expires-Date.now()<=21600000);
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
