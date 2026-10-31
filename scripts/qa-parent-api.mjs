// Local-only synthetic parent portal fixture. No Google, AI or learner-record writes.
import http from 'node:http';
const testPort=Number(process.env.QA_PARENT_PORT||4313),testOrigin=process.env.QA_PARENT_ORIGIN||'http://127.0.0.1:4312';
const stamp='2026-10-30T12:00:00Z',codeA='ferdi-fam-3p9k',codeB='valentin-fam-8w2d';
const snapshot={version:1,unitId:'synthetic-unit',unitTitle:'Synthetic task',protocol:'Five independent grammar forms',help:'independent',stage:'checkpoint',vocabularySource:'',words:[],nextCheck:'Try a different situation.',results:[{domain:'grammar',criterion:'Five correct past forms',earned:4,possible:5,evidenceType:'written'}]};
const record=(id,kind,body)=>({id,kind,body,visibility:'shared',title:`Synthetic ${kind} feedback`,date:'2026-10-30',created:stamp,author:'Student'});
const practiceAttempts=['go','went'].map((answer,index)=>({id:'synthetic-attempt-'+index,documentId:'synthetic-parent-document',version:'synthetic-practice-v1',exerciseId:'past-forms',created:`2026-10-${30+index}T12:00:00Z`,answer,result:{status:index?'correct':'try-again',example:'went',explanation:'Use the past simple for a completed event.'}}));
const doc={practiceVersion:'synthetic-practice-v1',practiceAttempts,id:'synthetic-parent-document',title:'Synthetic written answer',created:stamp,uploadedBy:'Student',files:[],status:'ready',feedback:'An additional teacher comment.',reviewed:stamp,parentId:'',context:'',error:'',processing:false,workType:'writing'};
const server=http.createServer(async(request,response)=>{
 response.setHeader('Access-Control-Allow-Origin',testOrigin);response.setHeader('Access-Control-Allow-Headers','Content-Type');response.setHeader('Content-Type','application/json');if(request.method==='OPTIONS'){response.end();return;}
 let raw='';for await(const part of request)raw+=part;let body;try{body=JSON.parse(raw);}catch{response.statusCode=400;response.end('{}');return;}
 const own=[codeA,codeB].includes(body.code),session=body.session===`synthetic-${body.code}`;let result={ok:false,authRequired:true};
 if(body.action==='login'&&own&&body.credential==='parent-test')result={ok:true,token:`synthetic-${body.code}`,expires:Date.now()+3600000,role:'parent'};
 else if(own&&session){
 if(body.action==='learningRecords')result={ok:true,records:[record('synthetic-conversation','speaking',{plainAiFeedback:{summary:'A clear account of a journey.',targets:['Use a past form.']},transcript:'Student: I went home.'}),record('synthetic-teacher-comment','homework',{plainReview:{summary:'An extra helpful comment.'}}),{...record('synthetic-shared-marks','test',{skillSnapshot:snapshot,source:'skill-progress-summary:synthetic'}),author:'Rory'}],replies:[]};
 if(body.action==='documents')result={ok:true,documents:body.code===codeA?[doc]:[]};
 if(body.action==='document')result={ok:true,document:{...doc,analysis:{summary:'A useful written first attempt.',strengths:['A clear sequence.'],retry:'Try a new event.',transcription:'I go home yesterday.',coverage:'complete',uncertainties:[],corrections:[],exercises:[{id:'past-forms',type:'choice',focus:'Past simple',prompt:'Yesterday I ___ home.',options:['go','went']},{id:'new-event',type:'write',focus:'A new event',prompt:'Describe a different event.',options:[]}],writing:{original:'I go home yesterday.',corrected:'I went home yesterday.',comparisons:[]}}},messages:[]};
 if(body.action==='progress')result={ok:true,homework:{headers:[],rows:[]}};
 if(body.action==='calendarLessons')result={ok:true,lessons:[{id:'synthetic-lesson',studentCode:'ferdi-7h3k',studentName:'Ferdi',date:'2026-11-14',time:'10:00',duration:90,start:'2026-11-14T09:00:00Z',end:'2026-11-14T10:30:00Z',title:'Synthetic lesson',location:'Home',status:'scheduled',sequence:0}],requests:[],breaks:[],tests:[]};
 if(body.action==='logout')result={ok:true};
 }
 response.end(JSON.stringify(result));
});
server.listen(testPort,'127.0.0.1',()=>console.log(`Synthetic parent API on http://127.0.0.1:${testPort}; credential parent-test`));
