import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/homework-hub.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const {homeworkSection,weeklyTimeEstimate,activeHomework}=exports;
test('homework sections retain the exact source email and separate vocabulary from submission notes',()=>{
 const details="1. Speaking with AI\nTalk about school.\n\n2. Writing — one email\nReply to Megan.\n\nMEGAN'S EMAIL\nHi,\nShould I talk to Jess?\nMegan\n\n3. Vocabulary\nChoose two words. Word bank: reliable, patiently.\n\nWRITING AND SUBMITTING HOMEWORK — Keep every page.\n4. Submit your work\nUpload it.";
 assert.match(homeworkSection(details,'writing'),/MEGAN'S EMAIL\nHi,\nShould I talk to Jess\?/);assert.doesNotMatch(homeworkSection(details,'writing'),/Word bank/);
 assert.equal(homeworkSection(details,'vocabulary'),'Choose two words. Word bank: reliable, patiently.');assert.equal(homeworkSection(details,'speaking'),'Talk about school.');
 assert.equal(homeworkSection('An unstructured task','vocabulary'),'');
});
test('the selected homework is resolved by saved ID without deriving a unit from a book default',()=>{
 const rows=[{id:'archived',status:'archived',title:'Old'},{id:'active',status:'open',title:'HW4 · Unit 5'},{id:'other',status:'open',title:'Another task'}];
 assert.equal(activeHomework(rows,'other').id,'other');assert.equal(activeHomework(rows,'archived').id,'active');assert.equal(activeHomework(rows).title,'HW4 · Unit 5');
});
test('ring time estimates use remaining work, round up and never create holiday debt',()=>{
 const p={paused:false,minutes:0,target:30,writing:0,writingTarget:1,vocabulary:0,vocabularyTarget:2};
 assert.equal(weeklyTimeEstimate(p),55);assert.equal(weeklyTimeEstimate({...p,minutes:9.4,writing:1}),30);assert.equal(weeklyTimeEstimate({...p,minutes:30,writing:1,vocabulary:2}),0);assert.equal(weeklyTimeEstimate({...p,paused:true}),null);
});


test('the homework screen starts with exactly the three requested practice choices',async()=>{
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{renderToStaticMarkup}=await import('react-dom/server');
 const states=['vocabulary',null];let state=0;const out={};
 const empty=()=>null;const mocks={'react':{...React,useState:()=>[states[state++],()=>{}],useEffect:()=>{}},'react/jsx-runtime':jsx,'next/link':{default:({href,children})=>React.createElement('a',{href},children)},'@/lib/learning':{},'@/lib/lesson-practice':{},'@/lib/homework-hub':exports,'@/lib/today-task':{assignmentTargetId:id=>'assignment-'+id,learnerTaskTitle:t=>t},'./Icons':{BookIcon:empty,PencilIcon:empty},'./LearningVisuals':{MicrophoneIcon:empty},'./SubmissionForm':{default:empty},'./SavedWriting':{default:empty},'./EngagementPanel':{default:props=>React.createElement('div',null,props.vocabularyOnly?'Direct vocabulary form':'Wrong full dashboard')}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/HomeworkHub.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:name=>mocks[name]});
 const html=renderToStaticMarkup(React.createElement(out.default,{code:'student',name:'Student',assignment:{id:'named-homework',title:'HW4 · Money',details:'3. Vocabulary\nChoose two words from Money.',status:'open'}}));
 for(const label of ['AI speaking','Writing','Vocabulary'])assert.ok(html.includes(label));assert.match(html,/HW4 · Money/);assert.match(html,/Choose two words from Money/);assert.match(html,/Direct vocabulary form/);assert.doesNotMatch(html,/Unit 1|way2go/);
});

test('a current homework hides unrelated starter exercises without relying on historical reset rows',async()=>{
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{renderToStaticMarkup}=await import('react-dom/server');
 const assigned={id:'homework-new-unit',date:'2026-11-16',title:'HW3 · Current unit',details:'1. Speaking\nCurrent task',due:'',status:'open'};
 const states=[[assigned],'',true,[]];let index=0;const out={};const empty=()=>null;
 const mocks={react:{...React,useState:()=>[states[index++],()=>{}],useEffect:()=>{}},'react/jsx-runtime':jsx,'next/link':{default:p=>React.createElement('a',p)},'@/components/StudentContext':{useStudent:()=>({code:'ferdi-7h3k',displayName:'Ferdi'})},'@/components/Screen':{default:({children})=>React.createElement('main',null,children)},'@/components/HomeworkHub':{default:()=>React.createElement('section',null,'CURRENT LINKED HOMEWORK')},'@/lib/homework-hub':exports,'@/lib/remote':{isCurrentAssignment:()=>true},'@/lib/clarity':{isCompletedAssignment:()=>false,readableDate:d=>d},'@/lib/speaking-homework':{isFerdiSpeakingHomework:()=>false},'@/lib/today-task':{selectedAssignmentId:()=>'',learnerTaskTitle:t=>t},'@/components/Icons':new Proxy({},{get:()=>empty})};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/views/HomeworkListView.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>mocks[n]||{default:empty,LatestLessonPractice:empty},window:{location:{search:'',hash:''}}});
 const html=renderToStaticMarkup(React.createElement(out.default,{unit:{id:'starter',homework:[{week:1,title:'OLD FAMILY STARTER',tasks:[{type:'written'}]}]}}));
 assert.match(html,/CURRENT LINKED HOMEWORK/);assert.match(html,/Earlier lesson practice/);assert.match(html,/Reference only · not currently assigned/);assert.doesNotMatch(html,/Other homework/);
});
