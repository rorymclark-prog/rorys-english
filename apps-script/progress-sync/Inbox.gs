// Private one-to-one messages and source-derived notifications. No marks or
// originals are changed. Reads never create sheets or change read receipts.
var INBOX_ACTIONS_=['messages','messageSend','messagesRead','notifications','notificationsRead','teacherNotifications'];
var MESSAGE_HEADERS_=['Id','Created','Sender','Text JSON'];
var INBOX_READ_HEADERS_=['Event id','Audience','Read at'];
function inboxSheet_(code,name,create,headers) {
  var ss=studentSheet_(code),sh=ss.getSheetByName(name);
  if(!sh&&create){sh=ss.insertSheet(name);sh.getRange(1,1,1,headers.length).setValues([headers]);}
  return sh;
}
function inboxRows_(code,name){var sh=inboxSheet_(code,name,false);return sh?sh.getDataRange().getValues().slice(1):[];}
function inboxIso_(value){if(value instanceof Date)return value.toISOString();var t=String(value||'');if(/^\d{4}-\d{2}-\d{2}T/.test(t)&&isFinite(Date.parse(t)))return new Date(t).toISOString();if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t))return Utilities.parseDate(t,'Europe/Vienna','yyyy-MM-dd HH:mm').toISOString();return '';}
function inboxMessages_(code){return inboxRows_(code,'Messages').map(function(r){return {id:String(r[0]),created:inboxIso_(r[1]),sender:String(r[2]),text:JSON.parse(r[3]||'""')};});}
function inboxReads_(code,audience){var ids={};inboxRows_(code,'Inbox reads').forEach(function(r){if(r[1]===audience)ids[String(r[0])]=true;});return ids;}
function inboxEvents_(code,teacher){
  var events=[],seen={},base='/s/'+encodeURIComponent(code),reader=teacher?'teacher':'student',reads=inboxReads_(code,reader);
  function add(id,at,kind,title,detail,view){at=inboxIso_(at);if(!at||seen[id])return;seen[id]=true;events.push({id:id,code:code,at:at,kind:kind,title:String(title).slice(0,180),detail:detail,view:view,read:!!reads[id]});}
  inboxMessages_(code).forEach(function(m){if(m.sender===(teacher?'student':'teacher'))add('message:'+m.id,m.created,'message',teacher?'New message':'Message from Rory','Open your conversation.','messages');});
  if(teacher){
    DOCUMENT_CHECKS_CACHE_=documentChecks_(code);
    DOCUMENT_LEARNING_CACHE_=learningLatest_(code,'teacher').filter(function(r){return r[5]==='shared';});
    // Use the original student save time, never a later AI/teacher edit time.
    inboxRows_(code,'Learning reviews').forEach(function(r){if(r[7]!=='Student'||r[5]!=='shared'||r[3]!=='speaking')return;var b=JSON.parse(r[6]||'{}');add('speaking:'+r[0],b.submittedAt||r[1],'speaking','Speaking saved',String(r[4]||'Conversation'),'learning');});
    inboxRows_(code,'Learning replies').forEach(function(r){if(r[4]==='Student')add('reply:'+r[0],r[2],'answer','Practice answer saved','An answer or revision is ready to read.','learning');});
    inboxRows_(code,'Submissions').forEach(function(r){add('submission:'+r[0],r[3],'homework','Homework received',String(r[8]||r[1]||'Homework'),'review');if(typeof workFeedbackLatest_==='function'){var f=workFeedbackLatest_(code,'submission:'+r[0]),event=events.filter(function(e){return e.id==='submission:'+r[0];})[0];if(event)event.needsCheck=!!(f&&f.analysis&&!r[7]&&!documentCheckedAt_('submission:'+r[0],f.version));}});
    DOCUMENT_CHECKS_CACHE_=documentChecks_(code);
    DOCUMENT_LEARNING_CACHE_=learningLatest_(code,'teacher').filter(function(r){return r[5]==='shared';});
    inboxRows_(code,'Documents').forEach(function(r){var d=documentPublic_(r,false,true);if(r[3]!=='Student'&&!d.needsTeacherCheck)return;if(d.workType==='conversation'||d.workType==='recording'){if(d.conversationId){var speech=events.filter(function(e){return e.id==='speaking:'+d.conversationId;})[0];if(speech)speech.needsCheck=!!d.needsTeacherCheck;}return;}add('document:'+r[0],r[2],'upload',d.needsTeacherCheck?'Check feedback':r[9]?'Revision uploaded':'Work uploaded',String(r[1]||'Document'),'documents');var event=events.filter(function(e){return e.id==='document:'+r[0];})[0];if(event)event.needsCheck=!!d.needsTeacherCheck;});
    calendarRows_(code,'School test calendar').forEach(function(r){if(r.updatedBy==='student')add('test:'+r.id+':'+r.sequence,r.updatedAt,'test',r.status==='cancelled'?'School test cancelled':r.sequence?'School test updated':'School test added',String(r.title||'School test'),'calendar');});
    calendarRows_(code,'Lesson requests').forEach(function(r){if(r.role==='student')add('request:'+r.id,r.createdAt,'request','Lesson change requested','Open Calendar to respond.','calendar');});
    inboxRows_(code,'Vocab & Quizzes').forEach(function(r){if(r[6])add('quiz:'+r[6],r[0],'quiz','Practice round saved',String(r[1]||'Practice'),'overview');});
  }else{
    // Feedback notifications obey the same review window as the underlying work.
    inboxRows_(code,'Submissions').forEach(function(r){if(r[7]&&r[6]&&!reviewHeld_(r[10]))add('feedback:'+r[0]+':'+r[7],inboxIso_(r[7])||r[10],'feedback','Homework feedback ready','Read Rory’s feedback.','homework');});
    inboxRows_(code,'Documents').forEach(function(r){if(r[8]&&r[7]&&!reviewHeld_(r[14]))add('feedback:'+r[0]+':'+r[8],inboxIso_(r[8])||r[14],'feedback','Feedback on your work','Read Rory’s feedback.','documents');});
  }
  events.sort(function(a,b){return b.at.localeCompare(a.at)||a.id.localeCompare(b.id);});return events;
}
function inboxMark_(code,audience,ids,allowed){
 var existing=inboxReads_(code,audience),valid={};allowed.forEach(function(e){valid[e.id]=true;});
 var fresh=ids.filter(function(id){return valid[id]&&!existing[id];});
 if(fresh.length){var sh=inboxSheet_(code,'Inbox reads',true,INBOX_READ_HEADERS_),now=new Date().toISOString();fresh.forEach(function(id){sh.appendRow([id,audience,now]);});}
 return {ok:true};
}
function inboxService_(p,s){
 try{
  var teacher=s.role==='teacher';if(s.role==='parent')return {ok:false,error:'Access denied'};
  if(p.action==='teacherNotifications'){
   if(!teacher||p.preview)return {ok:false,error:'Access denied'};
   var all=[],students=getRoster_().map(function(student){var events=inboxEvents_(student.code,true);events.forEach(function(e){e.name=student.name;all.push(e);});return {code:student.code,name:student.name,lastActivity:events[0]?events[0].at:null};});
   all.sort(function(a,b){return b.at.localeCompare(a.at)||a.id.localeCompare(b.id);});
   return {ok:true,events:all.slice(0,300),unread:all.filter(function(e){return !e.read;}).length,students:students,generatedAt:new Date().toISOString()};
  }
  var student=studentByAnyCode_(p.code);if(!student||p.code!==student.code||(!teacher&&s.code!==p.code))return {ok:false,error:'Access denied'};
  var code=student.code,audience=teacher&&!p.preview?'teacher':'student';
  if(p.action==='messages'){
   var messages=inboxMessages_(code),reads=inboxReads_(code,audience);if(p.before){var boundary=messages.findIndex(function(m){return m.id===p.before;});if(boundary<0)return {ok:false,error:'Message page unavailable'};messages=messages.slice(0,boundary);}
   return {ok:true,messages:messages.slice(-300).map(function(m){m.read=!!reads['message:'+m.id];return m;}),hasEarlier:messages.length>300};
  }
  if(p.action==='notifications'){var events=inboxEvents_(code,teacher&&!p.preview);return {ok:true,events:events.slice(0,300),unread:events.filter(function(e){return !e.read;}).length};}
  if(p.preview)return {ok:false,error:'Student preview is read-only.'};
  if(p.action==='messageSend'){
   if(!documentId_(p.id)||typeof p.text!=='string'||!p.text.trim()||p.text.trim().length>2000)return {ok:false,error:'Write a message of up to 2,000 characters.'};
   var lock=LockService.getScriptLock();lock.waitLock(10000);
   try{
    var messages=inboxMessages_(code),sender=teacher?'teacher':'student',text=p.text.trim(),prior=messages.filter(function(m){return m.id===p.id;})[0];
    if(prior){if(prior.sender!==sender||prior.text!==text)return {ok:false,error:'This message identifier has already been used.'};return {ok:true,message:prior,received:true};}
    var now=new Date().toISOString(),today=now.slice(0,10),daily=messages.filter(function(m){return m.sender===sender&&m.created.slice(0,10)===today;});
    if(daily.length>=(teacher?100:30))return {ok:false,error:'Today’s message limit has been reached. Try again tomorrow.'};
    var message={id:p.id,created:now,sender:sender,text:text};
    inboxSheet_(code,'Messages',true,MESSAGE_HEADERS_).appendRow([message.id,now,sender,JSON.stringify(text)]);
    return {ok:true,message:message,received:true};
   }finally{lock.releaseLock();}
  }
  if(p.action==='notificationsRead'||p.action==='messagesRead'){
   if(!Array.isArray(p.ids)||p.ids.length>300||!p.ids.every(function(id){return typeof id==='string'&&id.length<=240;}))return {ok:false,error:'Invalid read receipt'};
   var lock=LockService.getScriptLock();lock.waitLock(10000);
   try{var allowed=p.action==='messagesRead'?inboxMessages_(code).filter(function(m){return m.sender!==(teacher?'teacher':'student');}).map(function(m){return {id:'message:'+m.id};}):inboxEvents_(code,teacher);return inboxMark_(code,audience,p.ids,allowed);}finally{lock.releaseLock();}
  }
  return {ok:false,error:'Unknown inbox action'};
 }catch(e){console.error('Inbox request failed');return {ok:false,error:'Could not open your inbox. Please try again.'};}
}
