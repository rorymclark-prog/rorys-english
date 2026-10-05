// Synthetic, in-memory dashboard fixture. No production service or AI requests.
import http from 'node:http';import fs from 'node:fs';
const lessons=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/dashboard-lesson.json',import.meta.url),'utf8'));
const records=new Map([['ferdi-7h3k',lessons],['valentin-q9m2',[]]]),sessions=new Map();
const students=['ferdi-7h3k','valentin-q9m2'].map((code,i)=>({code,name:i?'Valentin':'Ferdi',focusNote:'Synthetic dashboard preview',summary:{homeworkDone:1,quizRounds:1,bestQuizPct:100,writingSamples:1,lastUpdated:'2026-07-18'}}));
http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Content-Type','application/json');if(req.method==='OPTIONS'){res.end();return;}let text='';for await(const part of req)text+=part;const p=JSON.parse(text||'{}');let result={ok:false,error:'Unsupported synthetic action'};
if(p.action==='login'&&p.credential==='demo-only'){const token=crypto.randomUUID(),role=p.code==='__teacher__'?'teacher':'student';sessions.set(token,{role,code:p.code});result={ok:true,token,role,expires:Date.now()+3600000};}
else if(sessions.has(p.session)){const session=sessions.get(p.session),all=records.get(p.code)||[];if(p.action==='teacherDashboard')result={ok:true,students};
else if(p.action==='learningRecords')result={ok:true,records:session.role==='teacher'&&!p.preview?all:all.filter(r=>r.visibility==='shared').map(r=>{const {tutorPrivate,...body}=r.body;return {...r,body};}),replies:[]};
else if(p.action==='teacherSaveLearningRecord'&&session.role==='teacher'){const record={...p,created:new Date().toISOString(),author:'Rory'};delete record.session;const rows=all.filter(r=>r.id!==p.id);records.set(p.code,[...rows,record]);result={ok:true,record};}
else if(p.action==='assignments')result={ok:true,assignments:{headers:['Date','Title','Details','Due','Status','Id'],rows:[['2026-09-23','Two practice sets','Chat 1: Tell a story. Chat 2: Compare','','open','combined']]}};
else if(p.action==='submissions')result={ok:true,submissions:[{id:'answer',unit:'english-in-context5-unit01-2026',task:'hw:1',submitted:'2026-10-03',status:'reviewed',answers:{story:'Synthetic answer'},feedback:'Reviewed synthetic answer.'}]};
else if(p.action==='progress')result={ok:true,quizzes:{headers:['Date','Tool','Section','Score','Max','%'],rows:[['2026-07-18','Quiz','Old quiz',5,5,100]]}};
else if(['documents','learningMemory','calendarLessons'].includes(p.action))result={ok:true,documents:[],lessons:[],breaks:[],requests:[],tests:[]};
}
res.end(JSON.stringify(result));}).listen(4198,'127.0.0.1',()=>console.log('Synthetic dashboard API on 4198'));
