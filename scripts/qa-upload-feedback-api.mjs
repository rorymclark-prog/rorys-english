// Local, synthetic browser fixture. Never forwards requests or calls AI.
import http from 'node:http';
const code='valentin-q9m2',id='synthetic-worksheet-review-0001';let checked=false;
const analysis={workType:'worksheet',transcription:'[Page 1]\nGROW growth\nHIGH highter\nCHEAP [unclear]\nPOOR',coverage:'complete',uncertainties:['The spelling in answer 3 needs confirmation.'],summary:'You chose a useful noun form. Check the comparative spelling in answer 2.',strengths:['You used growth as a noun.'],corrections:[],retry:'Write a new sentence comparing two places.',writing:{original:'',comparisons:[]},answerReview:[{label:'1',prompt:'GROW',response:'growth',status:'correct',correction:'',note:'The noun fits this gap.'},{label:'2',prompt:'HIGH',response:'highter',status:'needs-change',correction:'higher',note:'Add -er without t to compare heights.'},{label:'3',prompt:'CHEAP',response:'[unclear]',status:'uncertain',correction:'',note:'Please confirm the final spelling.'},{label:'4',prompt:'POOR',response:'',status:'not-answered',correction:'',note:'Look for a noun. Try your own answer.'}]};
const document={id,title:'Sample school worksheet',created:'2026-10-09T12:00:00Z',uploadedBy:'Student',files:[{index:0,name:'worksheet.pdf',type:'application/pdf',size:120}],status:'ready',feedback:'',reviewed:'',parentId:'',context:'[Document role: answer]\n[Work source: School homework — set by the school]',error:'',processing:false,workType:'worksheet',analysis};
const writing={...document,id:'synthetic-written-exercise-0002',title:'Sample written exercise',context:'[Document role: answer]',workType:'writing',analysis:{...analysis,workType:'writing',transcription:'I go to the park yesterday.',uncertainties:[],answerReview:[],writing:{original:'I go to the park yesterday.',comparisons:[{original:'I go to the park yesterday.',corrected:'I went to the park yesterday.',improved:'',note:'Use the past simple for yesterday.'}]}}};
const audio={...document,id:'synthetic-audio-conversation-003',title:'AI conversation audio · Open chat',context:'',workType:'conversation',files:[{index:0,name:'chat.webm',type:'audio/webm',size:50}],status:'saved',analysis:null};
function publicDoc(d,teacher,full=false){const {analysis,...meta}=d;return {...meta,...(full?{analysis}:{}),...(teacher&&analysis?{analysisVersion:'synthetic-version-1',needsTeacherCheck:d.id===id&&!checked,checkedAt:d.id===id&&checked?'2026-10-28T09:00:00Z':''}:{})};}
const docs=[audio,document,writing];
http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:4290');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS'){res.end();return;}let raw='';for await(const c of req)raw+=c;let p;try{p=JSON.parse(raw);}catch{res.writeHead(400);res.end();return;}const teacher=p.session==='synthetic-teacher'&&!p.preview;let r={ok:true};
if(p.action==='login')r={ok:true,token:p.code==='__teacher__'?'synthetic-teacher':'synthetic-student',role:p.code==='__teacher__'?'teacher':'student',expires:Date.now()+3600000};
else if(p.action==='documents')r={ok:true,documents:docs.map(d=>publicDoc(d,teacher))};
else if(p.action==='document'){const d=docs.find(d=>d.id===p.id);r={ok:!!d,document:d&&publicDoc(d,teacher,true),messages:[]};}
else if(p.action==='teacherDocumentCheck'){if(!teacher||p.analysisVersion!=='synthetic-version-1')r={ok:false};else{checked=true;r={ok:true,document:publicDoc(document,true,true)};}}
else if(p.action==='teacherDashboard')r={ok:true,students:[{code,name:'Sample learner',summary:null,focusNote:''}]};
else if(p.action==='teacherNotifications'||p.action==='notifications')r={ok:true,events:teacher?[{id:'document:'+id,code,name:'Sample learner',at:document.created,kind:'upload',title:checked?'Work uploaded':'Check feedback',detail:document.title,view:'documents',read:false,needsCheck:!checked}]:[],unread:teacher?1:0};
else if(p.action==='learningRecords')r={ok:true,records:[],replies:[]};
else if(p.action==='progress')r={ok:true,submissions:[],assignments:[],results:[],notes:[]};
else if(p.action==='assignments')r={ok:true,assignments:[]};
else if(p.action==='submissions')r={ok:true,submissions:[]};
else if(p.action==='resources')r={ok:true,resources:[]};
else if(p.action==='calendarLessons'||p.action==='teacherCalendarLessons')r={ok:true,lessons:[],tests:[],requests:[],breaks:[]};
else if(p.action==='learningMemory')r={ok:true,memory:{enabled:true,entries:[],focus:[]}};
res.setHeader('Content-Type','application/json');res.end(JSON.stringify(r));
}).listen(4291,'127.0.0.1',()=>console.log('Synthetic feedback fixture on 127.0.0.1:4291'));
