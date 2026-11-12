import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 13 November look fixes: one colour scheme, no empty boxes, a shorter live
// screen and readable small text. Source-text checks in the house style.
const read=f=>fs.readFileSync(f,"utf8");

test("live teaching takes its colours from the app's --re tokens, not its own green palette",()=>{
  const css=read("src/app/teacher/live-coach.css");
  const block=css.slice(css.indexOf(".live-coach{"),css.indexOf(".live-coach .teacher-topbar{"));
  for(const name of ["hero","hero-ink","hero-muted","card","wash","border","accent","record"])assert.match(block,new RegExp(`--lc-${name}:[^;]*var\\(--re-`),`--lc-${name} should map to a --re token`);
  assert.doesNotMatch(block.replace(/--lc-error-(bg|ink):#[0-9a-f]{6}/gi,""),/#[0-9a-fA-F]{3,8}\b/,"no raw hex besides the error pair");
  assert.doesNotMatch(css,/data-palette/,"live teaching no longer has a palette of its own");
});

test("the Ask the learner card uses the accent and the recording panel is a plain card",()=>{
  const css=read("src/app/teacher/live-coach.css");
  assert.match(css,/\.lc-prompt\{[^}]*background:var\(--lc-accent\);color:var\(--re-onaccent\)/);
  assert.match(css,/\.lc-recording\{background:var\(--lc-record\)\}/);
});

test("empty teacher home blocks fold to one line and filled ones still render as cards",()=>{
  const folds=read("src/lib/home-folds.ts");
  assert.match(folds,/Recorded lesson assessments/);assert.match(folds,/Your teaching progress/);
  const lessons=read("src/components/RecordedLessonLinks.tsx");
  assert.match(lessons,/if\(!entries\.length&&!error\)return <details className="home-fold/);
  assert.match(lessons,/<section className="re-card mb-6"/);
  const progress=read("src/components/views/TeachingProgress.tsx");
  assert.match(progress,/if\(loading\|\|!lessons\)return <details className="home-fold/);
  assert.match(progress,/<section className="re-card mt-6"/);
  assert.match(read("src/app/visual-refresh/teacher.css"),/\.home-fold>summary\{[^}]*min-height:44px/);
});
