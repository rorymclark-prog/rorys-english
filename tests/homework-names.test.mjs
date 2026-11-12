import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('apps-script/progress-sync/Code.gs','utf8'),ctx={};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function homeworkYear_'),source.indexOf('function getAssignments_')),ctx);
const row=(title,date='2026-10-17',id=title,status='open')=>[date,title,'Original instructions','',''+status,id];
const titles=rows=>Array.from(ctx.numberedHomeworkRows_(rows),r=>r[1]);
test('homework numbers stay with original rows across active, archived and completed work',()=>{
 const rows=[row('First task','2026-09-19','a','archived'),row('Friendships','2026-10-17','b','done')],original=JSON.stringify(rows);
 assert.deepEqual(titles(rows),['HW1 · First task','HW2 · Friendships']);assert.equal(JSON.stringify(rows),original);
 rows.push(row('HW3 · Week of 16 November 2026 · Money','2026-11-12','c'));
 assert.deepEqual(titles(rows),['HW1 · First task','HW2 · Friendships','HW3 · Week of 16 November 2026 · Money']);
});
test('numbering is scoped to the learner input and school year, without duplicate explicit prefixes',()=>{
 assert.deepEqual(titles([row('Older','2026-05-01'),row('Current','2026-09-01'),row('HW4 · Named','2026-09-03'),row('Next','2026-09-04')]),['HW1 · Older','HW1 · Current','HW4 · Named','HW2 · Next']);
 assert.deepEqual(titles([row('Another student')]),['HW1 · Another student']);
});
test('a named homework week is a valid date, not an implicit deadline',()=>{
 assert.equal(ctx.homeworkWeek_('2026-11-16'),'Week of 16 November 2026');assert.equal(ctx.homeworkWeek_(''),'');
 for(const date of ['2026-02-30','tomorrow','2026-13-01'])assert.throws(()=>ctx.homeworkWeek_(date));
});
test('assigning named homework continues the learner sequence, leaves old rows intact and keeps the deadline separate',()=>{
 const rows=[row('First task'),row('Second task')],existing=JSON.stringify(rows);
 const c={...ctx,MAX_CELL_CHARS:200,TEACHER_PASSWORD_PROP:'password',PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'teacher-only'})},studentByAnyCode_:()=>({code:'student-a'}),SpreadsheetApp:{openById:()=>({getSheetByName:()=>({appendRow:r=>rows.push(r)})})},ensureTabs_:()=>{},LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},Utilities:{getUuid:()=> 'synthetic-assignment-id'},now_:()=> '2026-11-12 12:00',rows_:()=>({rows}),sanitize_:v=>v,json_:v=>v,console};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function assignHomework_'),source.indexOf('// Shared guard for every teacher-only action')),c);
 const p={teacherSecret:'teacher-only',code:'student-a',title:'Money',week:'2026-11-16',due:'2026-11-20',details:'Keep your own draft.'};
 assert.equal(c.assignHomework_(p).ok,true);assert.equal(rows[2][1],'HW3 · Week of 16 November 2026 · Money');assert.equal(rows[2][3],'2026-11-20');assert.equal(JSON.stringify(rows.slice(0,2)),existing);
 assert.equal(c.assignHomework_({...p,title:'Another task',week:''}).ok,true);assert.equal(rows[3][1],'HW4 · Another task');
 assert.equal(c.assignHomework_({...p,teacherSecret:'wrong'}).ok,false);assert.equal(rows.length,4);
});
