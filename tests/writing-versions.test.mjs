import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const modules={};function read(name){if(modules[name])return modules[name];const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Uint16Array,require:p=>read(p.replace('./',''))});return modules[name]=exports;}
const {writingVersions,writingDiff}=read('writing-versions');
test('full paragraph versions retain every original word and paragraph boundary',()=>{
 const original='Appart from that, I like it.\n\nHe shold go. I enjoy music.';
 const w={original,comparisons:[{original:'Appart from that, I like it.',corrected:'Apart from that, I like it.',improved:'Apart from that, I find it enjoyable.',note:'Spelling.'},{original:'He shold go.',corrected:'He should go.',improved:'',note:'Spelling.'},{original:'I enjoy music.',corrected:'I enjoy music.',improved:'',note:'Correct.'}]};
 const v=writingVersions(w);assert.equal(v.original,original);assert.equal(v.corrected,'Apart from that, I like it.\n\nHe should go. I enjoy music.');assert.equal(v.model,'Apart from that, I find it enjoyable.\n\nHe should go. I enjoy music.');
});
test('word diffs reconstruct both versions exactly, including punctuation and paragraph spacing',()=>{
 const before='Appart from that, he shold go.\n\nIt is good!',after='Apart from that, he should go.\n\nIt is very good.';
 const diff=writingDiff(before,after);assert.equal(diff.filter(x=>x.kind!=='add').map(x=>x.text).join(''),before);assert.equal(diff.filter(x=>x.kind!=='remove').map(x=>x.text).join(''),after);assert.ok(diff.some(x=>x.kind==='remove'&&x.text==='Appart'));
});
test('an explicitly saved full model is retained rather than rebuilt from sentence hints',()=>{
 const v=writingVersions({original:'I like it.',corrected:'I like it.',model:'I find this rewarding.'});assert.equal(v.model,'I find this rewarding.');assert.equal(v.generatedModel,true);
});
