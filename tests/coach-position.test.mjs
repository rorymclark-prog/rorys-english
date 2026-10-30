import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});return exports;}
const position=load('src/lib/coach-position.ts'),pdf=load('src/lib/coach-pdf.ts'),folder=load('src/lib/coach-folder.ts');
const pages=[{number:1,text:'School lesson. Our opening conversation.'},{number:2,text:'Morning routines: timetable assembly registration playground homework.'},{number:3,text:'Science experiment: volcano eruption lava crater molten rocks.'}];
test('every lesson page appears in a bounded map, with image-only pages explicitly qualified',()=>{
 const map=position.coachLessonMap(pages);assert.match(map,/PAGE 3: Science experiment/);
 assert.match(position.coachLessonMap([{number:1,text:''}]),/image-only/);
 const many=Array.from({length:300},(_,i)=>({number:i+1,text:'words '.repeat(2000)}));
 const bounded=position.coachLessonMap(many);assert.ok(bounded.length<=40000);assert.match(bounded,/PAGE 300:/);
});
test('automatic page changes require a high estimate plus distinct lesson evidence',()=>{
 const candidate={page:3,confidence:'high'};
 assert.equal(position.verifiedCoachPosition(candidate,'The volcano eruption sends molten lava over the crater.',pages),3);
 for(const changed of [{page:3,confidence:'low'},{page:0,confidence:'high'},{page:40,confidence:'high'}])assert.equal(position.verifiedCoachPosition(changed,'volcano eruption molten lava',pages),null);
 assert.equal(position.verifiedCoachPosition(candidate,'Yes okay tell me about it.',pages),null);
 assert.equal(position.verifiedCoachPosition(candidate,'We are on page 2.',pages),null);
 assert.equal(position.verifiedCoachPosition(candidate,'Now go to slide 3.',pages),3);
 assert.equal(position.verifiedCoachPosition(candidate,'Page 3 or page 2?',pages),null);
 assert.equal(position.verifiedCoachPosition(candidate,'volcano eruption molten lava',[...pages,{number:4,text:pages[2].text}]),null);
 assert.equal(position.verifiedCoachPosition({page:1,confidence:'high'},'Page 1 please.',[{number:1,text:''}]),null);
});
test('PDF indexing reads later exercises even when the displayed page never changes',async()=>{
 const read=[];
 const result=await pdf.indexCoachPdf({numPages:3,async getPage(page){read.push(page);return {async getTextContent(){return {items:[{str:pages[page-1].text,hasEOL:true},{str:'More text'},null,{other:'not text'}]};}};}},()=>false);
 assert.deepEqual(read,[1,2,3]);assert.match(result[2].text,/molten rocks/);assert.equal(result.length,3);
 await assert.rejects(pdf.indexCoachPdf({numPages:201},()=>false));
 let calls=0;
 const cancelled=await pdf.indexCoachPdf({numPages:3,async getPage(){calls++;return {async getTextContent(){return {items:[]};}};}},()=>calls>0);
 assert.equal(cancelled.length,0);assert.equal(calls,1);
});
function fixtureFile(path,text='',bytes=1){return {name:path.split('/').pop(),webkitRelativePath:'SavedLessons/'+path,size:bytes,async text(){return text;}};}
test('saved-folder selection reads only the manifest, binds learners and opens the current deck rather than older supporting files',async()=>{
 const manifest={schema:1,packs:[{learner:'Ferdi',directory:'Ferdi/Pack_A',title:'School',format:'Full unit'},{learner:'Valentin',directory:'Valentin/Pack_B',title:'Healthy living'},{learner:'Ferdi',directory:'Valentin/Pack_B',title:'Wrong student'},{learner:'Ferdi',directory:'Ferdi/../Valentin',title:'Traversal'}]};
 const deck=fixtureFile('Ferdi/Pack_A/Teaching.pptx');deck.text=()=>{throw Error('Unselected document must not be read');};
 const result=await folder.readCoachFolder([fixtureFile('Current_Library_Manifest.json',JSON.stringify(manifest)),deck,fixtureFile('Ferdi/Pack_A/Delivery_Guide.md','Current guide'),fixtureFile('Ferdi/Pack_A/Source-edition-resources/Student_Work.pdf'),fixtureFile('Valentin/Pack_B/Teaching.pptx')]);
 assert.equal(result.length,2);assert.equal(result[0].learner,'ferdi');assert.equal(result[1].learner,'valentin');assert.equal(result[0].document,deck);
 assert.equal('source' in result[0],false);
 await assert.rejects(folder.readCoachFolder([deck]),/Choose Rorys/);
});
