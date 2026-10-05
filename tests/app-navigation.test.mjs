import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/app-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const {appBackState}=exports,scope='/s/learner/';
test('a cold installed app or another workspace cannot go back into external history',()=>{
 assert.equal(appBackState(scope,scope+'homework/',8,undefined,null).canGoBack,false);
 assert.equal(appBackState(scope,scope,9,undefined,{path:'/teacher/',length:8}).canGoBack,false);
 assert.equal(appBackState(scope,scope,9,undefined,{path:'/s/other/',length:8}).canGoBack,false);
});
test('internal navigation and reload retain a safe predecessor without overwriting router state',()=>{
 const state=appBackState(scope,scope+'homework/',3,undefined,{path:scope,length:2});assert.equal(state.canGoBack,true);
 assert.equal(appBackState(scope,state.path,3,state,null),state);
 assert.equal(appBackState(scope,scope+'progress/',3,state,{path:state.path,length:3}).canGoBack,true);
});
test('returning to the original entry stops at the workspace start; replacing a cold entry does not create a predecessor',()=>{
 const first=appBackState(scope,scope,2,undefined,null);
 assert.equal(appBackState(scope,scope,3,first,{path:scope+'homework/',length:3}).canGoBack,false);
 assert.equal(appBackState(scope,scope,8,{scope,path:scope+'homework/',canGoBack:false},{path:scope+'homework/',length:8}).canGoBack,false);
});
