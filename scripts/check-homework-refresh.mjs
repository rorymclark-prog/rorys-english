import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(file,deps={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>deps[name]||(()=>{throw Error(name)})()});return exports;};
const lesson=load('src/lib/lesson-practice.ts'),hub=load('src/lib/homework-hub.ts');
const refresh=load('src/lib/homework-refresh.ts',{'./lesson-practice':lesson,'./homework-hub':hub});
const path=process.argv[2];if(!path)throw Error('Pass a private JSON plan file.');
const rows=JSON.parse(fs.readFileSync(path,'utf8')),ids=new Set();
for(const row of rows){
 const practice=lesson.readLessonPractice(row.record?.body?.lessonPractice);
 if(!practice)throw Error(`${row.learner}: invalid or oversized lesson practice`);
 const assignment=refresh.buildHomeworkRefresh(practice,row.date,row.assignmentNumber);
 const issues=refresh.homeworkRefreshIssues(row.assignment||assignment,practice);
 if(issues.length)throw Error(`${row.learner}: mismatched ${issues.join(', ')}`);
 if(row.record.visibility!=='shared'||row.record.body.tutorPrivate||row.record.body.transcript||row.record.date!==practice.lessonDate)throw Error('Only student-safe, matching lesson practice may be released.');
 if(ids.has(assignment.id))throw Error('Duplicate assignment ID');ids.add(assignment.id);
 row.assignment=assignment;
}
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(rows,null,2),{mode:0o600});
console.log(JSON.stringify({verified:true,plans:rows.map(r=>({learner:r.learner,assignment:r.assignment.id,title:r.assignment.title,practice:r.record.id,due:r.assignment.due}))}));
