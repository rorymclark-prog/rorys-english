import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file,dependencies={}){
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Object,JSON,require:name=>{assert.ok(name in dependencies);return dependencies[name];}});
  return exports;
}
const shared=load('src/lib/live-coach.ts');
const service=load('src/lib/server/live-coach-service.ts',{'../live-coach':shared});
const context={learner:'Synthetic sample',unit:'Original test',task:'Describe yesterday',objective:'Past forms',source:'Original invented examples',slide:'Test'};
const body={context,text:'Yesterday I go home.'};
const feedback={heard:body.text,strength:'Clear time.',focus:'Past simple.',correction:'Yesterday I went home.',prompt:'Yesterday I …?',next:'Try one new detail.',uncertainty:''};

test('short text coaching uses a constrained complete feedback object and an explicit reasoning budget',()=>{
  const request=service.coachAnalysis(body);
  assert.equal(request.reasoning.effort,'low');
  assert.equal(request.text.format.type,'json_schema');assert.equal(request.text.format.strict,true);
  assert.equal(request.text.format.schema.additionalProperties,false);
  assert.deepEqual(Array.from(request.text.format.schema.required).sort(),Object.keys(feedback).sort());
  for(const property of Object.values(request.text.format.schema.properties))assert.equal(property.type,'string');
  assert.ok(request.max_output_tokens>=1600);assert.equal(request.store,false);
  const question=service.coachQuestion({context,question:'What could I ask next?'});
  assert.equal(question.reasoning.effort,'low');assert.equal(question.store,false);
});

test('incomplete replies are never used as complete teaching feedback or private advice',()=>{
  for(const status of ['incomplete','failed','cancelled','in_progress']){
    const response={status,output:[{content:[{type:'output_text',text:JSON.stringify(feedback)}]}]};
    assert.throws(()=>service.textFromResponse(response),/incomplete/);
    assert.throws(()=>service.feedbackFromResponse(response,body.text),/incomplete/);
  }
});

test('text feedback retains the actual erroneous original and refuses an invented error quote',()=>{
  const response=value=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
  assert.equal(service.feedbackFromResponse(response(feedback),body.text).correction,'Yesterday I went home.');
  const invented=service.feedbackFromResponse(response(feedback),'Yesterday I went home.');
  assert.equal(invented.correction,'');assert.ok(invented.uncertainty.includes('did not match'));
});
