import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/teacher-route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URLSearchParams});
const {readTeacherView,teacherViewHref,TEACHER_SECTIONS}=exports;
// Objects built inside the vm context have their own prototypes; compare plain copies.
const plain=v=>JSON.parse(JSON.stringify(v));
const read=href=>{const u=new URL(href,'https://example.test');return plain(readTeacherView(u.search,u.pathname));};

test('every teacher view survives a refresh: href then read gives the same view back',()=>{
  const views=[
    {kind:'home'},
    ...TEACHER_SECTIONS.map(section=>({kind:'student',student:'ferdi-7h3k',section})),
    {kind:'student',student:'ferdi-7h3k',section:'learning',record:'review-abcdefghijklmnop'},
    {kind:'progress',student:'valentin-x1'},
    {kind:'calendar'},{kind:'calendar',student:'ferdi-7h3k'},
    {kind:'live'},{kind:'voice'},
    {kind:'inbox',tab:'messages'},{kind:'inbox',tab:'notifications',student:'ferdi-7h3k'},
  ];
  for(const view of views)assert.deepEqual(read(teacherViewHref(view)),view,teacherViewHref(view));
});

test('links that already exist keep opening the same place',()=>{
  // Notification links (src/lib/inbox-destination.ts) and the menu's routes.
  assert.deepEqual(read('/teacher/?student=ferdi-7h3k&section=learning&record=abcdefghijklmnop12#review-abcdefghijklmnop12'),{kind:'student',student:'ferdi-7h3k',section:'learning',record:'abcdefghijklmnop12'});
  assert.deepEqual(read('/teacher/?student=ferdi-7h3k&section=documents&document=abcdefghijklmnop12'),{kind:'student',student:'ferdi-7h3k',section:'documents'});
  assert.deepEqual(read('/teacher/?student=ferdi-7h3k&section=calendar'),{kind:'calendar',student:'ferdi-7h3k'});
  assert.deepEqual(read('/teacher/?inbox=messages&student=ferdi-7h3k'),{kind:'inbox',tab:'messages',student:'ferdi-7h3k'});
  assert.deepEqual(read('/teacher/calendar/'),{kind:'calendar'});
  assert.deepEqual(read('/rorys-english/teacher/live/'),{kind:'live'});
  assert.deepEqual(read('/teacher/'),{kind:'home'});
});

test('a recorded lesson link without a section opens lesson notes',()=>{
  assert.deepEqual(read('/teacher/?student=ferdi-7h3k&record=abcdefghijklmnop12'),{kind:'student',student:'ferdi-7h3k',section:'learning',record:'abcdefghijklmnop12'});
});

test('unknown or hostile values fall back instead of being trusted',()=>{
  assert.deepEqual(read('/teacher/?student=ferdi-7h3k&section=admin'),{kind:'student',student:'ferdi-7h3k',section:'overview'});
  assert.deepEqual(read('/teacher/?student=%3Cscript%3E'),{kind:'home'});
  assert.deepEqual(read('/teacher/?student=ferdi-7h3k&record=..%2F..%2Fx'),{kind:'student',student:'ferdi-7h3k',section:'overview'});
  assert.deepEqual(read('/teacher/?inbox=everything'),{kind:'home'});
});

test('the default section stays out of the address and the base path is kept',()=>{
  assert.equal(teacherViewHref({kind:'student',student:'ferdi-7h3k',section:'overview'}),'/teacher/?student=ferdi-7h3k');
  assert.equal(teacherViewHref({kind:'student',student:'ferdi-7h3k',section:'review'}),'/teacher/?student=ferdi-7h3k&section=review');
  assert.equal(teacherViewHref({kind:'home'},'/rorys-english'),'/rorys-english/teacher/');
});
