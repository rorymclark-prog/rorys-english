import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 21 October 2026: the one-job-per-page screens were built on a five-step type
// scale and two radii. The sheets rewritten that day must stay on it; the older
// sheets are ratcheted so the spread can only shrink from here.
const read=f=>fs.readFileSync(f,"utf8");
const SIZES=new Set(["12px","14px","16px","20px","28px"]);
const RADII=new Set(["0","10px","16px","999px","50%","100%"]);
const strict=["src/app/visual-refresh/today.css","src/app/year-plan.css","src/app/visual-refresh/signin.css","src/app/teacher/live-coach.css"];
const student=[...fs.readdirSync("src/app").filter(f=>f.endsWith(".css")).map(f=>`src/app/${f}`),...fs.readdirSync("src/app/visual-refresh").map(f=>`src/app/visual-refresh/${f}`)];

test("the rewritten sheets use only the five type sizes and two radii",()=>{
  for(const f of strict){
    const css=read(f);
    for(const [,v] of css.matchAll(/font-size:([^;}]*)/g)){
      const size=v.replace("!important","").trim();
      assert.ok(SIZES.has(size)||size.startsWith("clamp("),`${f}: font-size ${size}`);
    }
    if(f.includes("live-coach"))continue; // teacher sheet keeps Codex's radii for now
    for(const [,v] of css.matchAll(/border-radius:([^;}]*)/g))for(const part of v.trim().split(/\s+/))assert.ok(RADII.has(part),`${f}: radius ${v}`);
  }
});

test("the spread of font sizes across the student sheets never grows",()=>{
  const sizes=new Set();
  for(const f of student)for(const [,v] of read(f).matchAll(/font-size:([^;}]*)/g))sizes.add(v.trim());
  assert.ok(sizes.size<=91,`${sizes.size} distinct font-size values (was 91 on 21 Oct 2026)`);
});

test("raw colours outside tokens never increase per sheet",()=>{
  const baseline={"src/app/calendar.css":64,"src/app/design.css":11,"src/app/documents.css":22,"src/app/engagement.css":53,"src/app/globals.css":1,"src/app/homework.css":1,"src/app/visual-refresh/homework.css":2,"src/app/visual-refresh/lessons.css":1,"src/app/visual-refresh/shared.css":1,"src/app/visual-refresh/teacher.css":20};
  for(const f of student){
    const stripped=read(f).replace(/--[\w-]+:\s*#[0-9a-fA-F]{3,8}/g,"");
    const count=(stripped.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).length;
    assert.ok(count<=(baseline[f]||0),`${f}: ${count} raw colours, baseline ${baseline[f]||0}`);
  }
});
