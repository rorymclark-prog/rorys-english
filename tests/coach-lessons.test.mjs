import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports, URL, require:name => {
    if (name in dependencies) return dependencies[name];
    throw Error(name);
  }});
  return exports;
}
const teaching = load('src/lib/teaching-files.ts');
const plans = JSON.parse(fs.readFileSync('content/year-plans.json','utf8'));
const lessons = load('src/lib/coach-lessons.ts', {'./teaching-files':teaching,'./year-plans':{getYearPlan:id=>plans.find(plan=>plan.studentId===id)}});
const pack = {id:'prepared-one',created:'2026-10-29',date:'2026-10-30',kind:'lesson',visibility:'teacher',author:'Rory',title:'Family lesson',body:{summary:'Read the family story.',lessonPoints:'Past simple.',studentNotes:'Explain a reason.',nextStep:'Write an email.',ratings:{grammar:9},transcript:'Do not copy learner evidence.',tutorPrivate:{plan:'Teaching files:\nPowerPoint: https://drive.google.com/file/d/deck1/view'}}};

test('annual lesson references stay with the requested learner and label plans as preparation', () => {
  const ferdi = lessons.coachPlanLessons('ferdi-code','ferdi');
  const valentin = lessons.coachPlanLessons('valentin-code','valentin');
  assert.ok(ferdi.length > 5 && valentin.length > 5);
  assert.ok(ferdi.every(item=>item.learnerCode==='ferdi-code'&&item.id.startsWith('plan:ferdi:')));
  assert.ok(valentin.every(item=>item.learnerCode==='valentin-code'&&item.id.startsWith('plan:valentin:')));
  assert.match(ferdi[0].source,/preparation only/);
  assert.match(ferdi[0].source,/have not been read/);
  assert.match(ferdi[0].unitLabel,/English in Context/);
  assert.match(valentin[0].unitLabel,/way2go/);
  assert.equal(lessons.coachPlanLessons('other','missing').length,0);
});

test('saved-pack references include only recognised private preparation and never imply linked bytes were read', () => {
  const result = lessons.coachSavedLessons('ferdi-code',[pack,{...pack,id:'shared',visibility:'shared'},{...pack,id:'assessment',kind:'test'},{...pack,id:'ordinary',body:{summary:'This is a lesson review.'}}]);
  assert.equal(result.length,1);
  assert.equal(result[0].learnerCode,'ferdi-code');
  assert.equal(result[0].files.length,1);
  assert.match(result[0].source,/contents have not been read/);
  assert.match(result[0].source,/Read the family story/);
  assert.doesNotMatch(result[0].source,/Do not copy learner evidence|grammar|ratings/);
});

test('saved context respects the live coach limits even for long preparation records', () => {
  const [result] = lessons.coachSavedLessons('ferdi-code',[{...pack,title:'t'.repeat(600),body:{...pack.body,summary:'s'.repeat(14000),lessonPoints:'p'.repeat(1000)}}]);
  assert.ok(result.task.length<=500);
  assert.ok(result.objective.length<=700);
  assert.ok(result.source.length<=12000);
});

test('PDF resources are same-origin exact learner paths, excluding cross-learner and disguised paths', () => {
  const good = '/lessons/ferdi/2026-27/unit01/Student_Slides.pdf';
  const paths = [good,'/lessons/valentin/deck.pdf','https://example.com/lessons/ferdi/deck.pdf','//example.com/lessons/ferdi/deck.pdf','/lessons/ferdi/../valentin/deck.pdf','/lessons/ferdi/%2e%2e/valentin/deck.pdf','/lessons/ferdi/a.pdf?download=1','/lessons/ferdi/a.pdf#page=1','/lessons/ferdi/a\\b.pdf','/lessons/ferdi/deck.pptx'];
  const result = lessons.coachPdfResources({studentId:'ferdi',resources:paths.map(url=>({url,title:'Slides',unit:'Unit 1',schoolYear:'2026–27'}))});
  assert.equal(result.length,1);
  assert.equal(result[0].url,good);
  assert.equal(lessons.coachPdfResources({studentId:'../ferdi',resources:[]}).length,0);
});

test('lesson search treats typed words literally and combines title, focus and year', () => {
  assert.equal(lessons.matchesCoachLesson(' FAMILY past ','Family life','Past simple'),true);
  assert.equal(lessons.matchesCoachLesson('unit 2026','Unit 3','2026–27'),true);
  assert.equal(lessons.matchesCoachLesson('[.*','Family life'),false);
  assert.equal(lessons.matchesCoachLesson(' ',undefined),true);
});
