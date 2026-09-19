// Isolated sample-data acceptance checks. No real student writes.
import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const origin='http://127.0.0.1:4186';const output='/tmp/rorys-english-qa';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
const actions=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url()==='http://127.0.0.1:4174/'&&r.postData()){try{actions.push(JSON.parse(r.postData()).action);}catch{}}});
const checks=[];const click=async t=>page.locator(`::-p-text(${t})`).click();const contains=async t=>page.waitForFunction(t=>document.body.innerText.includes(t),{},t);
const go=async path=>page.goto(origin+path,{waitUntil:'networkidle0'});
try{
 await go('/s/valentin-q9m2/');await page.locator('#access').fill('demo-only');await page.click('form button');await page.waitForSelector('.re-home');
 await page.click('button[aria-label="Light mode"]');await page.reload({waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),false);
 await page.click('button[aria-label="Dark mode"]');await page.reload({waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),true);checks.push('Light/dark choice survives reload');
 await go('/s/valentin-q9m2/homework/');await click('Demo writing task');
 const answer=Date.now()+': A synthetic workflow check — not student work.\nI enjoy practising because I can explain my ideas.';
 await page.waitForSelector('textarea[aria-label="Your answer or practice notes"]:not([disabled])');await page.type('textarea[aria-label="Your answer or practice notes"]',answer,{delay:2});await page.waitForFunction(answer=>localStorage.getItem('re_draft_v2_valentin-q9m2_assigned_demo-task')?.includes(JSON.stringify(answer).slice(1,-1)),{},answer);await page.reload({waitUntil:'networkidle0'});await click('Demo writing task');
 await page.waitForFunction(answer=>document.querySelector('textarea[aria-label="Your answer or practice notes"]')?.value===answer,{},answer);assert.equal(await page.$eval('textarea[aria-label="Your answer or practice notes"]',e=>e.value),answer);checks.push('Homework draft survives reload exactly');
 const initialVersions=await page.evaluate(()=>Number(document.body.innerText.match(/(\d+) submitted version/)?.[1]||0));
 await click(initialVersions?'Submit revision':'Send answers to Rory');await contains('Received by Rory');await page.reload({waitUntil:'networkidle0'});await click('Demo writing task');await contains('Received — waiting for Rory');checks.push('Homework receives a confirmed receipt and reloads');
 await go('/teacher/');await page.locator('input[type=password]').fill('demo-only');await page.click('button[type=submit]');await page.waitForSelector('.teacher-student-card');await page.screenshot({path:`${output}/teacher-blue-dark.png`,fullPage:true});
 await page.click('.teacher-student-card');await page.waitForSelector('.teacher-review-item');
 assert.ok((await page.$eval('.teacher-answer',e=>e.textContent)).includes(answer));
 await page.locator('.teacher-review-item textarea').fill('Test feedback: add one example, then try again.');await click('Ask for a revision');await click('Revisions');await page.waitForFunction(()=>document.querySelector('.teacher-review-item textarea')?.value==='Test feedback: add one example, then try again.');checks.push('Teacher receives exact answer and saves revision feedback');
 await click('View as Valentin');await contains('Read-only preview');
 const before=actions.length;
 await go('/s/valentin-q9m2/homework/');await click('Demo writing task');assert.equal(await page.$eval('textarea[aria-label="Your answer or practice notes"]',e=>e.disabled),true);
 await go('/s/valentin-q9m2/speak/');assert.equal(await page.$eval('.re-voice-actions button',e=>e.disabled),true);
 assert.equal(actions.slice(before).filter(a=>['submit','event','ai','teacherReview'].includes(a)).length,0);checks.push('Teacher preview blocks answer edits, submissions and voice');
 await click('Exit preview');await page.waitForSelector('.teacher-student-card');
 await go('/s/valentin-q9m2/homework/');await click('Demo writing task');await contains('Your next revision');await contains('Test feedback: add one example, then try again.');checks.push('Learner sees saved feedback');
 await page.locator('textarea[aria-label="Your answer or practice notes"]').fill(answer+' For example, I explained a game to a friend.');await click('Submit revision');await contains(`${initialVersions+2} submitted versions`);checks.push('Revision retains both submitted versions');
 assert.deepEqual(errors,[]);await fs.writeFile(`${output}/workflow-results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}catch(error){await fs.writeFile(`${output}/workflow-failure.txt`,await page.evaluate(()=>document.body.innerText));console.log(JSON.stringify({checks,actions,error:error.message}));throw error;}finally{await browser.close()}
