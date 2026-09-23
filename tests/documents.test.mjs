import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
const sample={name:'work.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.4\nSynthetic learner work\n%%EOF').toString('base64')};
function fixture(){
 const props=new Map([['TEACHER_PASSWORD','synthetic-only'],['sheet_student-a','sheet-a'],['sheet_student-b','sheet-b'],['ANTHROPIC_API_KEY','mock-key']]),cache=new Map(),books=new Map(),files=new Map(),folders=new Map();
 let aiCalls=0,aiStatus=200,aiHook=null;
 const analysis={transcription:'Page 1\nI go to the park yesterday.',coverage:'complete',uncertainties:[],summary:'A short account of a visit.',strengths:['The main idea is clear.'],corrections:[{original:'I go',suggestion:'I went',explanation:'Use the past simple for yesterday.'}],retry:'Write one more sentence about yesterday.'};
 const blob=(bytes,type,name)=>({getBytes:()=>Array.from(typeof bytes==='string'?Buffer.from(bytes):bytes),getDataAsString:()=>Buffer.from(bytes).toString(),type,name});
 function spreadsheet(id){if(books.has(id))return books.get(id);const sheets=new Map(),book={sheets,getSheetByName:n=>sheets.get(n)||null,insertSheet:n=>{const data=[],sh={data,getDataRange:()=>({getValues:()=>data.map(r=>r.slice())}),appendRow:r=>data.push(r.slice()),getRange:(row,col)=>({setValues:vs=>vs.forEach((r,i)=>r.forEach((v,j)=>{data[row-1+i]||=[];data[row-1+i][col-1+j]=v;})),setValue:v=>{data[row-1]||=[];data[row-1][col-1]=v;}})};sheets.set(n,sh);return sh;}};books.set(id,book);return book;}
 function folder(){const id=randomUUID(),f={getId:()=>id,access:'PRIVATE',getSharingAccess:()=>f.access,getEditors:()=>[],getViewers:()=>[],createFolder:folder,createFile:b=>{const fid=randomUUID(),file={getId:()=>fid,getBlob:()=>b,setTrashed:t=>{file.trashed=t;}};files.set(fid,file);return file;}};folders.set(id,f);return f;}
 const property={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)},ctx={console,Date,JSON,Object,Array,String,Number,Math,isFinite,SECRET:'private',TEACHER_PASSWORD_PROP:'TEACHER_PASSWORD',AI_DAILY_CAP:40,
 PropertiesService:{getScriptProperties:()=>property},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getScriptTimeZone:()=> 'Europe/Vienna'},Utilities:{getUuid:randomUUID,base64Decode:s=>Array.from(Buffer.from(s,'base64')),base64Encode:b=>Buffer.from(b.map(v=>(v+256)%256)).toString('base64'),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),computeDigest:(_,s)=>createHash('sha256').update(s).digest(),DigestAlgorithm:{SHA_256:'sha256'},newBlob:blob,formatDate:()=> '2026-09-21'},SpreadsheetApp:{openById:spreadsheet},DriveApp:{Access:{PRIVATE:'PRIVATE'},createFolder:folder,getFolderById:id=>folders.get(id),getFileById:id=>files.get(id)},
 studentByAnyCode_:c=>c==='student-a'||c==='parent-a'?{code:'student-a',parentCode:'parent-a',name:'Synthetic A'}:c==='student-b'?{code:'student-b',name:'Synthetic B'}:null,
 sanitize_:s=>/^[=+\-@]/.test(s)?"'"+s:s,json_:v=>v,aiCount_:c=>Number(props.get('ai_'+c)||0),aiKey_:c=>'ai_'+c,pruneAiCounters_(){},legacyPost_:()=>({ok:true}),
 UrlFetchApp:{fetch:(_url,o)=>{aiCalls++;if(aiHook)aiHook();const payload=JSON.parse(o.payload);return {getResponseCode:()=>aiStatus,getContentText:()=>JSON.stringify(payload.tools?{content:[{type:'tool_use',name:'record_document',input:analysis}]}:{content:[{type:'text',text:'In “I go”, use the past simple: “I went”. Try one more sentence.'}]})};}}
 };
 vm.createContext(ctx);for(const f of ['V2.gs','Documents.gs','Learning.gs'])vm.runInContext(fs.readFileSync('apps-script/progress-sync/'+f,'utf8'),ctx);
 const session=role=>ctx.issueSession_(role==='teacher'?'__teacher__':role==='parent'?'parent-a':role==='other'?'student-b':'student-a',role==='other'?'student':role).token;
 const post=(body,role='student')=>ctx.doPost({postData:{contents:JSON.stringify({code:'student-a',session:session(role),...body})}});
 const upload=(extra={},role='student')=>post({action:'documentUpload',id:randomUUID(),title:'Synthetic work',context:'A short paragraph',files:[sample],...extra},role);
 return {ctx,props,books,files,folders,analysis,post,upload,get calls(){return aiCalls;},set status(s){aiStatus=s;},set hook(h){aiHook=h;}};
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
 const f=fixture(),id=f.upload().document.id;assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,1);assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(f.calls,1);
 const read=f.post({action:'document',id});assert.equal(read.document.analysis.transcription,f.analysis.transcription);assert.equal(read.document.feedback,'');assert.equal(read.document.status,'ready');
 assert.equal(f.ctx.documentAnalysisValid_({...f.analysis,corrections:[{original:'not in source',suggestion:'invented',explanation:'bad'}]}),false);
});
test('analysis failure preserves the original and quota is reserved before calling AI',()=>{
 const f=fixture(),id=f.upload().document.id;f.status=429;assert.equal(f.post({action:'documentAnalyse',id}).ok,false);assert.equal(f.post({action:'document',id}).document.status,'error');assert.equal(f.post({action:'documentFile',id,index:0}).file.data,sample.data);
 f.status=200;f.props.set('ai_student-a','40');assert.equal(f.post({action:'documentAnalyse',id}).ok,false);assert.equal(f.calls,1);
});
test('active processing leases prevent concurrent AI charges and expired leases can retry',()=>{
 const f=fixture(),id=f.upload().document.id;let nested;f.hook=()=>{f.hook=null;nested=f.post({action:'documentAnalyse',id});};assert.equal(f.post({action:'documentAnalyse',id}).ok,true);assert.equal(nested.pending,true);assert.equal(f.calls,1);
 const next=f.upload().document.id,sh=f.books.get('sheet-a').sheets.get('Documents');const row=sh.data.find(r=>r[0]===next);row[11]='stale';row[12]=Date.now()-400000;assert.equal(f.post({action:'documentAnalyse',id:next}).ok,true);
});
test('teacher review and chat persist without replacing AI advice or original, chat retries are idempotent',()=>{
 const f=fixture(),id=f.upload().document.id;f.post({action:'documentAnalyse',id});const messageId=randomUUID();assert.equal(f.post({action:'documentChat',id,messageId,question:'Explain this change.'}).ok,true);assert.equal(f.post({action:'documentChat',id,messageId,question:'Explain this change.'}).ok,true);assert.equal(f.calls,2);
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
