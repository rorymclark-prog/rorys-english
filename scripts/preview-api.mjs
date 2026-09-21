// Isolated in-memory demo API. No Drive, API keys, or real student records.
import http from "node:http";
import {randomUUID} from "node:crypto";
const sessions=new Map(),submissions=[],documents=[],chats=[];
const student={code:"valentin-q9m2",name:"Valentin",summary:{homeworkDone:0,quizRounds:0,bestQuizPct:"—",schoolTests:0,writingSamples:0,lastUpdated:"Demo only",daysSinceActivity:null},focusNote:"Demo preview — not a real assignment."};
const assignments={headers:["Date","Title","Details","Due","Status","Id"],rows:[["2026-09-17","Demo writing task","TEST DATA: Write two sentences about a hobby. This is a workflow check, not Unit 1 textbook content.","2026-09-21","open","demo-task"]]};
const empty={headers:[],rows:[]};
const server=http.createServer(async(req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.setHeader("Content-Type","application/json");
  if(req.method==="OPTIONS"){res.end();return;}
  let text="";for await(const chunk of req){text+=chunk;if(text.length>3500000){res.statusCode=413;res.end();return;}}
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
    else if(p.preview&&!['documents','document','documentFile','progress','resources','assignments','note','submissions'].includes(p.action))result={ok:false,error:'Student preview is read-only.'};
    else if(p.action==='documents')result={ok:true,documents:documents.filter(d=>d.code===p.code).map(({storedFiles,...d})=>d).reverse()};
    else if(p.action==='documentUpload'){
      let d=documents.find(d=>d.code===p.code&&d.id===p.id);
      if(!d){d={id:p.id,code:p.code,title:p.title,context:p.context,parentId:p.parentId,created:new Date().toISOString(),uploadedBy:session.role==='teacher'?'Rory':'Student',files:p.files.map((f,index)=>({index,name:f.name,type:f.type,size:Buffer.from(f.data,'base64').length})),storedFiles:p.files,status:'saved',analysis:null,feedback:'',reviewed:'',processing:false,error:''};documents.push(d);}
      const {storedFiles,...safe}=d;result={ok:true,received:true,document:safe};
    }
    else if(['document','documentFile','documentAnalyse','documentChat','teacherDocumentReview'].includes(p.action)){
      const d=documents.find(d=>d.code===p.code&&d.id===p.id);
      if(!d)result={ok:false,error:'Document not found.'};
      else if(p.action==='documentFile')result={ok:true,file:d.storedFiles[p.index]};
      else {
        if(p.action==='documentAnalyse'){d.status='ready';d.analysis={transcription:'Page 1\nI go to the park yesterday. I play football with my friends.',coverage:'complete',uncertainties:[],summary:'You have made the activity clear. Let’s make the time of the story clear too.',strengths:['Your reader knows where you went and who you were with.','You use two clear, short sentences.'],corrections:[{original:'I go to the park yesterday.',suggestion:'I went to the park yesterday.',explanation:'Yesterday tells us to use the past simple. Go changes to went.'}],retry:'Write one new sentence about yesterday. Use a different past-tense verb.'};}
        if(p.action==='documentChat'&&!chats.some(c=>c.id===p.messageId))chats.push({id:p.messageId,document:p.id,code:p.code,question:p.question,answer:'In “I go”, change go to went because the visit happened yesterday. What did you do after that? Try one sentence of your own.',askedBy:session.role==='teacher'?'Rory':'Student'});
        if(p.action==='teacherDocumentReview'&&session.role==='teacher'){d.feedback=p.feedback;d.reviewed=new Date().toISOString();}
        const {storedFiles,...safe}=d;result={ok:true,document:safe,messages:chats.filter(c=>c.document===p.id&&c.code===p.code)};
      }
    }
    else if(p.action==="note")result={ok:true,note:"Demo preview — no real homework has been assigned."};
    else if(p.action==="assignments")result={ok:true,assignments};
    else if(p.action==="submissions")result={ok:true,submissions:submissions.filter(s=>s.code===p.code)};
    else if(p.action==="resources")result={ok:true,resources:[]};
    else if(p.action==="teacherDashboard")result={ok:true,students:[student],generatedAt:"Local demo"};
    else if(p.action==="progress")result={ok:true,name:"Demo learner",homework:empty,quizzes:empty,schoolTests:empty,writing:empty,speaking:empty,mockTests:empty};
    else if(p.action==="submit"){
      if(!submissions.some(s=>s.id===p.id))submissions.push({id:p.id,code:p.code,title:p.title,prompts:p.prompts,task:p.task,unit:p.unit,submitted:new Date().toISOString(),answers:p.answers,status:"submitted",feedback:"",reviewed:""});
      result={ok:true,id:p.id,received:submissions.find(s=>s.id===p.id).submitted};
    } else if(p.action==="teacherReview"&&session.role==="teacher"){
      const row=submissions.find(s=>s.id===p.id);if(row)Object.assign(row,{status:p.status,feedback:p.feedback,reviewed:new Date().toISOString()});
    } else result={ok:false,error:"This action is not connected in the local demo. No external request was made."};
  }
  res.end(JSON.stringify(result));
});
server.listen(4174,"127.0.0.1",()=>console.log("Isolated demo API: http://127.0.0.1:4174 · synthetic data only"));
