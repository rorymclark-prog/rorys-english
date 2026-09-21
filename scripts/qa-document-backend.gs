// Temporary editor-only check; remove before release.
function testDocumentWorkflow() {
 var code='qa-documents-'+Utilities.getUuid(),sheet=null,lookup=studentByAnyCode_,props=authProps_(),checks=[];
 function check(ok,label){if(!ok)throw new Error('FAILED: '+label);checks.push(label);console.log('PASS: '+label);}
 try {
  sheet=SpreadsheetApp.create('Rory English document check — synthetic disposable data');props.setProperty('sheet_'+code,sheet.getId());
  studentByAnyCode_=function(c){return c===code?{code:code,name:'Synthetic learner'}:lookup(c);};
  var teacher=issueSession_('__teacher__','teacher').token,student=issueSession_(code,'student').token;
  function post(p,t){p.code=p.code||code;p.session=t||student;return JSON.parse(doPost({postData:{contents:JSON.stringify(p)}}).getContent());}
  var content='BT /F1 14 Tf 50 750 Td (SYNTHETIC PRACTICE - NOT STUDENT WORK) Tj 0 -30 Td (I go to the park yesterday. I play football with my friends.) Tj ET';
  var objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'];
  var pdf='%PDF-1.4\n',offsets=[];objects.forEach(function(obj,i){offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});var xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n';offsets.forEach(function(o){pdf+=('0000000000'+o).slice(-10)+' 00000 n \n';});pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  var data=Utilities.base64Encode(Utilities.newBlob(pdf).getBytes()),id=Utilities.getUuid(),upload={action:'documentUpload',id:id,title:'Synthetic document check',context:'Practise the past simple. Test only.',files:[{name:'synthetic-practice.pdf',type:'application/pdf',data:data}]};
  var saved=post(upload,teacher);check(saved.ok&&saved.received&&saved.document.uploadedBy==='Rory','Teacher uploads to selected profile'+(saved.error?' ('+saved.error+')':''));
  check(post(upload,teacher).received&&documentRows_(code).length===1,'Upload retry creates one record');
  check(post({action:'documentFile',id:id,index:0}).file.data===data,'Student downloads exact original bytes');
  check(DriveApp.getFileById(JSON.parse(documentFind_(code,id).row[4])[0].id).getSharingAccess()===DriveApp.Access.PRIVATE,'Original file is private');
  check(!post({action:'document',id:id,code:'valentin-q9m2'}).ok,'Cross-student request denied');
  check(!post({action:'documentAnalyse',id:id,preview:true},teacher).ok,'Preview AI request denied');
  var read=post({action:'documentAnalyse',id:id});check(read.ok&&read.document.analysis&&read.document.analysis.transcription.indexOf('park')>=0,'Live AI reads PDF and saves feedback'+(read.error?' ('+read.error+')':''));
  var message={action:'documentChat',id:id,messageId:Utilities.getUuid(),question:'Explain the first past-tense correction and give me a hint.'},reply=post(message);check(reply.ok,'Live document chat answers'+(reply.error?' ('+reply.error+')':''));
  check(post(message).ok&&documentChats_(code,id).length===1,'Chat retry is deduplicated');
  check(post({action:'teacherDocumentReview',id:id,feedback:'Synthetic reviewed feedback. Try using went.'},teacher).ok,'Teacher publishes separate feedback');
  check(post({action:'document',id:id}).document.feedback.indexOf('Synthetic reviewed')===0,'Student reads teacher feedback');
  upload.id=Utilities.getUuid();upload.parentId=id;check(post(upload).received&&documentRows_(code).length===2,'Student revision preserves both originals');
  console.log('DOCUMENT WORKFLOW PASSED: '+checks.length+' checks. All material synthetic.'); return {ok:true,checks:checks};
 } finally {
  studentByAnyCode_=lookup;var folder=props.getProperty('private_documents_'+code);if(folder)DriveApp.getFolderById(folder).setTrashed(true);if(sheet)DriveApp.getFileById(sheet.getId()).setTrashed(true);
  props.deleteProperty('sheet_'+code);props.deleteProperty('private_documents_'+code);props.deleteProperty(aiKey_(code));console.log('Synthetic records and files moved to trash. Real learner profiles untouched.');
 }
}
