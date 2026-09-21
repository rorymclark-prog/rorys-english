// Isolated UI check: synthetic sign-in and simulated voice, no external API calls.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 const page=await browser.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',async r=>{
  const url=new URL(r.url());
  if(url.origin!=='http://127.0.0.1:4190'){await r.abort();return;}
  if(url.pathname==='/api/service/'||url.pathname==='/api/service'){
   const b=JSON.parse(r.postData()||'{}');requests.push({action:b.action});
   const data=b.action==='login'?{ok:true,token:'synthetic-teacher-session',role:'teacher',expires:Date.now()+3600000}:{ok:true,students:[],generatedAt:'Test only'};
   await r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});return;
  }
  if(url.pathname==='/api/voice/'){
   if(r.method()==='GET'){await r.respond({status:200,contentType:'application/json',body:'{"available":true}'});return;}
   const b=JSON.parse(r.postData());requests.push({teacherTest:b.teacherTest,code:b.code,token:b.token,preview:b.preview,topic:b.topic,sdpValid:b.sdp.startsWith('v=0')});
   await r.respond({status:503,contentType:'application/json',body:'{"error":"Synthetic connection check complete."}'});return;
  }
  await r.continue();
 });
 await page.setViewport({width:1440,height:1000});
 await page.goto('http://127.0.0.1:4190/teacher/',{waitUntil:'networkidle0'});
 await page.type('input[type=password]','synthetic-password');await page.click('button[type=submit]');
 await page.waitForSelector('button::-p-text(Test AI voice)');await page.click('button::-p-text(Test AI voice)');
 await page.waitForFunction(()=>document.body.innerText.includes('Ready for a conversation'));
 assert.equal(await page.$('a[href*="__teacher__"]'),null);
 await page.click('button::-p-text(Start conversation)');
 await page.waitForFunction(()=>document.body.innerText.includes('Synthetic connection check complete.'),{timeout:20000});
 const voice=requests.find(r=>r.teacherTest);assert.deepEqual(voice,{teacherTest:true,code:'__teacher__',token:'synthetic-teacher-session',preview:false,topic:'everyday',sdpValid:true});
 assert.ok(!requests.some(r=>['submit','event','teacherAssignHomework'].includes(r.action)));
 await fs.mkdir('/tmp/rory-teacher-voice-qa',{recursive:true});
 for(const width of [1440,390]){
  await page.setViewport({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`/tmp/rory-teacher-voice-qa/teacher-${width}.png`,fullPage:true});
 }
 await page.click('button::-p-text(Back to teacher dashboard)');await page.waitForSelector('button::-p-text(Test AI voice)');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({teacherEntry:true,teacherSessionSent:true,studentWrites:0,widths:[1440,390],returnedToDashboard:true,errors}));
}finally{await browser.close();}
