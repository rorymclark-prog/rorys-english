// Local, in-memory browser QA using the actual Calendar.gs service. Nothing
// connects to Google, real progress sheets, messaging or production accounts.
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
import ts from 'typescript';
const checks=fs.readFileSync('tests/backend.test.mjs','utf8'),source=checks.slice(checks.indexOf('function fixture()'),checks.indexOf('\ntest('));
const sandbox={fs,vm,createHash,randomUUID,Buffer,console,Date,Intl};vm.createContext(sandbox);vm.runInContext(source+'\nfixtureForQa=fixture;',sandbox);const f=sandbox.fixtureForQa();
const roster=[{code:'valentin-q9m2',parentCode:'valentin-fam-8w2d',name:'Valentin'},{code:'ferdi-7h3k',parentCode:'ferdi-fam-3p9k',name:'Ferdi'}],books=new Map();
f.ctx.getRoster_=()=>roster;f.ctx.studentByAnyCode_=code=>roster.find(s=>s.code===code||s.parentCode===code)||null;
f.ctx.studentSheet_=code=>{const st=f.ctx.studentByAnyCode_(code);if(!st)throw Error('Unknown QA student');if(!books.has(st.code)){const sheets=new Map();books.set(st.code,{getSheetByName:name=>sheets.get(name)||null,insertSheet:name=>{const data=[],sh={getDataRange:()=>({getValues:()=>data.map(r=>r.slice())}),appendRow:r=>data.push(r.slice()),getRange:(r,c)=>({setValue:v=>{data[r-1]||=[];data[r-1][c-1]=v;},setValues:values=>values.forEach((v,i)=>{data[r-1+i]||=[];v.forEach((x,j)=>data[r-1+i][c-1+j]=x);})})};sheets.set(name,sh);return sh;}});}return books.get(st.code);};
f.ctx.login_=p=>p.credential==='demo-only'?f.ctx.issueSession_(p.code,p.code==='__teacher__'?'teacher':p.code.includes('-fam-')?'parent':'student'):{ok:false,error:'Use demo-only for this isolated test.'};
f.ctx.legacyPost_=e=>{const p=JSON.parse(e.postData.contents);if(p.action==='teacherDashboard')return {ok:true,students:roster.map(s=>({...s,focusNote:'',summary:null})),generatedAt:'Synthetic local QA'};if(p.action==='note')return {ok:true,note:'Local calendar workflow check.'};if(p.action==='assignments')return {ok:true,assignments:{rows:[],headers:[]}};if(p.action==='progress')return {ok:true,name:'Local QA',homework:{rows:[]},quizzes:{rows:[]},writing:{rows:[]},schoolTests:{rows:[]},speaking:{rows:[]},mockTests:{rows:[]}};return {ok:false,error:'This local fixture supports the lesson calendar only.'};};
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/lesson-calendar.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,TextEncoder,Intl,Date});
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:4193');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.end();return;}
 if(req.method==='GET'){const url=new URL(req.url,'http://localhost'),r=f.post({action:'calendarFeed',code:url.searchParams.get('code'),token:url.searchParams.get('token')});res.setHeader('Content-Type','text/calendar');res.statusCode=r.ok?200:404;res.end(r.ok?exports.buildLessonsIcs(r.lessons):'Unavailable');return;}
 let text='';for await(const chunk of req)text+=chunk;
 res.setHeader('Content-Type','application/json');try{res.end(JSON.stringify(f.post(JSON.parse(text))));}catch{res.statusCode=400;res.end('{"ok":false}');}
}).listen(4194,'127.0.0.1',()=>console.log('Calendar QA API: in-memory records only, port 4194'));
