import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The rewritten screens use a five-step relative type scale, so the existing
// Large/Extra large setting can enlarge them through the root font size.
// Older sheets retain an inventory ceiling rather than pretending they have
// already migrated to this scale.
const read=f=>fs.readFileSync(f,"utf8");
const SIZES=new Set([".75rem",".875rem","1rem","1.25rem","1.75rem"]);
const RADII=new Set(["0","10px","16px","999px","50%","100%"]);
const strict=["src/app/visual-refresh/today.css","src/app/year-plan.css","src/app/visual-refresh/signin.css","src/app/teacher/live-coach.css"];
const student=[...fs.readdirSync("src/app").filter(f=>f.endsWith(".css")).map(f=>`src/app/${f}`),...fs.readdirSync("src/app/visual-refresh").filter(f=>f.endsWith(".css")).map(f=>`src/app/visual-refresh/${f}`)];

test("the rewritten sheets keep five scalable type sizes and two radii",()=>{
  for(const f of strict){
    const css=read(f);
    for(const [,v] of css.matchAll(/font-size:([^;}]*)/g)){
      const size=v.replace("!important","").trim();
      assert.ok(SIZES.has(size),`${f}: font-size ${size} must use the relative type scale`);
    }
    if(f.includes("live-coach"))continue; // teacher sheet keeps Codex's radii for now
    for(const [,v] of css.matchAll(/border-radius:([^;}]*)/g))for(const part of v.trim().split(/\s+/))assert.ok(RADII.has(part),`${f}: radius ${v}`);
  }
});

test("the student font-size inventory stays within its 22 October ceiling",()=>{
  const sizes=new Set();
  for(const f of student)for(const [,v] of read(f).matchAll(/font-size:([^;}]*)/g))sizes.add(v.trim());
  assert.ok(sizes.size<=92,`${sizes.size} distinct font-size values (92 after the 22 Oct accessibility fixes)`);
});

test("raw colours outside tokens never increase per sheet",()=>{
  // Engagement includes seven fallback colour occurrences in ring next-step
  // styles already on the merged production branch; retain that legacy ceiling.
  const baseline={"src/app/calendar.css":64,"src/app/design.css":11,"src/app/documents.css":22,"src/app/engagement.css":60,"src/app/globals.css":1,"src/app/homework.css":1,"src/app/visual-refresh/homework.css":2,"src/app/visual-refresh/lessons.css":1,"src/app/visual-refresh/shared.css":1,"src/app/visual-refresh/teacher.css":20};
  for(const f of student){
    const stripped=read(f).replace(/--[\w-]+:\s*#[0-9a-fA-F]{3,8}/g,"");
    const count=(stripped.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).length;
    assert.ok(count<=(baseline[f]||0),`${f}: ${count} raw colours, baseline ${baseline[f]||0}`);
  }
});
