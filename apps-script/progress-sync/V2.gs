// Public API: POST only, authenticated sessions, no browser-shipped secret.
var SESSION_TTL_ = 21600;
var SUBMISSION_HEADERS_ = ['Id','Task','Unit','Submitted','Answers JSON','Status','Feedback','Reviewed','Title','Prompts JSON'];
function digest_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text))).replace(/=+$/, ''); }
function authProps_() { return PropertiesService.getScriptProperties(); }
function token_() { return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''); }
function version_(code) {
  return code==='__teacher__' ? digest_(authProps_().getProperty(TEACHER_PASSWORD_PROP)||'') : authProps_().getProperty('access_version_' + code) || '0';
}
function session_(token) {
  if (!token || typeof token !== 'string') return null;
  var raw=CacheService.getScriptCache().get('session_' + digest_(token));
  if (!raw) return null;
  var s=JSON.parse(raw);
  return s.expires > Date.now() && s.version === version_(s.code) ? s : null;
}
function issueSession_(code,role) {
  var token=token_(), expires=Date.now()+SESSION_TTL_*1000;
  CacheService.getScriptCache().put('session_'+digest_(token),JSON.stringify({code:code,role:role,expires:expires,version:version_(code)}),SESSION_TTL_);
  return {ok:true,token:token,expires:expires,role:role};
}
function login_(p) {
  var lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var code=String(p.code || '').slice(0,100), cache=CacheService.getScriptCache();
    var key='login_limit_'+digest_(code), attempts=Number(cache.get(key) || 0);
    if(attempts>=10) return {ok:false,error:'Too many attempts. Try again in 15 minutes.'};
    cache.put(key,String(attempts+1),900);
    var credential=String(p.credential || ''), role=code==='__teacher__'?'teacher':'student', valid=false;
    if(role==='teacher') {
      var expected=authProps_().getProperty(TEACHER_PASSWORD_PROP);
      valid=!!expected && credential===expected;
    } else {
      var student=studentByAnyCode_(code), saved=authProps_().getProperty('access_'+code);
      if(student && saved) {
        var entry=JSON.parse(saved);
        valid=digest_(entry.salt+credential)===entry.hash;
        role=code===student.code?'student':'parent';
      }
    }
    if(!valid) return {ok:false,error:'Sign-in failed. Check your access code with Rory.'};
    cache.remove(key);
    return issueSession_(code,role);
  } finally {lock.releaseLock();}
}
function setAccess_(p) {
  var student=studentByAnyCode_(p.code);
  if(!student) return {ok:false,error:'Unknown student'};
  var code=p.parent?student.parentCode:student.code;
  if(!code) return {ok:false,error:'No parent page configured'};
  // Generated high-entropy access codes, not low-entropy human passwords.
  var access=token_(),salt=token_();
  authProps_().setProperty('access_'+code,JSON.stringify({salt:salt,hash:digest_(salt+access)}));
  authProps_().setProperty('access_version_'+code,token_());
  return {ok:true,code:code,access:access};
}
function doGet() {return json_({ok:true,service:'rorys-english',version:2,teacherConfigured:!!authProps_().getProperty(TEACHER_PASSWORD_PROP)});}
function doPost(e) {
  try {
    if(!e || !e.postData || e.postData.contents.length>60000) return json_({ok:false,error:'Request too large'});
    var p=JSON.parse(e.postData.contents);
    if(p.action==='login') return json_(login_(p));
    var s=session_(p.session);
    if(!s) return json_({ok:false,error:'Sign in again to continue.',authRequired:true});
    if(p.action==='logout') {CacheService.getScriptCache().remove('session_'+digest_(p.session));return json_({ok:true});}
    var teacher=s.role==='teacher', student=studentByAnyCode_(s.code);
    if(!teacher && (!student || p.code!==s.code)) return json_({ok:false,error:'Access denied'});
    var reads=['progress','resources','assignments','note','submissions'];
    var permitted=s.role==='parent'?['progress','resources','note']:reads.concat(['ai','submit','event']);
    if(!teacher && permitted.indexOf(p.action)<0) return json_({ok:false,error:'Access denied'});
    // Discard legacy client credentials. Only inject after validating session.
    p.secret=SECRET;
    delete p.callback;
    p.teacherSecret=teacher?authProps_().getProperty(TEACHER_PASSWORD_PROP):'';
    if(p.action==='teacherAccess') return json_(setAccess_(p));
    if(p.action==='teacherResources') return json_(publishResources_(p));
    if(p.action==='submissions') return json_(submissions_(p));
    if(p.action==='submit') return json_(submit_(p));
    if(p.action==='teacherReview') return json_(review_(p));
    if(p.action==='event') return json_(event_(p));
    if(p.action==='teacherPublishAssessment') return json_(publishAssessment_(p));
    if(p.action==='ai' || p.action==='teacherAnalyseWriting') {
      var lock=LockService.getScriptLock();lock.waitLock(10000);
      try {
        var budgetCode=teacher?'__teacher__':s.code;
        if(aiCount_(budgetCode)>=(teacher?20:AI_DAILY_CAP)) return json_({ok:false,error:'Daily practice limit reached. Try again tomorrow.'});
        var day=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
        var budgetKey='ai_budget_'+day,spent=Number(authProps_().getProperty(budgetKey)||0);
        if(spent===0) pruneAiCounters_(authProps_());
        if(spent>=100) return json_({ok:false,error:'The helper has reached its daily limit.'});
        authProps_().setProperty(budgetKey,String(spent+1));
        authProps_().setProperty(aiKey_(budgetCode),String(aiCount_(budgetCode)+1));
      } finally {lock.releaseLock();}
      p.reserved=true;
    }
    return legacyPost_({postData:{contents:JSON.stringify(p)}});
  } catch(err) {console.error('V2 request failed');return json_({ok:false,error:'Could not complete the request. Please try again.'});}
}
// Reads are deliberately side-effect free. No Drive search or setSharing.
function getResources_(p) {
  var student=studentByAnyCode_(p.code);
  if(!student) return json_({ok:false,error:'Access denied'});
  var resources=JSON.parse(authProps_().getProperty('approved_resources_'+student.code)||'[]');
  return json_({ok:true,name:student.name,resources:resources});
}
function publishResources_(p) {
  var student=studentByAnyCode_(p.code);
  if(!student || !Array.isArray(p.resources) || p.resources.length>40) return {ok:false,error:'Invalid resources'};
  var valid=p.resources.every(function(r){return r && typeof r.name==='string' && r.name.trim() && typeof r.url==='string' && r.url.length<=1000 && /^https:\/\/(drive|docs)\.google\.com\//.test(r.url);});
  if(!valid) return {ok:false,error:'Use named Google Drive or Docs links only.'};
  var resources=p.resources.map(function(r){return {name:r.name.slice(0,150),url:r.url,type:String(r.type||'').slice(0,40),modified:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd')};});
  if(Utilities.newBlob(JSON.stringify(resources)).getBytes().length>8000) return {ok:false,error:'Too many resource links. Remove an older link first.'};
  authProps_().setProperty('approved_resources_'+student.code,JSON.stringify(resources));
  return {ok:true};
}
function studentSheet_(code) {
  var student=studentByAnyCode_(code),id=student && authProps_().getProperty('sheet_'+student.code);
  if(!id) throw new Error('Unknown student');
  return SpreadsheetApp.openById(id);
}
function submissionSheet_(code,create) {
  var ss=studentSheet_(code),sh=ss.getSheetByName('Submissions');
  if(!sh && create) {sh=ss.insertSheet('Submissions');sh.getRange(1,1,1,SUBMISSION_HEADERS_.length).setValues([SUBMISSION_HEADERS_]);}
  return sh;
}
function submissions_(p) {
  var sh=submissionSheet_(p.code,false),rows=sh?sh.getDataRange().getValues().slice(1):[];
  return {ok:true,submissions:rows.map(function(r){return {id:r[0],task:r[1],unit:r[2],submitted:r[3],answers:JSON.parse(r[4]||'{}'),status:r[5],feedback:r[6],reviewed:r[7],title:r[8]||r[1],prompts:JSON.parse(r[9]||'{}')};})};
}
function submit_(p) {
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(String(p.id||''))) return {ok:false,error:'Invalid submission identifier'};
  var a=p.answers;
  if(!a || typeof a!=='object' || Array.isArray(a) || JSON.stringify(a).length>30000) return {ok:false,error:'Invalid answers'};
  if(typeof p.task!=='string'||!p.task||p.task.length>150||typeof p.unit!=='string'||!p.unit||p.unit.length>150) return {ok:false,error:'Invalid task'};
  if(Object.keys(a).length>30 || !Object.keys(a).every(function(k){return k.length<=150 && typeof a[k]==='string' && a[k].length<=6000;})) return {ok:false,error:'Answer is too long or invalid'};
  var prompts=p.prompts||{};
  if(typeof prompts!=='object'||Array.isArray(prompts)||Object.keys(prompts).length>30||!Object.keys(prompts).every(function(k){return k.length<=150&&typeof prompts[k]==='string'&&prompts[k].length<=1000;})) return {ok:false,error:'Invalid task prompts'};
  if(!Object.keys(a).some(function(k){return typeof a[k]==='string' && a[k].trim().length>0;})) return {ok:false,error:'Please add your answer before submitting.'};
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    var sh=submissionSheet_(p.code,true),rows=sh.getDataRange().getValues();
    for(var i=1;i<rows.length;i++) if(rows[i][0]===p.id) return {ok:true,id:p.id,received:rows[i][3]};
    var now=now_();
    sh.appendRow([p.id,sanitize_(p.task||'Homework'),sanitize_(p.unit||''),now,JSON.stringify(a),'submitted','','',sanitize_(p.title||p.task),JSON.stringify(prompts)]);
    return {ok:true,id:p.id,received:now};
  } finally {lock.releaseLock();}
}
function review_(p) {
  var sh=submissionSheet_(p.code,false);
  if(!sh) return {ok:false,error:'Submission not found'};
  if(['reviewed','revision-needed'].indexOf(p.status)<0) return {ok:false,error:'Invalid review status'};
  if(typeof p.feedback!=='string'||p.feedback.length>2000) return {ok:false,error:'Keep feedback within 2,000 characters.'};
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    var rows=sh.getDataRange().getValues();
    for(var i=1;i<rows.length;i++) if(rows[i][0]===p.id) {
      sh.getRange(i+1,6,1,3).setValues([[p.status,sanitize_(p.feedback||''),now_()]]);
      if(rows[i][2]==='assigned') setAssignmentStatus_(studentSheet_(p.code),{id:rows[i][1],status:p.status==='reviewed'?'done':'open'});
      return {ok:true};
    }
    return {ok:false,error:'Submission not found'};
  } finally {lock.releaseLock();}
}
function event_(p) {
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(String(p.id||''))) return {ok:false,error:'Invalid event identifier'};
  var ss=studentSheet_(p.code),lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    if(p.type==='quiz') {
      if(typeof p.score!=='number'||typeof p.total!=='number'||!isFinite(p.score)||!isFinite(p.total)||p.total<=0||p.score<0||p.score>p.total) return {ok:false,error:'Invalid score'};
      var sh=ss.getSheetByName('Vocab & Quizzes'), rows=sh.getDataRange().getValues();
      // The event id and score are written together in the same row.
      // Retries after a lost response cannot append a second score.
      for(var i=1;i<rows.length;i++) if(rows[i][6]===p.id) return {ok:true,id:p.id};
      sh.getRange(1,7).setValue('Event ID');
      sh.appendRow([now_(),sanitize_(p.tool),sanitize_(p.section),p.score,p.total,Math.round(p.score/p.total*100),p.id]);
    } else if(p.type==='homework') {
      if(['complete','incomplete'].indexOf(p.status)<0) return {ok:false,error:'Invalid status'};
      upsertHomework_(ss,p);
    } else return {ok:false,error:'Unknown event'};
    return {ok:true,id:p.id};
  } finally {lock.releaseLock();}
}
function publishAssessment_(p) {
  var a=p.assessment;
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(String(p.id||''))) return {ok:false,error:'Invalid assessment identifier'};
  if(!a || typeof a.feedback!=='string' || !a.feedback.trim() || a.feedback.length>2000 || !/^(A1|A2|B1|B2|C1|C2)(\+)?$/.test(a.cefr) || !Array.isArray(a.errors)) return {ok:false,error:'Check the assessment before publishing'};
  if(!['grammar','vocab','coherence'].every(function(k){return typeof a[k]==='number' && isFinite(a[k]) && a[k]>=0 && a[k]<=10;})) return {ok:false,error:'Scores must be between 0 and 10'};
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    var sh=studentSheet_(p.code).getSheetByName('Writing'), rows=sh.getDataRange().getValues();
    for(var i=1;i<rows.length;i++) if(rows[i][9]===p.id) return {ok:true,id:p.id};
    sh.getRange(1,10).setValue('Assessment ID');
    sh.appendRow([now_(),sanitize_(p.title||'Reviewed writing'),sanitize_(a.cefr),a.grammar,a.vocab,a.coherence,sanitize_(a.errors.join('; ')),sanitize_(a.feedback),sanitize_(p.link||''),p.id]);
  } finally {lock.releaseLock();}
  return {ok:true,id:p.id};
}
// User's pre-existing scope helper retained as an editor-only operation.
function authExternalRequest_() {
  var scope='https://www.googleapis.com/auth/script.external_request';
  var info=ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL,[scope]);
  return {ok:true,scope:scope,status:String(info.getAuthorizationStatus()),authorizedScopes:info.getAuthorizedScopes()||[],authorizationUrl:info.getAuthorizationUrl()};
}
