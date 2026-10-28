import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
const sample={name:'work.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.4\nSynthetic learner work\n%%EOF').toString('base64')};
function fixture(){
 const props=new Map([['TEACHER_PASSWORD','synthetic-only'],['sheet_student-a','sheet-a'],['sheet_student-b','sheet-b'],['ANTHROPIC_API_KEY','mock-key']]),cache=new Map(),books=new Map(),files=new Map(),folders=new Map();
 let aiCalls=0,aiStatus=200,aiHook=null;
 const analysis={transcription:'Page 1\nI go to the park yesterday.',coverage:'complete',uncertainties:[],summary:'A short account of a visit.',strengths:['The main idea is clear.'],corrections:[{original:'I go',suggestion:'I went',explanation:'Use the past simple for yesterday.'}],retry:'Write one more sentence about yesterday.',writing:{original:'I go to the park yesterday.',comparisons:[{original:'I go to the park yesterday.',corrected:'I went to the park yesterday.',improved:'',note:'Use the past simple for yesterday.'}]}};
 const blob=(bytes,type,name)=>({getBytes:()=>Array.from(typeof bytes==='string'?Buffer.from(bytes):bytes),getDataAsString:()=>Buffer.from(bytes).toString(),type,name});
 function spreadsheet(id){if(books.has(id))return books.get(id);const sheets=new Map(),book={sheets,getSheetByName:n=>sheets.get(n)||null,insertSheet:n=>{const data=[],sh={data,getDataRange:()=>({getValues:()=>data.map(r=>r.slice())}),appendRow:r=>data.push(r.slice()),getRange:(row,col)=>({setValues:vs=>vs.forEach((r,i)=>r.forEach((v,j)=>{data[row-1+i]||=[];data[row-1+i][col-1+j]=v;})),setValue:v=>{data[row-1]||=[];data[row-1][col-1]=v;}})};sheets.set(n,sh);return sh;}};books.set(id,book);return book;}
 function folder(){const folderFiles=[],id=randomUUID(),f={getFiles:()=>{let i=0;return {hasNext:()=>i<folderFiles.length,next:()=>folderFiles[i++]};},getId:()=>id,access:'PRIVATE',getSharingAccess:()=>f.access,getEditors:()=>[],getViewers:()=>[],createFolder:folder,createFile:b=>{const fid=randomUUID(),file={getName:()=>b.name,getId:()=>fid,getBlob:()=>b,setTrashed:t=>{file.trashed=t;}};files.set(fid,file);folderFiles.push(file);return file;}};folders.set(id,f);return f;}
 const property={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)},ctx={console,Date,JSON,Object,Array,String,Number,Math,isFinite,SECRET:'private',TEACHER_PASSWORD_PROP:'TEACHER_PASSWORD',AI_DAILY_CAP:40,
 PropertiesService:{getScriptProperties:()=>property},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getScriptTimeZone:()=> 'Europe/Vienna'},Utilities:{getUuid:randomUUID,base64Decode:s=>Array.from(Buffer.from(s,'base64')),base64Encode:b=>Buffer.from(b.map(v=>(v+256)%256)).toString('base64'),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),computeDigest:(_,s)=>createHash('sha256').update(s).digest(),DigestAlgorithm:{SHA_256:'sha256'},newBlob:blob,formatDate:()=> '2026-09-21'},SpreadsheetApp:{openById:spreadsheet},DriveApp:{Access:{PRIVATE:'PRIVATE'},createFolder:folder,getFolderById:id=>folders.get(id),getFileById:id=>files.get(id)},
 studentByAnyCode_:c=>c==='student-a'||c==='parent-a'?{code:'student-a',parentCode:'parent-a',name:'Synthetic A'}:c==='student-b'?{code:'student-b',name:'Synthetic B'}:null,
 sanitize_:s=>/^[=+\-@]/.test(s)?"'"+s:s,json_:v=>v,aiCount_:c=>Number(props.get('ai_'+c)||0),aiKey_:c=>'ai_'+c,pruneAiCounters_(){},legacyPost_:()=>({ok:true}),
 UrlFetchApp:{fetch:(_url,o)=>{aiCalls++;if(aiHook)aiHook();const payload=JSON.parse(o.payload);let value;
 if(payload.output_config?.format){
  if(payload.system.startsWith('TRANSCRIBE ONLY'))value={transcription:analysis.transcription,original:analysis.writing?.original||'',task:'',workType:analysis.workType||'writing',coverage:analysis.coverage,uncertainties:analysis.uncertainties,teacherNotes:''};
  else {const original=analysis.writing?.original||'',quote=original.slice(0,Math.min(30,original.length));value={summary:analysis.summary,strengths:analysis.strengths,corrections:analysis.corrections,retry:analysis.retry,answerReview:analysis.answerReview||[],comparisons:(analysis.writing?.comparisons||[]).map(r=>({...r,checks:{spelling:'ok',grammar:'ok',wordChoice:'ok',punctuation:'ok',flow:'ok',taskFit:'ok'}})),model:'',modelNotes:[],exercises:original?Array.from({length:4},(_,i)=>({id:'synthetic-exercise-000'+i,type:'gap',prompt:'Sample person '+i+' ___ at home.',options:[],accepted:['is'],example:'is',explanation:'Use is with one person.',sourceQuote:quote,focus:'A new sentence'})):[],teacherNotes:''};}
 }
 return {getResponseCode:()=>aiStatus,getContentText:()=>JSON.stringify(value?{model:'claude-opus-5-5',content:[{type:'thinking',thinking:''},{type:'text',text:JSON.stringify(value)}]}:payload.tools?{content:[{type:'tool_use',name:'record_document',input:analysis}]}:{content:[{type:'text',text:'In “I go”, use the past simple: “I went”. Try one more sentence.'}]})};}}
 };
 vm.createContext(ctx);for(const f of ['V2.gs','Calendar.gs','Documents.gs','DocumentAnalysis.gs','DocumentPractice.gs','WorkFeedback.gs','Learning.gs'])vm.runInContext(fs.readFileSync('apps-script/progress-sync/'+f,'utf8'),ctx);
 const session=role=>ctx.issueSession_(role==='teacher'?'__teacher__':role==='parent'?'parent-a':role==='other'?'student-b':'student-a',role==='other'?'student':role).token;
 const postOnce=(body,role='student')=>ctx.doPost({postData:{contents:JSON.stringify({code:'student-a',session:session(role),...body})}});
 const post=(body,role='student')=>{let r=postOnce(body,role);for(let i=0;i<2&&r.continueAnalysis;i++)r=postOnce(body,role);return r;};
 const upload=(extra={},role='student')=>post({action:'documentUpload',id:randomUUID(),title:'Synthetic work',context:'A short paragraph',files:[sample],...extra},role);
 return {ctx,props,books,files,folders,analysis,post,postOnce,upload,get calls(){return aiCalls;},set status(s){aiStatus=s;},set hook(h){aiHook=h;}};
}
test('documents authenticate every entry point and isolate student, teacher, parent and preview roles',()=>{
 const f=fixture(),id=f.upload().document.id;
 for(const action of ['documents','document','documentFile','documentUpload','documentAnalyse','documentChat','teacherDocumentReview']){
  assert.equal(f.post({action,id,index:0,session:''}).authRequired,true);
  assert.equal(f.post({action,id,index:0},'other').ok,false);
  assert.equal(f.post({action,id,index:0,code:'parent-a'},'parent').ok,['documents','document','documentFile'].includes(action));
 }
 assert.equal(f.post({action:'document',id},'teacher').ok,true);
 assert.equal(f.post({action:'document',id,code:'student-b'},'teacher').ok,false);
 for(const action of ['documentUpload','documentAnalyse','documentChat','teacherDocumentReview'])assert.equal(f.post({action,id,preview:true},'teacher').ok,false);
 assert.equal(f.post({action:'teacherDocumentReview',id,feedback:'forged'}).ok,false);
 assert.equal(f.calls,0);
});
test('learning reviews keep tutor reflection private while parents see learner work and replies',()=>{
 const f=fixture(),id=randomUUID(),body={summary:'A clear reason.',strengths:['Uses an example'],targets:['Explain the conclusion'],nextStep:'Rewrite two sentences.',tutorPrivate:{worked:'Good oral rehearsal',improve:'Leave more writing time'}};
 assert.equal(f.post({action:'teacherSaveLearningRecord',id,date:'2026-09-23',kind:'homework',title:'Writing review',body},'teacher').ok,true);
 assert.equal(f.post({action:'learningRecords'},'student').records[0].body.tutorPrivate,undefined);
 const parent=f.post({action:'learningRecords',code:'parent-a'},'parent');assert.equal(parent.ok,true);assert.equal(parent.records[0].body.summary,'A clear reason.');assert.equal(parent.records[0].body.tutorPrivate,undefined);
 assert.equal(f.post({action:'learningRecords'},'teacher').records[0].body.tutorPrivate.worked,'Good oral rehearsal');
 assert.equal(f.post({action:'teacherSaveLearningRecord',id:randomUUID(),date:'2026-09-23',kind:'lesson',title:'Private tutor note',visibility:'teacher',body:{summary:'Teacher-only next plan.'}},'teacher').ok,true);
 const preview=f.post({action:'learningRecords',preview:true},'teacher');assert.equal(preview.records.length,1);assert.equal(preview.records[0].body.tutorPrivate,undefined);
 assert.equal(f.post({action:'learningReply',id:randomUUID(),reviewId:id,answer:'My new conclusion.'}).received,true);
 assert.equal(f.post({action:'learningRecords',code:'parent-a'},'parent').replies.length,1);
 assert.equal(f.post({action:'learningReply',id:randomUUID(),reviewId:id,answer:'forged',code:'parent-a'},'parent').ok,false);
});
test('learning reviews return a short date when Sheets converts the date cell',()=>{
 const f=fixture(),id=randomUUID();
 assert.equal(f.post({action:'teacherSaveLearningRecord',id,date:'2026-09-21',kind:'lesson',title:'Lesson note',body:{summary:'A useful practice.'}},'teacher').ok,true);
 const sheet=f.books.get('sheet-a').sheets.get('Learning reviews');
 sheet.data[1][2]=new Date('2026-09-21T00:00:00+02:00');
 assert.equal(f.post({action:'learningRecords'},'teacher').records[0].date,'2026-09-21');
});
test('a speaking record links only to its own private audio sample',()=>{
 const f=fixture(),id=randomUUID(),voice={name:'sample.webm',type:'audio/webm',data:Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3,4,5,6,7,8]).toString('base64')};
 assert.equal(f.post({action:'speakingSave',id,title:'Conversation',transcript:'You: A short answer.',reflection:'I gave a reason.'}).received,true);
 const upload=f.upload({files:[voice]});assert.equal(upload.ok,true);
 assert.equal(f.post({action:'speakingAttachAudio',id,documentId:upload.document.id}).ok,true);
 assert.equal(f.post({action:'learningRecords',code:'parent-a'},'parent').records[0].body.audioDocumentId,upload.document.id);
 assert.equal(f.post({action:'documentFile',id:upload.document.id,index:0,code:'parent-a'},'parent').file.data,voice.data);
 assert.equal(f.post({action:'documentAnalyse',id:upload.document.id}).ok,false);
 assert.equal(f.calls,0);
});
test('a tutor can review a saved speaking sample without replacing its original',()=>{
 const f=fixture(),id=randomUUID(),voice={name:'sample.webm',type:'audio/webm',data:Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3,4,5,6,7,8]).toString('base64')};
 assert.equal(f.post({action:'speakingSave',id,title:'Conversation',transcript:'You: I gave a reason.',reflection:'A useful phrase.'}).ok,true);
 const audio=f.upload({files:[voice]}).document.id;
 assert.equal(f.post({action:'speakingAttachAudio',id,documentId:audio}).ok,true);
 const reviewId=randomUUID(),review={summary:'The learner gave a clear reason.',strengths:['Audible, complete answer'],targets:['Pause between ideas'],nextStep:'Try the same task again.',ratings:{organisation:3,intelligibility:3}};
 assert.equal(f.post({action:'teacherReviewSpeaking',id,reviewId,review},'student').ok,false);
 assert.equal(f.post({action:'teacherReviewSpeaking',id,reviewId,review,preview:true},'teacher').ok,false);
 assert.equal(f.post({action:'teacherReviewSpeaking',id,reviewId,review},'teacher').ok,true);
 const parent=f.post({action:'learningRecords',code:'parent-a'},'parent').records[0];
 assert.equal(parent.body.audioDocumentId,audio);assert.equal(parent.body.transcript,'You: I gave a reason.');
 assert.equal(parent.body.audioReview,undefined);assert.equal(parent.body.ratings.organisation,undefined);
 const teacher=f.post({action:'learningRecords'},'teacher').records[0];assert.equal(teacher.body.audioReview.summary,review.summary);assert.equal(teacher.body.ratings.organisation,3);
 assert.equal(f.post({action:'teacherReviewSpeaking',id,reviewId,review},'teacher').ok,true);
 assert.equal(f.books.get('sheet-a').sheets.get('Learning reviews').data.length,4);
 const rows=f.books.get('sheet-a').sheets.get('Learning reviews').data,last=rows.at(-1),body=JSON.parse(last[6]);body.audioReviewAvailableAt=new Date(Date.now()-1).toISOString();last[6]=JSON.stringify(body);
 assert.equal(f.post({action:'learningRecords',code:'parent-a'},'parent').records[0].body.audioReview.summary,review.summary);
});
test('upload stores original bytes privately, receipts are idempotent, revisions keep both originals',()=>{
 const f=fixture(),id=randomUUID(),first=f.upload({id},'teacher');assert.equal(first.received,true);assert.equal(first.document.uploadedBy,'Rory');
 assert.equal(f.upload({id,title:'Changed after uncertain response'}).document.title,'Synthetic work');assert.equal(f.files.size,1);
 const loaded=f.post({action:'documentFile',id,index:0});assert.equal(loaded.file.data,sample.data);
 assert.equal(JSON.stringify(first).includes('private_documents_'),false);assert.equal(first.document.files[0].id,undefined);
 const revision=f.upload({parentId:id});assert.equal(revision.ok,true);assert.equal(revision.document.parentId,id);assert.equal(f.files.size,2);
 assert.equal(f.upload({parentId:'unknown'}).ok,false);
 assert.equal(f.post({action:'documentFile',id,index:99}).ok,false);
 assert.equal(f.post({action:'documents'}).documents.length,2);
});
test('invalid, oversized and disguised files never reach Drive',()=>{
 const f=fixture();for(const files of [[],[sample,sample],[{...sample,type:'text/html'}],[{...sample,data:Buffer.from('<html>not a PDF</html>').toString('base64')}],[{...sample,data:'?badbase64'}],[{...sample,data:Buffer.from('%PDF-'+ 'a'.repeat(2500000)).toString('base64')}]])assert.equal(f.upload({files}).ok,false);
 assert.equal(f.files.size,0);
 const large={name:'large.pdf',type:'application/pdf',data:Buffer.from('%PDF-'+ 'a'.repeat(100000)).toString('base64')};assert.equal(f.upload({files:[large]}).ok,true);
});
test('storage fails closed if its dedicated folder was shared',()=>{
 const f=fixture();f.upload();const root=f.folders.get(f.props.get('private_document_root'));root.access='ANYONE';assert.equal(f.upload().ok,false);assert.equal(f.files.size,1);
});
test('analysis is saved, grounded corrections are validated and repeated analysis costs nothing',()=>{
 const f=fixture(),id=f.upload().document.id;assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,2);assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,2);
 const read=f.post({action:'document',id});assert.equal(read.document.analysis.transcription,f.analysis.transcription);assert.equal(read.document.feedback,'');assert.equal(read.document.status,'ready');
 assert.equal(f.ctx.documentAnalysisValid_({...f.analysis,corrections:[{original:'not in source',suggestion:'invented',explanation:'bad'}]}),false);
});
test('worksheet review checks every supplied answer without turning unclear or unanswered items into corrections',()=>{
 const f=fixture(),base={...f.analysis,workType:'worksheet',transcription:'[Page 1]\nGROW growth\nHIGH highter\nCHEAP [unclear]\nPOOR',corrections:[],writing:{original:'',comparisons:[]},answerReview:[
  {label:'1',prompt:'GROW',response:'growth',status:'correct',correction:'',note:'The noun fits.'},
  {label:'2',prompt:'HIGH',response:'highter',status:'needs-change',correction:'higher',note:'Add -er without t.'},
  {label:'3',prompt:'CHEAP',response:'[unclear]',status:'uncertain',correction:'',note:'Please confirm your spelling.'},
  {label:'4',prompt:'POOR',response:'',status:'not-answered',correction:'',note:'Look for the noun form.'}
 ]};
 assert.equal(f.ctx.documentAnalysisValid_(base),true);
 const change=(i,value)=>({...base,answerReview:base.answerReview.map((r,j)=>j===i?{...r,...value}:r)});
 for(const invalid of [change(2,{status:'correct'}),change(2,{correction:'cheaper'}),change(3,{correction:'poverty'}),change(1,{response:'invented'}),change(0,{prompt:'UNSEEN TASK'}),change(1,{correction:''}),change(1,{label:'1'})])assert.equal(f.ctx.documentAnalysisValid_(invalid),false);
 Object.assign(f.analysis,base);const id=f.upload().document.id;
 assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,2);
 assert.equal(f.post({action:'document',id}).document.analysis.answerReview.length,4);
});
test('feedback check receipts are private, version-bound, idempotent and separate from publishing',()=>{
 const f=fixture(),id=f.upload().document.id;f.post({action:'documentAnalyse',id});
 assert.equal(f.books.get('sheet-a').sheets.has('Document checks'),false);
 const teacher=f.post({action:'document',id},'teacher').document;
 assert.equal(teacher.needsTeacherCheck,true);assert.ok(teacher.analysisVersion);
 for(const role of ['student','parent','other'])assert.equal(f.post({action:'teacherDocumentCheck',id,analysisVersion:teacher.analysisVersion},role).ok,false);
 assert.equal(f.post({action:'teacherDocumentCheck',id,analysisVersion:teacher.analysisVersion,preview:true},'teacher').ok,false);
 assert.equal(f.post({action:'teacherDocumentCheck',id,analysisVersion:'stale'},'teacher').ok,false);
 const check={action:'teacherDocumentCheck',id,analysisVersion:teacher.analysisVersion};
 assert.equal(f.post(check,'teacher').document.needsTeacherCheck,false);assert.equal(f.post(check,'teacher').ok,true);
 assert.equal(f.books.get('sheet-a').sheets.get('Document checks').data.length,2);
 for(const extra of [{},{preview:true}]){const d=f.post({action:'document',id,...extra},extra.preview?'teacher':'student').document;assert.equal(d.needsTeacherCheck,undefined);assert.equal(d.analysisVersion,undefined);assert.equal(d.checkedAt,undefined);assert.equal(d.feedback,'');assert.equal(d.reviewed,'');}
 const sh=f.books.get('sheet-a').sheets.get('Documents');sh.data[1][8]='2026-10-01T12:00:00Z';const changed=JSON.parse(sh.data[1][6]);changed.summary='New practice feedback';sh.data[1][6]=JSON.stringify(changed);
 assert.equal(f.post({action:'document',id},'teacher').document.needsTeacherCheck,true);
 assert.equal(f.post({action:'documentFile',id,index:0}).file.data,sample.data);
});
test('a legacy worksheet with an empty prose review is upgraded instead of being returned as complete',()=>{
 const f=fixture(),id=f.upload().document.id,sh=f.books.get('sheet-a').sheets.get('Documents');
 const older={...f.analysis,writing:{original:'',comparisons:[]}};sh.data[1][6]=JSON.stringify(older);sh.data[1][5]='ready';
 assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,2);
 assert.equal(f.post({action:'document',id}).document.analysis.writing.original,f.analysis.writing.original);
 assert.ok([...f.files.values()].some(x=>x.getBlob().name.includes('previous-analysis')));
});
test('analysis failure preserves the original and quota is reserved before calling AI',()=>{
 const f=fixture(),id=f.upload().document.id;f.status=429;assert.equal(f.post({action:'documentAnalyse',id}).ok,false);assert.equal(f.post({action:'document',id}).document.status,'error');assert.equal(f.post({action:'documentFile',id,index:0}).file.data,sample.data);
 f.status=200;f.props.set('ai_student-a','40');assert.equal(f.post({action:'documentAnalyse',id}).ok,false);assert.equal(f.calls,1);
});
test('incomplete AI output is kept privately without replacing a valid earlier review',()=>{
 const f=fixture(),id=f.upload().document.id;
 assert.equal(f.post({action:'documentAnalyse',id}).ok,true);
 const row=f.books.get('sheet-a').sheets.get('Documents').data.find(r=>r[0]===id);
 const earlier=JSON.parse(row[6]);delete earlier.writing;row[6]=JSON.stringify(earlier);
 f.analysis.writing.comparisons=[];
 assert.equal(f.post({action:'documentAnalyse',id}).ok,false);
 assert.deepEqual(JSON.parse(row[6]),earlier);
 assert.equal(row[5],'ready');
 assert.equal([...f.files.values()].filter(file=>file.getBlob().name?.includes('-incomplete-analysis-')).length,2);
 assert.equal(f.post({action:'documentFile',id,index:0}).file.data,sample.data);
});
test('active processing leases prevent concurrent AI charges and expired leases can retry',()=>{
 const f=fixture(),id=f.upload().document.id;let nested;f.hook=()=>{f.hook=null;nested=f.post({action:'documentAnalyse',id});};assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(nested.pending,true);assert.equal(f.calls,2);
 const next=f.upload().document.id,sh=f.books.get('sheet-a').sheets.get('Documents');const row=sh.data.find(r=>r[0]===next);row[11]='stale';row[12]=Date.now()-400000;assert.equal(f.post({action:'documentAnalyse',id:next}).ok,true);
});
test('teacher review and chat persist without replacing AI advice or original, chat retries are idempotent',()=>{
 const f=fixture(),id=f.upload().document.id;f.post({action:'documentAnalyse',id});const messageId=randomUUID();assert.equal(f.post({action:'documentChat',id,messageId,question:'Explain this change.'}).ok,true);assert.equal(f.post({action:'documentChat',id,messageId,question:'Explain this change.'}).ok,true);assert.equal(f.calls,3);
 assert.equal(f.post({action:'teacherDocumentReview',id,feedback:'Use went for yesterday.'},'teacher').ok,true);
 const read=f.post({action:'document',id},'teacher');assert.equal(read.messages.length,1);assert.equal(read.document.feedback,'Use went for yesterday.');assert.equal(read.document.analysis.transcription,f.analysis.transcription);assert.equal(f.post({action:'documentFile',id,index:0}).file.data,sample.data);
});
test('new uploads and attached handwriting keep teacher feedback private for five hours but preserve access to originals',()=>{
 const f=fixture(),id=f.upload().document.id;
 const response=f.post({action:'teacherDocumentReview',id,feedback:'Approved private feedback'},'teacher');assert.equal(response.document.reviewPending,true);
 for(const [role,extra] of [['student',{}],['parent',{code:'parent-a'}],['teacher',{preview:true}]]) {
  assert.equal(f.post({action:'document',id,...extra},role).document.feedback,'');
  assert.equal(f.post({action:'documents',...extra},role).documents[0].feedback,'');
  assert.equal(f.post({action:'documentFile',id,index:0,...extra},role).file.data,sample.data);
 }
 const row=f.books.get('sheet-a').sheets.get('Documents').data.find(r=>r[0]===id);
 row[14]=new Date(Date.now()-1).toISOString();assert.equal(f.post({action:'document',id}).document.feedback,'Approved private feedback');
 const event={action:'submit',id:randomUUID(),unit:'u',task:'hw:1',answers:{handwritten_work:`[Handwritten answer: ${id}]`}};
 assert.equal(f.post(event).ok,true);assert.equal(f.post({action:'document',id}).document.feedback,'');
 const deadline=row[14];assert.equal(f.post(event).ok,true);assert.equal(row[14],deadline);
 assert.equal(f.post({action:'document',id},'teacher').document.feedback,'Approved private feedback');
});
test('learning reply updates wait for the server deadline while earlier shared reviews and the submitted answer remain readable',()=>{
 const f=fixture(),id=randomUUID(),base={action:'teacherSaveLearningRecord',id,date:'2026-09-23',kind:'homework',title:'Synthetic task',body:{summary:'Earlier review'}};
 assert.equal(f.post(base,'teacher').ok,true);
 const reply={action:'learningReply',reviewId:id,id:randomUUID(),answer:'An independent new answer'};assert.equal(f.post(reply).received,true);
 assert.equal(f.post({...base,body:{summary:'New approved review',tutorPrivate:{plan:'Private'}}},'teacher').record.reviewPending,true);
 for(const [role,extra] of [['student',{}],['parent',{code:'parent-a'}],['teacher',{preview:true}]]) {
  const r=f.post({action:'learningRecords',...extra},role);assert.equal(r.records[0].body.summary,'Earlier review');assert.equal(r.replies[0].answer,reply.answer);
 }
 assert.equal(f.post({action:'learningRecords'},'teacher').records[0].body.summary,'New approved review');
 const rows=f.books.get('sheet-a').sheets.get('Learning reviews').data;rows[rows.length-1][8]=new Date(Date.now()-1).toISOString();
 const released=f.post({action:'learningRecords'}).records[0];assert.equal(released.body.summary,'New approved review');assert.equal(released.body.tutorPrivate,undefined);
});

test('automatic complete sentence analysis rejects omissions, extracts and uncertain guesses',()=>{
 const f=fixture(),base=f.analysis;
 const full={...base,transcription:'I swim. I went home.',corrections:[],writing:{original:'I swim. I went home.',comparisons:[{original:'I swim.',corrected:'I swim.',improved:'',note:'Already correct.'},{original:'I went home.',corrected:'I went home.',improved:'',note:'A clear past-tense sentence.'}]}};
 assert.equal(f.ctx.documentAnalysisValid_(full),true);
 assert.equal(f.ctx.documentAnalysisValid_({...full,writing:{...full.writing,comparisons:full.writing.comparisons.slice(1)}}),false);
 assert.equal(f.ctx.documentAnalysisValid_({...full,writing:{...full.writing,comparisons:[{...full.writing.comparisons[0],original:'swim'}]}}),false);
 const unclear={...base,transcription:'I [unclear] home.',corrections:[],writing:{original:'I [unclear] home.',comparisons:[{original:'I [unclear] home.',corrected:'I went home.',improved:'',note:'Guess'}]}};
 assert.equal(f.ctx.documentAnalysisValid_(unclear),false);unclear.writing.comparisons[0].corrected='';assert.equal(f.ctx.documentAnalysisValid_(unclear),true);
});
test('full sentences can continue across photographed page labels without allowing changed source words',()=>{
 const f=fixture(),original='They should be flexible and self confident.';
 const a={...f.analysis,transcription:'[Page 1]\nThey should be flexible\n\n[Page 2]\nand self confident.',corrections:[{original:'flexible and self confident',suggestion:'flexible and self-confident',explanation:'Hyphenate self-confident.'}],writing:{original,comparisons:[{original,corrected:'They should be flexible and self-confident.',improved:'',note:'Hyphenate self-confident.'}]}};
 assert.equal(f.ctx.documentAnalysisValid_(a),true);
 assert.equal(f.ctx.documentAnalysisValid_({...a,transcription:a.transcription.replace('flexible','adaptable')}),false);
 assert.equal(f.ctx.documentAnalysisValid_({...a,transcription:a.transcription.replace('[Page 2]','an omitted phrase')}),false);
});
test('explicit document links preserve originals and reject cross-profile cycles and learner writes',()=>{
 const f=fixture(),first=f.upload().document.id,second=f.upload().document.id;
 assert.equal(f.post({action:'teacherDocumentLink',id:second,parentId:first,context:'[Document role: review]'},'teacher').ok,true);
 assert.equal(f.post({action:'document',id:second}).document.parentId,first);
 assert.equal(f.post({action:'teacherDocumentLink',id:first,parentId:second,context:''},'teacher').ok,false);
 assert.equal(f.post({action:'teacherDocumentLink',id:second,parentId:first,context:''}).ok,false);
 assert.equal(f.post({action:'teacherDocumentLink',id:second,parentId:first,context:'',preview:true},'teacher').ok,false);
 const other=f.post({action:'documentUpload',code:'student-b',id:randomUUID(),title:'Other work',files:[sample]},'other').document.id;
 assert.equal(f.post({action:'teacherDocumentLink',id:second,parentId:other,context:''},'teacher').ok,false);
 assert.equal(f.post({action:'documentFile',id:first,index:0}).file.data,sample.data);
});
test('linked writing reviews follow visibility and the five-hour review window',()=>{
 const f=fixture(),id=f.upload().document.id,reviewId=randomUUID();
 const record={action:'teacherSaveLearningRecord',id:reviewId,date:'2026-10-03',kind:'homework',title:'Private writing notes',visibility:'teacher',body:{writing:{original:'I go.',corrected:'I went.'},tutorPrivate:{plan:'Private'}}};
 f.post(record,'teacher');f.post({action:'teacherDocumentLink',id,parentId:'',context:`[Learning review: ${reviewId}]`},'teacher');
 assert.equal(f.post({action:'document',id}).review,null);
 assert.equal(f.post({action:'document',id,preview:true},'teacher').review,null);
 f.post({...record,visibility:'shared'},'teacher');
 assert.equal(f.post({action:'document',id}).review.body.tutorPrivate,undefined);
 assert.equal(f.post({action:'document',id},'teacher').review.body.tutorPrivate.plan,'Private');
 const sh=f.books.get('sheet-a').sheets.get('Learning reviews');sh.data.at(-1)[8]=new Date(Date.now()+3600000).toISOString();
 assert.equal(f.post({action:'document',id}).review,null);
});

test('uploaded Word answers are read automatically as text and prior AI output is backed up on upgrade',()=>{
 const f=fixture(),word={name:'answer.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',data:Buffer.from([80,75,3,4,1,2,3,4,5,6,7,8]).toString('base64')};
 const node=(name,content='',children=[])=>({getName:()=>name,getText:()=>content,getChildren:()=>children});
 f.ctx.Utilities.unzip=()=>[{getName:()=> 'word/document.xml',getDataAsString:()=> '<document/>'}];
 f.ctx.XmlService={parse:()=>({getRootElement:()=>node('document','',[node('p','',[node('r','',[node('t','I go to the park yesterday.')]),node('del','',[node('t','Abandoned wording')])])])})};
 const id=f.upload({files:[word]}).document.id;
 assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,2);
 assert.equal(f.post({action:'document',id}).document.analysis.writing.comparisons[0].original,'I go to the park yesterday.');
 const sh=f.books.get('sheet-a').sheets.get('Documents'),old={...f.analysis};delete old.writing;sh.data[1][6]=JSON.stringify(old);
 const before=f.files.size;assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,4);assert.equal(f.files.size,before+1);
 assert.equal(f.post({action:'documentFile',id,index:0}).file.data,word.data);
});

test('conversation feedback asks for simple explanations and retains caption evidence limits',()=>{
 const f=fixture(),id=randomUUID();let prompt;
 f.ctx.documentClaude_=payload=>{prompt=payload.system;return {content:[{type:'text',text:'What went well\nYou gave a clear example.\nTry this\nGive a different example.'}]};};
 assert.equal(f.post({action:'speakingSave',id,title:'Conversation',transcript:'[1.0s] You: I cycle on my own.',reflection:''}).ok,true);
 assert.equal(f.post({action:'speakingAnalyse',id}).ok,true);
 assert.match(prompt,/simple everyday English/);assert.match(prompt,/teaching term in brackets/);assert.match(prompt,/not the AI partner/);assert.match(prompt,/Do not grade/);assert.match(prompt,/caption fragment or self-correction/);
 assert.equal(f.post({action:'learningRecords'}).records[0].body.transcript,'[1.0s] You: I cycle on my own.');
});

test('reviewed lesson snapshots preserve the release time and never expose the private source through parent or preview reads',()=>{
 const f=fixture(),id=randomUUID(),body={transcript:'PRIVATE LESSON TRANSCRIPT',tutorPrivate:{plan:'PRIVATE TEACHING',lessonAssessment:{version:1,checks:[{task:'Explain a word',score:4}],attempts:[{support:'independent'}]}}};
 assert.equal(f.post({action:'teacherSaveLearningRecord',id,date:'2026-10-03',kind:'lesson',title:'AI draft pending',visibility:'teacher',body},'teacher').ok,true);
 const sh=f.books.get('sheet-a').sheets.get('Learning reviews');sh.data.at(-1)[8]='2099-10-05T12:00:00Z';
 const action={action:'teacherPublishLessonSnapshot',id,includeMetrics:true,snapshot:{summary:'You gave an own example.',strengths:['Clear meaning'],targets:['A new example'],nextStep:'Try without a model',transcript:'FORGED'}};
 assert.equal(f.post(action,'student').ok,false);assert.equal(f.post({...action,code:'parent-a'},'parent').ok,false);assert.equal(f.post({...action,preview:true},'teacher').ok,false);
 const result=f.post(action,'teacher');assert.equal(result.ok,true);assert.equal(result.record.reviewPending,true);assert.equal(f.post({action:'learningRecords',code:'parent-a'},'parent').records.length,0);
 assert.equal(f.post({action:'learningRecords',preview:true},'teacher').records.length,0);
 sh.data.at(-1)[8]='2020-01-01T00:00:00Z';
 const parent=f.post({action:'learningRecords',code:'parent-a'},'parent');assert.equal(parent.records.length,1);assert.equal(parent.records[0].body.lessonSnapshot.reviewedBy,'Rory');assert.doesNotMatch(JSON.stringify(parent),/PRIVATE|FORGED|tutorPrivate|transcript/);
 assert.equal(f.post({...action,code:'student-b'},'teacher').ok,false);
});

test('Opus reading and adaptive analysis are independently checkpointed with structured JSON, never forced tools',()=>{
 const f=fixture(),id=f.upload().document.id,payloads=[],call=f.ctx.documentClaude_;f.ctx.documentClaude_=p=>{payloads.push(p);return call(p);};
 const first=f.postOnce({action:'documentAnalyse',id});assert.equal(first.continueAnalysis,true);assert.equal(f.calls,1);
 const checkpoint=f.post({action:'document',id},'teacher').document;assert.equal(checkpoint.analysisStage,'analysis-ready');assert.equal(checkpoint.analysis,null);
 const done=f.postOnce({action:'documentAnalyse',id});assert.equal(done.ok,true);assert.equal(f.calls,2);
 for(const p of payloads){assert.equal(p.model,'claude-opus-5-5');assert.equal(p.thinking.type,'adaptive');assert.equal(p.tool_choice,undefined);assert.equal(p.tools,undefined);assert.equal(p.output_config.format.type,'json_schema');}
 assert.equal(payloads[1].max_tokens,32000);assert.equal(payloads[1].output_config.effort,'high');
 const d=f.post({action:'document',id},'teacher').document;assert.equal(d.analysis.model,'claude-opus-5-5');assert.equal(d.analysis.readingModel,'claude-opus-5-5');assert.equal(d.analysis.writing.comparisons[0].checks.taskFit,'ok');assert.equal(f.post({action:'document',id}).document.analysis.model,undefined);
 assert.equal(f.postOnce({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,2);
});
test('the frozen original preserves misspellings and the corrected version shows the necessary fixes',()=>{
 const f=fixture();Object.assign(f.analysis,{transcription:'[Page 1]\nAppart from that, he shold go.',corrections:[],writing:{original:'Appart from that, he shold go.',comparisons:[{original:'Appart from that, he shold go.',corrected:'Apart from that, he should go.',improved:'',note:'Spell apart and should this way.'}]}});
 const id=f.upload().document.id;assert.equal(f.post({action:'documentAnalyse',id}).ok,true);const a=f.post({action:'document',id}).document.analysis;assert.equal(a.writing.original,'Appart from that, he shold go.');assert.equal(a.writing.corrected,'Apart from that, he should go.');assert.equal(a.exercises.length,4);assert.equal(a.exercises[0].example,undefined);
});
test('missing sentence checks retry once without replacing or silently correcting the frozen reading',()=>{
 const f=fixture();f.analysis.transcription='I go yesterday. I like it.';f.analysis.writing.original=f.analysis.transcription;
 const id=f.upload().document.id;assert.equal(f.post({action:'documentAnalyse',id}).ok,false);assert.equal(f.calls,3);assert.equal(f.post({action:'document',id}).document.analysis,null);
});
test('private pipeline notes and teacher instructions never reach student or preview document payloads',()=>{
 const f=fixture(),context='[Document role: answer]\n[Work source: School homework — set by the school]\nPrivate instruction for the AI: keep the wording.';
 const id=f.upload({context},'teacher').document.id;f.post({action:'documentAnalyse',id});
 assert.match(f.post({action:'document',id},'teacher').document.context,/Private instruction/);
 for(const role of ['student','parent']){const r=f.post({action:'document',id,...(role==='parent'?{code:'parent-a'}:{})},role).document;assert.doesNotMatch(r.context,/Private instruction/);assert.match(r.context,/School homework/);assert.equal(r.analysis.teacherNotes,undefined);}
 assert.doesNotMatch(f.post({action:'document',id,preview:true},'teacher').document.context,/Private instruction/);
});
test('conversation audio opens its exact saved caption feedback instead of an empty document analysis',()=>{
 const f=fixture(),id=randomUUID();f.post({action:'speakingSave',id,title:'Conversation',transcript:'You: I go yesterday.',reflection:''});f.post({action:'speakingAnalyse',id});
 const audio=f.upload({files:[{name:'sample.webm',type:'audio/webm',data:Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3,4,5,6,7,8]).toString('base64')}]}).document.id;f.post({action:'speakingAttachAudio',id,documentId:audio});
 const r=f.post({action:'document',id:audio});assert.equal(r.review.id,id);assert.ok(r.review.body.aiAnalysis);assert.equal(r.document.hasConversationFeedback,true);
 const d=f.post({action:'document',id:audio},'teacher').document;assert.equal(d.needsTeacherCheck,true);assert.equal(f.post({action:'teacherDocumentCheck',id:audio,analysisVersion:d.analysisVersion},'teacher').document.needsTeacherCheck,false);assert.equal(f.post({action:'document',id:audio},'other').ok,false);
});
test('practice answers stay hidden until an immutable, scoped student attempt is saved',()=>{
 const f=fixture(),id=f.upload().document.id;f.post({action:'documentAnalyse',id});const d=f.post({action:'document',id}).document,e=d.analysis.exercises[0];assert.equal(e.accepted,undefined);assert.equal(e.example,undefined);
 const p={action:'documentPractice',id,attemptId:randomUUID(),exerciseId:e.id,version:d.practiceVersion,answer:'is'};
 assert.equal(f.post(p,'teacher').ok,false);assert.equal(f.post({...p,preview:true},'teacher').ok,false);assert.equal(f.post(p,'other').ok,false);
 const result=f.post(p);assert.equal(result.received,true);assert.equal(result.attempt.result.status,'correct');assert.equal(result.attempt.result.example,'is');assert.equal(f.post(p).ok,true);assert.equal(f.books.get('sheet-a').sheets.get('Document practice').data.length,2);
 assert.equal(f.post({...p,answer:'are'}).ok,false);assert.equal(f.post({...p,attemptId:randomUUID(),version:'stale'}).ok,false);assert.equal(f.post({action:'document',id}).document.practiceAttempts[0].answer,'is');
});
test('typed task feedback uses the saved source and rejects cross-profile, parent and preview writes',()=>{
 const f=fixture(),id=randomUUID(),answer='medical';f.post({action:'submit',id,task:'Vocabulary',unit:'u1',title:'Word formation',prompts:{a:'MEDICINE'},answers:{a:answer}});
 Object.assign(f.analysis,{corrections:[],writing:{original:'',comparisons:[]},answerReview:[{label:'a',prompt:'MEDICINE',response:answer,status:'correct',correction:'',note:'The adjective fits.'}]});
 const p={action:'workFeedbackAnalyse',sourceType:'submission',id};for(const role of ['other','parent'])assert.equal(f.post(p,role).ok,false);assert.equal(f.post({...p,preview:true},'teacher').ok,false);
 const r=f.post(p);assert.equal(r.ok,true);assert.equal(r.analysis.answerReview[0].response,answer);const before=f.calls;assert.equal(f.post(p).ok,true);assert.equal(f.calls,before);
 assert.equal(f.post({action:'workFeedback',sourceType:'submission',id}).analysis.model,undefined);assert.equal(f.post({action:'submissions'}).submissions[0].answers.a,answer);assert.equal(f.post({action:'submissions'}).submissions[0].feedback,'');
});

test('uncertain missing worksheet evidence remains unmarked while readable sentence parts can be corrected',()=>{
 const f=fixture(),row={label:'Task 2',prompt:'Write three sentences.',response:'',status:'uncertain',correction:'',note:'No answer page was supplied; upload it if available.'};
 assert.equal(f.ctx.documentAnswersValid_({transcription:'Write three sentences.',answerReview:[row]}),true);
 assert.equal(f.ctx.documentAnswersValid_({transcription:'Write three sentences.',answerReview:[{...row,status:'correct'}]}),false);
 const original='I go to [unclear: Vienne?] yesterday.',a={transcription:original,writing:{original,comparisons:[{original,corrected:'I went to [unclear: Vienne?] yesterday.',improved:'',note:'Went is the past tense; please confirm the place name.'}]}};
 assert.equal(f.ctx.documentWritingValid_(a),true);
 a.writing.comparisons[0].corrected='I went to Vienna yesterday.';assert.equal(f.ctx.documentWritingValid_(a),false);
 a.writing.comparisons[0].corrected='I went to [unclear: Vienna?] yesterday.';assert.equal(f.ctx.documentWritingValid_(a),false);
});
test('rejected provider outputs can be revalidated from the private source store without a fresh AI call',()=>{
 const f=fixture(),doc=f.upload().document.id;f.post({action:'documentAnalyse',id:doc});const calls=f.calls;
 const saved=JSON.parse(f.books.get('sheet-a').sheets.get('Documents').data[1][6]);
 const output={summary:saved.summary,strengths:[...saved.strengths,'A second evidenced strength.','A third.','A fourth.','Extra bounded summary.'],corrections:saved.corrections,retry:saved.retry,answerReview:saved.answerReview,comparisons:saved.writing.comparisons,model:'',modelNotes:[],exercises:saved.exercises,teacherNotes:''};
 const folder=f.folders.get(f.props.get('private_documents_student-a'));folder.createFile(f.ctx.Utilities.newBlob(JSON.stringify(output),'application/json',doc+'-incomplete-analysis-'+Date.now()+'.json'));
 const reading={transcription:saved.transcription,original:saved.writing.original,coverage:saved.coverage,uncertainties:[],teacherNotes:'',workType:'writing',task:''};
 const recovered=f.ctx.documentRecovery_('student-a',doc,reading,'','claude-opus-5-5');assert.ok(recovered);assert.equal(recovered.strengths.length,4);assert.equal(f.calls,calls);
 output.comparisons[0].original='A fabricated original.';folder.createFile(f.ctx.Utilities.newBlob(JSON.stringify(output),'application/json',doc+'-incomplete-analysis-'+(Date.now()+1)+'.json'));
 assert.equal(f.ctx.documentRecovery_('student-a',doc,reading,'','claude-opus-5-5'),null);assert.equal(f.calls,calls);
});

test('an unavailable printed question stays empty instead of turning an item-location label into source text',()=>{
 const f=fixture(),reading={transcription:'p42/3b\n1. I enjoy working with my peers.',original:'',task:'',workType:'worksheet',coverage:'complete',uncertainties:[],teacherNotes:''};
 const output={summary:'This sentence is grammatical; the task was not supplied.',strengths:[],corrections:[],retry:'Try the pattern again.',answerReview:[{label:'p42/3b item 1',prompt:'p42/3b item 1 (printed task not visible)',response:'I enjoy working with my peers.',status:'correct',correction:'',note:'The language is correct; task fit cannot be checked.'}],comparisons:[],model:'',modelNotes:[],exercises:[],teacherNotes:''};
 const a=f.ctx.documentRichAnalysis_(output,reading,'B1',{reading:'claude-opus-5-5',analysis:'claude-opus-5-5'});assert.ok(a);assert.equal(a.answerReview[0].prompt,'');assert.equal(a.answerReview[0].response,output.answerReview[0].response);
 output.answerReview[0].prompt='An invented question';assert.equal(f.ctx.documentRichAnalysis_(output,reading,'B1',{reading:'r',analysis:'a'}),null);
});
