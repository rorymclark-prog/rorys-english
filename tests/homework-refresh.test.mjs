import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const load=(file,deps={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n]||(()=>{throw Error(n)})()});return exports;};
const lesson=load('src/lib/lesson-practice.ts'),hub=load('src/lib/homework-hub.ts'),refresh=load('src/lib/homework-refresh.ts',{'./lesson-practice':lesson,'./homework-hub':hub});
const p={version:1,status:'ready',sourceReviewId:'review',lessonDate:'2026-11-14',title:'School-life balance',recap:'We planned a day.',focus:['Use will'],speakingPrompt:'Plan a different afternoon.',coaching:'Ask one question and wait.',writingPrompt:'Write your own school blog.',speakingMinutes:5,writingMinutes:20,successCriteria:['My own answer'],assignmentId:'homework-new',unitId:'unit04',vocabularyPrompt:'Explain assignment and set aside.',writingSource:{title:'School blog',text:'A retained reading source.'}};
const record=(id,practice,created='2026-11-16T10:00:00Z')=>({id,date:practice.lessonDate,created,kind:'lesson',visibility:'shared',body:{lessonPractice:practice}});
test('a new homework retains its own speaking brief even when another assignment has newer practice',()=>{
 const rows=[record('correct',p),record('different',{...p,assignmentId:'other'},'2026-11-17T10:00:00Z')];
 assert.equal(lesson.homeworkPracticeRecord(rows,'homework-new').record.id,'correct');
 assert.equal(lesson.homeworkPracticeRecord(rows,'missing'),null);
 assert.equal(lesson.homeworkPracticeRecord([record('legacy',{...p,assignmentId:undefined})],'legacy-assignment').record.id,'legacy');
});
test('one source generates coherent title, writing, vocabulary and voice context without inherited dates',()=>{
 const a=refresh.buildHomeworkRefresh(p,'2026-11-16',3);
 assert.equal(a.title,'HW3 · School-life balance');assert.equal(a.due,'');assert.deepEqual(Array.from(refresh.homeworkRefreshIssues(a,p)),[]);
 assert.equal(hub.homeworkSection(a.details,'writing'),p.writingPrompt);assert.equal(hub.homeworkSection(a.details,'vocabulary'),p.vocabularyPrompt);assert.ok(a.details.includes(p.writingSource.text));
 const stale={...a,title:'HW3 · Old topic',details:'2. Writing\nOld email before 30 October.\n3. Vocabulary\nOld words.',due:'2026-10-30'};
 for(const issue of ['title','writing brief','vocabulary','speaking brief','expired deadline','writing source'])assert.ok(refresh.homeworkRefreshIssues(stale,p).includes(issue));
});
test('the safe practice reader retains only bounded source/context fields and legacy plans still work',()=>{
 const clean=lesson.readLessonPractice({...p,writingSource:{...p.writingSource,tutorPrivate:'SECRET'},transcript:'SECRET'});
 assert.equal(clean.assignmentId,p.assignmentId);assert.equal(clean.writingSource.text,p.writingSource.text);assert.equal(clean.writingSource.tutorPrivate,undefined);assert.equal(clean.transcript,undefined);
 assert.equal(lesson.readLessonPractice({...p,writingSource:{title:'Source',text:'x'.repeat(6001)}}),null);
 assert.equal(lesson.readLessonPractice({...p,assignmentId:'x'.repeat(101)}),null);
});
