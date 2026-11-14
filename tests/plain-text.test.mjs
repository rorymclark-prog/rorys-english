import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/plain-text.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,String});
const {withoutRecordIds}=exports;

test('review ids are removed from assessment prose without losing the date or meaning',()=>{
  assert.equal(withoutRecordIds('3 October review 089f4988-95e8-5f2a-a46f-f09330c788fd shows the same strengths.'),'3 October review shows the same strengths.');
  assert.equal(withoutRecordIds('8 October original script review source-review-18b833d5-0a53-46f5-be77-3544838309f3 supports checking he/she endings'),'8 October original script review supports checking he/she endings');
  assert.equal(withoutRecordIds('See review-18b833d5-0a53-46f5-be77-3544838309f3, then compare.'),'See, then compare.');
});

test('ordinary text, numbers and empty values pass through',()=>{
  assert.equal(withoutRecordIds('Score 3 / 4 at 19:36 on 2026-10-17.'),'Score 3 / 4 at 19:36 on 2026-10-17.');
  assert.equal(withoutRecordIds(undefined),'');
  assert.equal(withoutRecordIds(''),'');
});
