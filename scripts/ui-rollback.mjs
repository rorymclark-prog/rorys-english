import {execFileSync} from "node:child_process";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";

const root=execFileSync("git",["rev-parse","--show-toplevel"],{encoding:"utf8"}).trim();
const patchDir=join(root,"ops","ui-rollbacks");
const styleManifest=join(root,"src","app","visual-refresh.css");
const descriptions={
  entry:"Private app entry page",
  signin:"Student sign-in screen",
  navigation:"Sidebar, phone tabs and menu",
  today:"Student Today dashboard",
  momentum:"Seven-day strip and streak",
  "unit-cover":"Slide-deck picture on unit cards",
  homework:"Homework list and task detail",
  lessons:"Current lessons and archive",
  practice:"Study tools page",
  resources:"Lesson resources page",
  "writing-help":"Writing and word helper",
  speaking:"Speaking screen visuals",
  feedback:"Progress and Rory's reviews",
  "test-prep":"Test preparation page",
  documents:"Documents page navigation",
  teacher:"Teacher dashboard and student sections",
  settings:"Settings page headings",
  header:"Shared page heading layout",
};
const features=Object.keys(descriptions);
const styledFeatures=features.filter(name=>name!=="settings");
const [command,...args]=process.argv.slice(2);

function git(params){return execFileSync("git",params,{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"]});}
function patch(name){return resolve(patchDir,`${name}.patch`);}
function activeStyle(name){return `@import "./visual-refresh/${name}.css";`;}
function disabledStyle(name){return `/* rolled back: ${name} */`;}
function styleState(name){
  if(!styledFeatures.includes(name))return "none";
  const css=readFileSync(styleManifest,"utf8");
  if(css.includes(activeStyle(name)))return "active";
  if(css.includes(disabledStyle(name)))return "disabled";
  return "unknown";
}
function toggleStyle(name,disable){
  if(!styledFeatures.includes(name))return;
  const css=readFileSync(styleManifest,"utf8");
  const from=disable?activeStyle(name):disabledStyle(name);
  const to=disable?disabledStyle(name):activeStyle(name);
  if(!css.includes(from))throw new Error(`${name}: stylesheet switch is missing`);
  writeFileSync(styleManifest,css.replace(from,to));
}
function canApply(name,reverse=false){
  try{git(["apply",...(reverse?["--reverse"]:[]),"--check","--binary",patch(name)]);return true;}
  catch{return false;}
}
function status(name){
  if(canApply(name)&&["active","none"].includes(styleState(name)))return "ready to roll back";
  if(canApply(name,true)&&["disabled","none"].includes(styleState(name)))return "rolled back";
  return "changed since release — review required";
}

if(!existsSync(patchDir)||!existsSync(styleManifest)||features.some(name=>!existsSync(patch(name)))){
  console.error("Visual rollback patches are missing. Use the maintained repository checkout.");
  process.exit(1);
}
if(command==="list"){
  for(const name of features)console.log(`${name.padEnd(14)} ${descriptions[name]} · ${status(name)}`);
  process.exit(0);
}
if(!["check","rollback","restore"].includes(command)||args.length===0||args.some(name=>!features.includes(name))){
  console.error("Usage: node scripts/ui-rollback.mjs <list|check|rollback|restore> <feature...>");
  console.error(`Features: ${features.join(", ")}`);
  process.exit(2);
}
if(new Set(args).size!==args.length){console.error("List each feature only once.");process.exit(2);}
const reverse=command==="restore";
if(command!=="check"&&git(["status","--porcelain"]).trim()){
  console.error("Commit or discard current changes before changing a visual feature.");
  process.exit(1);
}
for(const name of args){
  if(!canApply(name,reverse)||styleState(name)!==(reverse?(styledFeatures.includes(name)?"disabled":"none"):(styledFeatures.includes(name)?"active":"none"))){
    console.error(`${name}: ${status(name)}. No files were changed.`);
    process.exit(1);
  }
}
if(command==="check"){
  for(const name of args)console.log(`${name}: ${reverse?"restore":"rollback"} patch applies cleanly`);
  process.exit(0);
}

const applied=[];
try{
  for(const name of args){
    git(["apply",...(reverse?["--reverse"]:[]),"--binary",patch(name)]);
    const change={name,styleToggled:false};
    applied.push(change);
    toggleStyle(name,!reverse);
    change.styleToggled=true;
    console.log(`${name}: ${reverse?"restored":"rolled back"} in this checkout`);
  }
}catch(error){
  for(const {name,styleToggled} of applied.reverse()){
    if(styleToggled)toggleStyle(name,reverse);
    git(["apply",...(!reverse?["--reverse"]:[]),"--binary",patch(name)]);
  }
  console.error("The change did not apply cleanly. Earlier changes from this command were undone.");
  console.error(String(error));
  process.exit(1);
}
console.log("Review the diff, run tests and build, then commit and deploy to publish this selection.");
