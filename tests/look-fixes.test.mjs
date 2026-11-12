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
