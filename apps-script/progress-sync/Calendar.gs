// Private lesson scheduling. Calendar links grant read-only access to lesson
// times only; they never expose homework, submissions, feedback or requests.
var CALENDAR_ZONE_ = 'Europe/Vienna';
var CALENDAR_ACTIONS_ = ['teacherCalendarLessons','teacherCalendarLink','teacherCalendarRevoke','calendarLessons','calendarLink','calendarRevoke','calendarRequest','teacherCalendarSave','teacherCalendarCancel','teacherCalendarRespond','teacherCalendarBreak','teacherCalendarRemoveBreak','calendarTestSave','teacherCalendarTestSave','calendarTestCancel','teacherCalendarTestCancel','calendarTestFile','teacherCalendarTestFile'];
function calendarSheet_(code,name,create) {
  var ss=studentSheet_(code),sh=ss.getSheetByName(name);
  if(!sh&&create){sh=ss.insertSheet(name);sh.getRange(1,1,1,2).setValues([['Id','Record JSON']]);}
  return sh;
}
function calendarRows_(code,name){var sh=calendarSheet_(code,name,false);return sh?sh.getDataRange().getValues().slice(1).filter(function(r){return r[0];}).map(function(r){return JSON.parse(r[1]);}):[];}
function calendarPut_(code,name,record){var sh=calendarSheet_(code,name,true),rows=sh.getDataRange().getValues();for(var i=1;i<rows.length;i++)if(rows[i][0]===record.id){sh.getRange(i+1,2).setValue(JSON.stringify(record));return;}sh.appendRow([record.id,JSON.stringify(record)]);}
function calendarDate_(date){if(typeof date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(date))throw Error('Choose a full lesson date.');var d=new Date(date+'T12:00:00Z');if(!isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('Choose a valid lesson date.');return d;}
function calendarAddDays_(date,n){var d=calendarDate_(date);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function calendarStart_(date,time){
  calendarDate_(date);if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Choose a valid start time.');
  var base=new Date(date+'T'+time+':00Z').getTime(),found=[];
  // Vienna uses UTC+1 or UTC+2. Require exactly one mapping: reject both the
  // missing spring hour and ambiguous autumn hour instead of shifting lessons.
  [1,2].forEach(function(offset){var d=new Date(base-offset*3600000);if(Utilities.formatDate(d,CALENDAR_ZONE_,"yyyy-MM-dd'T'HH:mm")===date+'T'+time)found.push(d);});
  if(found.length!==1)throw Error('This time falls in a clock change. Choose another time.');return found[0];
}
function calendarDuration_(n){if(typeof n!=='number'||!isFinite(n)||Math.floor(n)!==n||n<15||n>240)throw Error('Choose a lesson length between 15 and 240 minutes.');return n;}
function calendarId_(id){if(typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(id))throw Error('Invalid lesson identifier.');return id;}
function calendarText_(value,max,fallback){if(value===undefined)return fallback||'';if(typeof value!=='string'||value.length>max)throw Error('The lesson text is too long.');return value.trim();}
function calendarBlocked_(date,breaks){return breaks.some(function(b){return !b.removed&&date>=b.from&&date<=b.to;});}
function calendarRoster_(p,s){if(s.role==='teacher'&&!p.preview&&p.code==='__teacher__')return getRoster_();var st=studentByAnyCode_(p.code);if(!st)throw Error('Unknown student.');return [st];}
function calendarRead_(p,s){var roster=calendarRoster_(p,s),lessons=[],requests=[],breaks=[],tests=[];roster.forEach(function(st){calendarRows_(st.code,'School test calendar').forEach(function(t){tests.push(calendarTestPublic_(t,st));});calendarRows_(st.code,'Lessons').forEach(function(l){lessons.push(Object.assign({},l,{studentCode:st.code,studentName:st.name}));});calendarRows_(st.code,'Lesson requests').forEach(function(r){requests.push(Object.assign({},r,{studentCode:st.code,studentName:st.name}));});calendarRows_(st.code,'Lesson breaks').forEach(function(b){if(!b.removed)breaks.push(Object.assign({},b,{studentCode:st.code,studentName:st.name}));});});return {ok:true,lessons:lessons,requests:requests,breaks:breaks,tests:tests,timezone:CALENDAR_ZONE_};}
function calendarConflict_(candidates,ignoreIds){var existing=[];getRoster_().forEach(function(st){existing=existing.concat(calendarRows_(st.code,'Lessons'));});var all=existing.filter(function(l){return l.status==='scheduled'&&ignoreIds.indexOf(l.id)<0;});for(var i=0;i<candidates.length;i++){var l=candidates[i];for(var j=0;j<all.length;j++)if(l.start<all[j].end&&l.end>all[j].start)throw Error('This time overlaps another lesson. Choose a different time.');all.push(l);}}
function calendarRecord_(p,id,seriesId,sequence){var start=calendarStart_(p.date,p.time),duration=calendarDuration_(p.duration);return {id:id,seriesId:seriesId,date:p.date,time:p.time,duration:duration,start:start.toISOString(),end:new Date(start.getTime()+duration*60000).toISOString(),timezone:CALENDAR_ZONE_,title:calendarText_(p.title,120,'English lesson with Rory')||'English lesson with Rory',location:calendarText_(p.location,200,''),status:'scheduled',sequence:sequence,updatedAt:new Date().toISOString()};}
function calendarSave_(p,st){
  calendarId_(p.id);var lessons=calendarRows_(st.code,'Lessons'),breaks=calendarRows_(st.code,'Lesson breaks'),old=lessons.find(function(l){return l.id===p.id;});
  if(old){if(p.expectedSequence!==old.sequence)throw Error('This lesson has changed. Refresh before saving.');var edit=calendarRecord_(p,old.id,old.seriesId,old.sequence+1);if(p.acceptedRequest)edit.acceptedRequest=p.acceptedRequest;if(calendarBlocked_(edit.date,breaks))throw Error('That date is in a lesson break.');calendarConflict_([edit],[old.id]);calendarPut_(st.code,'Lessons',edit);return {ok:true,id:edit.id};}
  if(p.expectedSequence!==undefined)throw Error('Lesson not found. Refresh before saving.');
  // A retry of an already-created series returns its receipt, including after
  // a later edit/cancellation. It never recreates or resets those lessons.
  var previous=lessons.filter(function(l){return l.seriesId===p.id;});if(previous.length)return {ok:true,id:p.id,created:previous.length,duplicate:true};
  if(['once','fortnightly'].indexOf(p.repeat)<0)throw Error('Choose once or every two weeks.');
  var until=p.repeat==='fortnightly'?p.until:p.date;calendarDate_(until);calendarDate_(p.date);if(until<p.date||new Date(until)-new Date(p.date)>366*86400000)throw Error('Choose an end date within one year of the first lesson.');
  var dates=[],skipped=0;for(var date=p.date;date<=until;date=calendarAddDays_(date,14)){if(calendarBlocked_(date,breaks)){skipped++;continue;}dates.push(date);if(p.repeat==='once')break;}
  if(!dates.length)throw Error('All these dates fall in a lesson break.');if(lessons.length+dates.length>1000)throw Error('The lesson calendar is full.');
  var records=dates.map(function(date){return calendarRecord_(Object.assign({},p,{date:date}),p.id+'_'+date.replace(/-/g,''),p.id,0);});calendarConflict_(records,[]);var sh=calendarSheet_(st.code,'Lessons',true),row=sh.getDataRange().getValues().length+1;sh.getRange(row,1,records.length,2).setValues(records.map(function(l){return [l.id,JSON.stringify(l)];}));return {ok:true,id:p.id,created:records.length,skipped:skipped};
}
function calendarCancel_(p,st){var l=calendarRows_(st.code,'Lessons').find(function(x){return x.id===p.id;});if(!l)throw Error('Lesson not found.');if(l.status==='cancelled')return {ok:true};if(p.expectedSequence!==l.sequence)throw Error('This lesson has changed. Refresh before cancelling.');l.status='cancelled';l.sequence++;l.updatedAt=new Date().toISOString();calendarPut_(st.code,'Lessons',l);return {ok:true};}
function calendarRequest_(p,st,s){calendarId_(p.id);var rows=calendarRows_(st.code,'Lesson requests'),duplicate=rows.find(function(r){return r.id===p.id;});if(duplicate)return {ok:true,id:duplicate.id};var l=calendarRows_(st.code,'Lessons').find(function(x){return x.id===p.lessonId;});if(!l||l.status!=='scheduled'||new Date(l.end).getTime()<=Date.now())throw Error('Choose an upcoming lesson.');if(rows.some(function(r){return r.lessonId===l.id&&r.status==='pending';}))throw Error('There is already a request for this lesson.');calendarStart_(p.date,p.time);if(calendarBlocked_(p.date,calendarRows_(st.code,'Lesson breaks')))throw Error('That date is in a lesson break.');if(new Date(calendarStart_(p.date,p.time)).getTime()<=Date.now())throw Error('Choose a future time.');var r={id:p.id,lessonId:l.id,date:p.date,time:p.time,message:calendarText_(p.message,500,''),role:s.role,status:'pending',lessonSequence:l.sequence,createdAt:new Date().toISOString()};calendarPut_(st.code,'Lesson requests',r);return {ok:true,id:r.id};}
function calendarRespond_(p,st){var r=calendarRows_(st.code,'Lesson requests').find(function(x){return x.id===p.id;});if(!r)throw Error('Request not found.');if(['accepted','declined'].indexOf(p.status)<0)throw Error('Choose accept or decline.');if(r.status!=='pending'){if(r.status===p.status)return {ok:true};throw Error('This request has already been answered.');}if(p.status==='accepted'){var l=calendarRows_(st.code,'Lessons').find(function(x){return x.id===r.lessonId;});if(!l||l.status!=='scheduled')throw Error('The lesson has changed since this request. Review its current time.');if(l.acceptedRequest!==r.id){if(l.sequence!==r.lessonSequence)throw Error('The lesson has changed since this request. Review its current time.');if(calendarStart_(r.date,r.time).getTime()<=Date.now())throw Error('The requested time has passed. Decline this request and choose a new time.');calendarSave_({id:l.id,expectedSequence:l.sequence,date:r.date,time:r.time,duration:l.duration,title:l.title,location:l.location,acceptedRequest:r.id},st);}}r.status=p.status;r.respondedAt=new Date().toISOString();calendarPut_(st.code,'Lesson requests',r);return {ok:true};}
function calendarBreak_(p,st){calendarId_(p.id);calendarDate_(p.from);calendarDate_(p.to);if(p.to<p.from||new Date(p.to)-new Date(p.from)>366*86400000)throw Error('Choose a valid break range within one year.');var old=calendarRows_(st.code,'Lesson breaks').find(function(b){return b.id===p.id;});if(old&&old.removed)return {ok:true,duplicate:true};var b=old||{id:p.id,from:p.from,to:p.to,label:calendarText_(p.label,120,'School break')||'School break',createdAt:new Date().toISOString()};if(!old)calendarPut_(st.code,'Lesson breaks',b);var cancelled=0;calendarRows_(st.code,'Lessons').forEach(function(l){if(l.status==='scheduled'&&l.date>=b.from&&l.date<=b.to){l.status='cancelled';l.sequence++;l.updatedAt=new Date().toISOString();calendarPut_(st.code,'Lessons',l);cancelled++;}});return {ok:true,cancelled:cancelled};}
function calendarLinkKey_(code){return 'calendar_link_'+digest_(code);}
function calendarLinkVersion_(scope){return version_(scope.indexOf('__teacher__')===0?'__teacher__':scope);}
function calendarLink_(p,s){if(s.role==='teacher'&&p.code!=='__teacher__'&&!studentByAnyCode_(p.code))throw Error('Unknown student.');var scope=s.role==='teacher'?(p.code==='__teacher__'?p.code:'__teacher__:'+p.code):s.code,key=calendarLinkKey_(scope);if(p.action==='calendarRevoke'){authProps_().deleteProperty(key);return {ok:true};}var token=token_();authProps_().setProperty(key,JSON.stringify({hash:digest_(token),version:calendarLinkVersion_(scope),createdAt:new Date().toISOString()}));return {ok:true,calendarToken:token,scope:scope};}
function calendarFeed_(p){
  if(typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token)||typeof p.code!=='string'||p.code.length>100)return {ok:false,error:'Calendar link unavailable.'};
  var raw=authProps_().getProperty(calendarLinkKey_(p.code));if(!raw)return {ok:false,error:'Calendar link unavailable.'};var link=JSON.parse(raw);if(link.hash!==digest_(p.token)||link.version!==calendarLinkVersion_(p.code))return {ok:false,error:'Calendar link unavailable.'};
  var teacher=p.code.indexOf('__teacher__')===0,studentCode=p.code.indexOf('__teacher__:')===0?p.code.slice(12):p.code;var roster=p.code==='__teacher__'?getRoster_():[studentByAnyCode_(studentCode)];if(!roster[0])return {ok:false,error:'Calendar link unavailable.'};var lessons=[];roster.forEach(function(st){calendarRows_(st.code,'Lessons').forEach(function(l){lessons.push({id:l.id,start:l.start,end:l.end,title:teacher?st.name+' · '+l.title:l.title,location:l.location,status:l.status,sequence:l.sequence,updatedAt:l.updatedAt});});calendarRows_(st.code,'School test calendar').forEach(function(t){lessons.push({id:'test_'+t.id,date:t.date,title:(teacher?st.name+' · ':'')+t.title,location:'',status:t.status,sequence:t.sequence,updatedAt:t.updatedAt});});});return {ok:true,lessons:lessons};
}
function calendarService_(p,s){
  try{
    if(p.action==='calendarTestFile'||p.action==='teacherCalendarTestFile'){if(p.action.indexOf('teacher')===0&&s.role!=='teacher')return {ok:false,error:'Access denied'};return calendarTestFile_(p);}
    if(p.action==='calendarLessons')return calendarRead_(p,s);
    if(p.action==='teacherCalendarLessons'){if(s.role!=='teacher')return {ok:false,error:'Access denied'};return calendarRead_(p,s);}
    if(p.preview)return {ok:false,error:'Student preview is read-only.'};
    if(p.action.indexOf('teacher')===0&&s.role!=='teacher')return {ok:false,error:'Access denied'};
    var lock=LockService.getScriptLock();lock.waitLock(10000);try{
      if(p.action==='teacherCalendarLink'||p.action==='teacherCalendarRevoke')return calendarLink_(Object.assign({},p,{action:p.action==='teacherCalendarLink'?'calendarLink':'calendarRevoke'}),s);
      if(p.action==='calendarLink'||p.action==='calendarRevoke')return calendarLink_(p,s);
      var st=studentByAnyCode_(p.code);if(!st||s.role==='teacher'&&p.code!==st.code)return {ok:false,error:'Unknown student.'};
      if(s.role==='parent'&&p.action.indexOf('calendarTest')===0)return {ok:false,error:'Access denied'};
      if(p.action==='calendarTestSave'||p.action==='teacherCalendarTestSave')return calendarTestSave_(p,st);
      if(p.action==='calendarTestCancel'||p.action==='teacherCalendarTestCancel')return calendarTestCancel_(p,st);
      if(p.action==='calendarRequest')return calendarRequest_(p,st,s);
      if(p.action==='teacherCalendarSave')return calendarSave_(p,st);
      if(p.action==='teacherCalendarCancel')return calendarCancel_(p,st);
      if(p.action==='teacherCalendarRespond')return calendarRespond_(p,st);
      if(p.action==='teacherCalendarBreak')return calendarBreak_(p,st);
      if(p.action==='teacherCalendarRemoveBreak'){var b=calendarRows_(st.code,'Lesson breaks').find(function(x){return x.id===p.id;});if(!b)throw Error('Break not found.');b.removed=true;calendarPut_(st.code,'Lesson breaks',b);return {ok:true};}
      return {ok:false,error:'Unknown calendar action.'};
    }finally{lock.releaseLock();}
  }catch(err){return {ok:false,error:err.message||'Could not update the calendar.'};}
}

// Scope photos live in the existing owner-only folder, separate from submitted
// work and AI review. Reads expose indices, never Drive IDs or public links.
function calendarTestPublic_(t,st){return {id:t.id,date:t.date,title:t.title,scope:t.scope,status:t.status,sequence:t.sequence,updatedAt:t.updatedAt,studentCode:st.code,studentName:st.name,files:t.files.map(function(f,i){return {index:i,name:f.name,type:f.type,size:f.size};})};}
function calendarTestSave_(p,st){
  calendarId_(p.id);calendarId_(p.mutationId);
  var rows=calendarRows_(st.code,'School test calendar'),old=rows.find(function(t){return t.id===p.id;});
  if(old&&old.mutationId===p.mutationId)return {ok:true,id:old.id,duplicate:true};
  if(old?p.expectedSequence!==old.sequence:p.expectedSequence!==undefined)throw Error('This test has changed. Refresh before saving.');
  calendarDate_(p.date);var title=calendarText_(p.title,120,''),scope=calendarText_(p.scope,4000,'');if(!title)throw Error('Add a test title.');
  if(!old&&rows.length>=500)throw Error('The school test calendar is full.');
  var remove=p.removeFiles||[];if(!Array.isArray(remove)||remove.some(function(i){return !Number.isInteger(i)||!old||i<0||i>=old.files.length;}))throw Error('Invalid photo selection.');
  var kept=old?old.files.filter(function(f,i){return remove.indexOf(i)<0;}):[];
  var incoming=p.files&&p.files.length?documentValidateFiles_(p.files):[];
  if(incoming.some(function(f){return f.type.indexOf('image/')!==0;}))throw Error('Choose photos of the test scope.');
  if(kept.length+incoming.length>6||kept.concat(incoming).reduce(function(n,f){return n+f.size;},0)>2500000)throw Error('Keep up to six photos, up to 2.5 MB in total.');
  if(!scope&&!kept.length&&!incoming.length)throw Error('Write the test scope or add a photo of it.');
  var stored=[],folder=incoming.length?documentFolder_(st.code):null;
  try{
    incoming.forEach(function(f,i){var file=folder.createFile(Utilities.newBlob(f.bytes,f.type,'test-'+p.id+'-'+p.mutationId+'-'+i+'-'+f.name));stored.push({id:file.getId(),name:f.name,type:f.type,size:f.size});});
    var t={id:p.id,mutationId:p.mutationId,date:p.date,title:title,scope:scope,files:kept.concat(stored),status:'scheduled',sequence:old?old.sequence+1:0,updatedAt:new Date().toISOString()};
    calendarPut_(st.code,'School test calendar',t);return {ok:true,id:t.id};
  }catch(err){stored.forEach(function(f){try{DriveApp.getFileById(f.id).setTrashed(true);}catch(ignored){}});throw err;}
}
function calendarTestCancel_(p,st){
  calendarId_(p.mutationId);var t=calendarRows_(st.code,'School test calendar').find(function(x){return x.id===p.id;});if(!t)throw Error('Test not found.');
  if(t.mutationId===p.mutationId)return {ok:true};if(p.expectedSequence!==t.sequence)throw Error('This test has changed. Refresh before cancelling.');
  t.status='cancelled';t.sequence++;t.mutationId=p.mutationId;t.updatedAt=new Date().toISOString();calendarPut_(st.code,'School test calendar',t);return {ok:true};
}
function calendarTestFile_(p){
  var st=studentByAnyCode_(p.code);if(!st)throw Error('Unknown student.');var t=calendarRows_(st.code,'School test calendar').find(function(x){return x.id===p.id;});
  if(!t||p.expectedSequence!==t.sequence||!Number.isInteger(p.index)||p.index<0||p.index>=t.files.length)throw Error('This photo has changed. Refresh the calendar.');
  var f=t.files[p.index];return {ok:true,file:{name:f.name,type:f.type,data:Utilities.base64Encode(DriveApp.getFileById(f.id).getBlob().getBytes())}};
}
