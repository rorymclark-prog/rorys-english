// Run against the isolated preview API + dev app; never against production.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:4186';
const output=process.env.QA_OUTPUT || '/tmp/rorys-english-qa';
await fs.mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const result=[];
async function go(path){await page.goto(origin+path,{waitUntil:'networkidle0'});await page.waitForSelector('main');}
async function clickText(text){await page.locator(`::-p-text(${text})`).click();}
try{
  await page.setViewport({width:1440,height:1000});
  await go('/s/valentin-q9m2/');
  await page.locator('#access').fill('demo-only');await page.click('form button');
  await page.waitForSelector('.re-home');await page.waitForFunction(()=>document.body.innerText.includes('Demo writing task'));
  const routes=['','homework/','speak/','study/','resources/','progress/','settings/'];
  for(const [device,width,height] of [['laptop',1440,1000],['ipad',820,1180],['phone',390,844]]){
    await page.setViewport({width,height});
    for(const route of routes){
      await go('/s/valentin-q9m2/'+route);
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('h1')?.textContent,overflow:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2}).slice(0,8).map(e=>e.tagName+'.'+e.className)}));
      result.push({device,route:route||'today',...layout});
      assert.ok(layout.scroll<=width+2,`${device} ${route}: horizontal overflow ${layout.scroll}`);
      assert.ok(layout.title,`Missing heading ${route}`);
      if(!route||route==='speak/'){
        await page.click('button[aria-label="Light mode"]');await page.screenshot({path:`${output}/${device}-${route?'speak':'today'}-light.png`,fullPage:true});
        await page.click('button[aria-label="Dark mode"]');await page.screenshot({path:`${output}/${device}-${route?'speak':'today'}-dark.png`,fullPage:true});
      }
    }
  }
  await page.setViewport({width:1440,height:1000});await go('/s/valentin-q9m2/speak/');
  assert.equal(await page.$eval('.re-voice-actions button',b=>b.disabled),true);
  await clickText('Record a rehearsal');await page.waitForFunction(()=>document.body.innerText.includes('Stop recording'));
  await new Promise(r=>setTimeout(r,1100));await clickText('Stop recording');await page.waitForSelector('audio[aria-label="Your rehearsal recording"]');
  const audio=await page.$eval('audio[aria-label="Your rehearsal recording"]',e=>({src:e.src}));assert.ok(audio.src.startsWith('blob:'));
  result.push({check:'rehearsal records and provides local playback',passed:true});
  await go('/s/valentin-q9m2/homework/');
  await fs.writeFile(`${output}/homework-dom.txt`,await page.evaluate(()=>document.body.innerText));
  await go('/teacher/');
  await fs.writeFile(`${output}/teacher-dom.txt`,await page.evaluate(()=>document.body.innerText));
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${output}/results.json`,JSON.stringify({checks:result,errors},null,2));
  console.log(JSON.stringify({passed:result.length,errors,output}));
}finally{await browser.close()}
