import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/lesson-calendar.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,TextEncoder,Intl,Date});
const l={id:'example-lesson-identifier',start:'2026-10-03T13:00:00Z',end:'2026-10-03T14:30:00Z',title:'Rory, English; revision\nBEGIN:VEVENT',location:'Online',status:'scheduled',sequence:2,updatedAt:'2026-10-02T10:00:00Z'};
test('calendar export keeps stable identifiers, UTC dates, updates and cancellation tombstones',()=>{
 const ics=exports.buildLessonsIcs([l,{...l,id:'cancelled-lesson-id',status:'cancelled',sequence:3}]);
 assert.ok(ics.includes('DTSTART:20261003T130000Z\r\n'));assert.ok(ics.includes('DTEND:20261003T143000Z\r\n'));assert.ok(ics.includes('SEQUENCE:2\r\n'));assert.ok(ics.includes('STATUS:CANCELLED\r\n'));assert.ok(ics.includes('SUMMARY:Rory\\, English\\; revision\\nBEGIN:VEVENT'));
 assert.equal((ics.match(/^BEGIN:VEVENT\r$/gm)||[]).length,2);assert.equal((ics.match(/BEGIN:VALARM/g)||[]).length,1);
 assert.equal(exports.buildLessonsIcs([l]).match(/UID:.*/)[0],exports.buildLessonsIcs([{...l,start:'2026-10-05T13:00:00Z'}]).match(/UID:.*/)[0]);
});
test('calendar folds long international text at 75 UTF-8 bytes without breaking characters',()=>{
 const ics=exports.buildLessonsIcs([{...l,title:'Äpfel 🗓️ English lesson '.repeat(15)}]);for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);const unfolded=ics.replace(/\r\n /g,'');assert.ok(unfolded.includes('SUMMARY:'));assert.ok(unfolded.includes('Äpfel 🗓️ English lesson '.repeat(15)));assert.ok(!ics.includes('�'));
});
test('Vienna date and next lesson ignore browser timezone and cancelled or ended lessons',()=>{
 assert.equal(exports.viennaDate(new Date('2026-10-03T23:30:00Z')),'2026-10-04');assert.equal(exports.lessonTime('2026-11-03T14:00:00Z'),'15:00');
 assert.equal(exports.nextLesson([{...l,status:'cancelled'},{...l,id:'next',start:'2026-10-04T13:00:00Z',end:'2026-10-04T14:30:00Z'}],new Date('2026-10-03T15:00:00Z').getTime()).id,'next');
});
function feedRoute(reply,throws=false){let calls=0;const ex={};const code=ts.transpileModule(fs.readFileSync('src/app/api/calendar/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports:ex,require:name=>name.includes('progress-transport')?{postProgress:async()=>{calls++;if(throws)throw Error('upstream unavailable');return reply;}}:name.includes('google-http')?{googleHttp:()=>{}}:exports,Response,URL,fetch,process:{env:{APPS_SCRIPT_URL:'https://script.google.com/example'}},console:{error:()=>{throw Error('Calendar tokens must not be logged');}}});return {GET:ex.GET,calls:()=>calls};}
test('calendar feed rejects missing links without contacting the private service and disables caching',async()=>{
 const route=feedRoute({ok:true,lessons:[l]});const invalid=await route.GET(new Request('https://app.test/api/calendar/?code=learner'));assert.equal(invalid.status,404);assert.equal(route.calls(),0);assert.equal(invalid.headers.get('cache-control'),'no-store, private');
 const valid=await route.GET(new Request('https://app.test/api/calendar/?code=learner&token='+'a'.repeat(64)));assert.equal(valid.status,200);assert.ok(valid.headers.get('content-type').includes('text/calendar'));assert.equal(valid.headers.get('referrer-policy'),'no-referrer');assert.ok((await valid.text()).includes('BEGIN:VCALENDAR'));
});
test('revoked links return 404, while transport failures return 503 instead of an empty successful calendar',async()=>{
 const url='https://app.test/api/calendar/?code=learner&token='+'a'.repeat(64);assert.equal((await feedRoute({ok:false}).GET(new Request(url))).status,404);const failure=await feedRoute(null,true).GET(new Request(url));assert.equal(failure.status,503);assert.equal(failure.headers.get('retry-after'),'60');assert.ok(!(await failure.text()).includes('BEGIN:VCALENDAR'));
});
