// Isolated in-memory demo API. No Drive, API keys, or real student records.
import http from "node:http";
import {randomUUID} from "node:crypto";
const sessions=new Map(),submissions=[];
const student={code:"valentin-q9m2",name:"Valentin",summary:{homeworkDone:0,quizRounds:0,bestQuizPct:"—",schoolTests:0,writingSamples:0,lastUpdated:"Demo only",daysSinceActivity:null},focusNote:"Demo preview — not a real assignment."};
const assignments={headers:["Date","Title","Details","Due","Status","Id"],rows:[["2026-09-17","Demo writing task","TEST DATA: Write two sentences about a hobby. This is a workflow check, not Unit 1 textbook content.","2026-09-21","open","demo-task"]]};
const empty={headers:[],rows:[]};
const server=http.createServer(async(req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.setHeader("Content-Type","application/json");
  if(req.method==="OPTIONS"){res.end();return;}
  let text="";for await(const chunk of req){text+=chunk;if(text.length>60000){res.statusCode=413;res.end();return;}}
  let p;try{p=JSON.parse(text||"{}");}catch{res.statusCode=400;res.end("{}");return;}
  let result={ok:true};
  if(p.action==="login"){
    if(p.credential!=="demo-only")result={ok:false,error:"Use demo-only for this local test."};
    else {const token=randomUUID();sessions.set(token,{code:p.code,role:p.code==="__teacher__"?"teacher":"student"});result={ok:true,token,expires:Date.now()+21600000,role:p.code==="__teacher__"?"teacher":"student"};}
  } else if(!sessions.has(p.session))result={ok:false,authRequired:true,error:"Sign in to the local demo."};
  else {
    const session=sessions.get(p.session);
    if(session.role!=="teacher"&&p.code!==session.code)result={ok:false,error:"Access denied"};
    else if(p.action==="logout")sessions.delete(p.session);
    else if(p.action==="note")result={ok:true,note:"Demo preview — no real homework has been assigned."};
    else if(p.action==="assignments")result={ok:true,assignments};
    else if(p.action==="submissions")result={ok:true,submissions};
    else if(p.action==="resources")result={ok:true,resources:[]};
    else if(p.action==="teacherDashboard")result={ok:true,students:[student],generatedAt:"Local demo"};
    else if(p.action==="progress")result={ok:true,name:"Demo learner",homework:empty,quizzes:empty,schoolTests:empty,writing:empty,speaking:empty,mockTests:empty};
    else if(p.action==="submit"){
      if(!submissions.some(s=>s.id===p.id))submissions.push({id:p.id,task:p.task,unit:p.unit,submitted:new Date().toISOString(),answers:p.answers,status:"submitted",feedback:"",reviewed:""});
      result={ok:true,id:p.id};
    } else if(p.action==="teacherReview"&&session.role==="teacher"){
      const row=submissions.find(s=>s.id===p.id);if(row)Object.assign(row,{status:p.status,feedback:p.feedback,reviewed:new Date().toISOString()});
    } else result={ok:false,error:"This action is not connected in the local demo. No external request was made."};
  }
  res.end(JSON.stringify(result));
});
server.listen(4174,"127.0.0.1",()=>console.log("Isolated demo API: http://127.0.0.1:4174 · synthetic data only"));
