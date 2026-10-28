// Practice attempts are separate from originals, assignments and formal marks.
function documentPracticeRows_(code,id){var sh=studentSheet_(code).getSheetByName('Document practice');return sh?sh.getDataRange().getValues().slice(1).filter(function(r){return r[1]===id;}):[];}
function documentPracticeAnswer_(value){try{return JSON.parse(value);}catch(e){return String(value||'');}}
function documentPracticePublic_(row){return {id:row[0],documentId:row[1],version:row[2],exerciseId:row[3],created:row[4],answer:documentPracticeAnswer_(row[5]),result:JSON.parse(row[6])};}
function documentPractice_(p,s,found){
 if(s.role!=='student'||p.preview)throw new Error('Student practice only.');
 if(!documentId_(p.attemptId)||!documentText_(p.answer,1200)||!p.answer.trim())throw new Error('Try an answer before checking.');
 var lock=LockService.getScriptLock();lock.waitLock(10000);try{
  found=documentFind_(p.code,p.id);var version=documentAnalysisVersion_(found.row),a=JSON.parse(found.row[6]||'null'),rows=documentPracticeRows_(p.code,p.id),prior=rows.filter(function(r){return r[0]===p.attemptId;})[0];
  if(prior){if(prior[2]!==p.version||prior[3]!==p.exerciseId||documentPracticeAnswer_(prior[5])!==p.answer.trim())throw new Error('This attempt identifier has already been used.');return {ok:true,received:true,attempt:documentPracticePublic_(prior)};}
  if(!a||!a.writing||!a.writing.original.trim()||version!==p.version)throw new Error('The feedback changed. Open the current exercises before trying again.');
  var exercise=(a.exercises||[]).filter(function(e){return e.id===p.exerciseId;})[0];if(!exercise)throw new Error('This exercise is not in the saved feedback.');
  var now=new Date().toISOString();if(rows.filter(function(r){return String(r[4]).slice(0,10)===now.slice(0,10);}).length>=100)throw new Error('Today’s practice save limit has been reached.');
  function normal(t){return String(t).toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();}
  var closed=['choice','gap'].indexOf(exercise.type)>=0,result={status:closed?(exercise.accepted.some(function(x){return normal(x)===normal(p.answer);})?'correct':'try-again'):'compare',example:exercise.example,explanation:exercise.explanation};
  var ss=studentSheet_(p.code),sh=ss.getSheetByName('Document practice');if(!sh){sh=ss.insertSheet('Document practice');sh.appendRow(['Id','Document','Review version','Exercise','Created','Answer JSON','Result JSON']);}
  var row=[p.attemptId,p.id,version,exercise.id,now,JSON.stringify(p.answer.trim()),JSON.stringify(result)];sh.appendRow(row);return {ok:true,received:true,attempt:documentPracticePublic_(row)};
 }finally{lock.releaseLock();}
}
function documentPracticeView_(code,row,analysis,teacher){
 var attempts=documentPracticeRows_(code,row[0]).map(documentPracticePublic_),version=documentAnalysisVersion_(row);
 if(analysis&&!teacher)analysis.exercises=(analysis.exercises||[]).map(function(e){var safe={id:e.id,type:e.type,prompt:e.prompt,options:e.options,focus:e.focus};return safe;});
 return {version:version,attempts:attempts};
}
