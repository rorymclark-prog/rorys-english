import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function read(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});return exports;}
const {readableDate,submissionStatus,isCompletedAssignment}=read('src/lib/clarity.ts');
const {matchesFeedbackFilter}=read('src/lib/feedback-source.ts');
test('dates distinguish spreadsheet wall dates, exact dates and Vienna instants',()=>{
 assert.equal(readableDate('2026-09-30'),'Wed, 30 Sept 2026');
 assert.equal(readableDate('2026-10-03T22:30:00Z'),'Sun, 4 Oct 2026');
 assert.equal(readableDate(46221.57152777778),readableDate(new Date(Date.UTC(1899,11,30)+46221*86400000).toISOString().slice(0,10)));
 assert.equal(readableDate('2026-02-30'),'Date not confirmed');
 assert.equal(readableDate('unknown'),'Date not confirmed');assert.equal(readableDate(''),'');
});
test('receipt and review statuses never imply held feedback was released',()=>{
 const base={unit:'u',task:'t',submitted:'2026-10-03',status:'reviewed',feedback:'Well done'};
 assert.equal(submissionStatus([], 'u','t'),'Available to practise');
 assert.equal(submissionStatus([base], 'u','t'),'Feedback from Rory ready');
 assert.match(submissionStatus([{...base,reviewPending:true}], 'u','t'),/waiting for review/);
 assert.equal(submissionStatus([base,{...base,submitted:'2026-10-04',status:'revision-needed'}], 'u','t'),'Revision requested');
 assert.equal(submissionStatus([base], 'other','t'),'Available to practise');
 for(const status of ['done','Completed',' reviewed '])assert.equal(isCompletedAssignment(status),true);
 assert.equal(isCompletedAssignment('ready'),false);
});
test('source filters separate AI conversations, recorded lesson work and released teacher feedback',()=>{
 const teacher={kind:'lesson',author:'Rory',visibility:'shared',body:{summary:'My feedback'}};
 const chat={...teacher,kind:'speaking',body:{evidenceType:'AI conversation captions'}};
 const privateReview={...teacher,visibility:'teacher',body:{source:'ferdi/lesson-recording/2026-10-03/id'}};
 const practice={...teacher,body:{feedbackOrigin:'recorded-lesson-practice',lessonPractice:{}}};
 assert.equal(matchesFeedbackFilter(teacher,'rory'),true);
 for(const r of [chat,privateReview,practice])assert.equal(matchesFeedbackFilter(r,'rory'),false);
 assert.equal(matchesFeedbackFilter(chat,'chat'),true);
 for(const r of [privateReview,practice])assert.equal(matchesFeedbackFilter(r,'recorded'),true);
 assert.equal(matchesFeedbackFilter(chat,'recorded'),false);
});
test('English helpers use the correct current school context without spending AI requests',()=>{
 const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/progress-sync/Code.gs','utf8'),ctx);
 let prompt='',calls=0;
 ctx.studentByAnyCode_=code=>({code:code==='parent'?'ferdi':code,name:code==='valentin'?'Valentin':'Ferdi'});
 ctx.aiCount_=()=>0;ctx.focusNoteFor_=()=>'';ctx.aiInc_=()=>{};ctx.json_=x=>x;
 ctx.callClaude_=(_model,system)=>{prompt=system;calls++;return {ok:true};};
 ctx.getAi_({secret:ctx.SECRET,code:'ferdi',kind:'tutor',q:'Help me practise'});
 assert.match(prompt,/English in Context 5/);assert.match(prompt,/Family life/);assert.doesNotMatch(prompt,/way2go/);assert.match(prompt,/terms in brackets/);
 ctx.getAi_({secret:ctx.SECRET,code:'valentin',kind:'writing',q:'Help me practise'});
 assert.match(prompt,/way2go! 8/);assert.match(prompt,/Healthy and happy/);assert.doesNotMatch(prompt,/Family life|B1 level/);
 const before=calls;assert.equal(ctx.getAi_({secret:ctx.SECRET,code:'parent',q:'Help'}).ok,false);assert.equal(calls,before);
});
