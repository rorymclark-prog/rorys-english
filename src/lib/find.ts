// Find: one box that knows where everything is.
//
// Pure matching over a list of entries, so it runs on the device with no
// request and nothing typed leaves the phone. Matching forgives accents, case,
// a single typing slip and German words for the same place.

export type FindEntry={label:string;href:string;group:string;hint?:string;words?:string};

const fold=(text:string)=>text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const wordsOf=(text:string)=>fold(text).split(' ').filter(Boolean);

/** True when two words differ by one inserted, missing, swapped or wrong letter. */
function oneSlip(a:string,b:string){
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;
  if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
  const [long,short]=a.length>b.length?[a,b]:[b,a];
  return long.slice(i+1)===short.slice(i);
}

// How well one typed word matches one field: 3 a whole word, 2 the start of a
// word, 1 a slip away from the start of a word, 0 nothing.
function wordScore(token:string,field:string[]){
  let best=0;
  for(const word of field){
    if(word===token)return 3;
    if(word.startsWith(token))best=Math.max(best,2);
    else if(!best&&token.length>=5&&(oneSlip(token,word)||oneSlip(token,word.slice(0,token.length))||oneSlip(token,word.slice(0,token.length+1))))best=1;
  }
  return best;
}

/** The best matches for what was typed, best first. Every typed word has to match something. */
export function findMatches(query:string,entries:readonly FindEntry[],limit=7):FindEntry[]{
  const tokens=wordsOf(query);
  if(!tokens.length)return [];
  const whole=fold(query);
  const ranked:{entry:FindEntry;score:number;order:number}[]=[];
  entries.forEach((entry,order)=>{
    const label=wordsOf(entry.label),hint=wordsOf(entry.hint||''),extra=wordsOf(entry.words||'');
    let score=0;
    for(const token of tokens){
      const inLabel=wordScore(token,label),inExtra=wordScore(token,extra),inHint=wordScore(token,hint);
      const best=Math.max(inLabel*100,inExtra*10,inHint*5);
      if(!best)return;
      score+=best;
    }
    const name=fold(entry.label);
    if(name===whole)score+=1000;else if(name.startsWith(whole))score+=500;
    ranked.push({entry,score,order});
  });
  return ranked.sort((a,b)=>b.score-a.score||a.order-b.order).slice(0,limit).map(r=>r.entry);
}

// ── What can be found ────────────────────────────────────────────────────

type FindPage={suffix:string;label:string;hint:string;words:string};
export type FindUnit={id:string;title:string;available:boolean;homework:readonly {week:number;title:string;availableFrom?:string}[]};
export type FindFile={title:string;unit:string};

// Reached from a bell or a row rather than the menu, so Find has to know them.
const OTHER_STUDENT_PAGES:readonly FindPage[]=[
  {suffix:'year-plan/',label:'Year plan',hint:'The whole school year',words:'jahresplan plan year overview units schuljahr'},
  {suffix:'notifications/',label:'Notifications',hint:'News from Rory',words:'benachrichtigungen alerts bell news updates'},
  {suffix:'settings/',label:'Settings',hint:'Appearance and text size',words:'einstellungen dark mode light theme text size font bigger larger schrift'},
];

/**
 * Everything a student can look for: every page, the homework that has been
 * released, their units and their lesson files. Homework with a future
 * `availableFrom` is left out, exactly as the Homework list leaves it out.
 */
export function studentFindEntries(code:string,sections:readonly (FindPage&{more:readonly FindPage[]})[],units:readonly FindUnit[],files:readonly FindFile[],today:string):FindEntry[]{
  const base=`/s/${code}/`;
  const page=(p:FindPage):FindEntry=>({label:p.label,href:base+p.suffix,group:'Pages',hint:p.hint,words:p.words});
  return [
    ...sections.flatMap(section=>[page(section),...section.more.map(page)]),
    ...OTHER_STUDENT_PAGES.map(page),
    ...units.flatMap(unit=>unit.homework.filter(h=>!h.availableFrom||h.availableFrom<=today).map(h=>({label:h.title,href:`${base}lessons/${unit.id}/homework/${h.week}/`,group:'Homework',hint:unit.title,words:'homework task hausaufgabe'}))),
    ...units.filter(unit=>unit.available).map(unit=>({label:unit.title,href:`${base}lessons/`,group:'Lessons',hint:'Unit',words:'unit lesson lektion'})),
    ...files.map(file=>({label:file.title,href:`${base}resources/`,group:'Lesson files',hint:file.unit,words:'file resource slides pdf datei'})),
  ];
}

/** The four tabs of one student's teacher workspace. Each opens on its first place below. */
export const TEACHER_GROUPS=[
  {id:'dashboard',label:'Dashboard',hint:'Where they are now'},
  {id:'work',label:'Work',hint:'Review, files & homework'},
  {id:'teach',label:'Teach',hint:'Materials & lesson notes'},
  {id:'results',label:'Results',hint:'Tests & checkpoints'},
] as const;
export type TeacherGroup=typeof TEACHER_GROUPS[number]['id'];

/**
 * The seven places inside one student's teacher workspace, in tab order, with
 * the tab each sits under and the words Rory might type for it. The addresses
 * (`?section=…`) are unchanged, so older links and notifications still land.
 */
export const TEACHER_FIND_SECTIONS=[
  {section:'overview',group:'dashboard',label:'Learning dashboard',hint:'Homework, activity & assessment',words:'overview summary progress rings'},
  {section:'review',group:'work',label:'Work to review',hint:'New answers & uploaded work',words:'mark marking correct submissions answers homework check'},
  {section:'documents',group:'work',label:'Documents',hint:'Scan, upload & discuss',words:'photo essay handwriting worksheet file pdf saved work writing'},
  {section:'assign',group:'work',label:'Assign homework',hint:'Set the next step',words:'set task new assignment give'},
  {section:'teaching',group:'teach',label:'Teaching materials',hint:'PowerPoints & teacher notes',words:'slides powerpoint pptx lesson plan files prepare'},
  {section:'learning',group:'teach',label:'Feedback & lesson notes',hint:'Saved reviews & practice',words:'recorded lesson transcript brief records history'},
  {section:'assess',group:'results',label:'School results',hint:'Tests & writing checkpoints',words:'grades marks noten schularbeit test exam assessment checkpoint'},
] as const;

/** The tab a place sits under, and the places that share it. */
export function teacherGroupOf(section:string){
  const place=TEACHER_FIND_SECTIONS.find(s=>s.section===section)||TEACHER_FIND_SECTIONS[0];
  return {group:place.group as TeacherGroup,places:TEACHER_FIND_SECTIONS.filter(s=>s.group===place.group)};
}

/** Everything Rory can look for: the workspace pages, each student, and each place inside each student. */
export function teacherFindEntries(students:readonly {code:string;name:string}[]):FindEntry[]{
  return [
    {label:'Students & teaching',href:'/teacher/',group:'Workspace',hint:'All students',words:'home dashboard start'},
    {label:'Calendar',href:'/teacher/?view=calendar',group:'Workspace',hint:'Lessons and bookings',words:'schedule dates times plan termine'},
    {label:'Live teaching',href:'/teacher/?view=live',group:'Workspace',hint:'Record a lesson with live prompts',words:'coach record recording lesson prompts'},
    {label:'Messages',href:'/teacher/?inbox=messages',group:'Workspace',hint:'From students and parents',words:'chat inbox nachrichten'},
    {label:'Notifications',href:'/teacher/?inbox=notifications',group:'Workspace',hint:'What happened recently',words:'alerts bell news activity'},
    ...students.flatMap(student=>TEACHER_FIND_SECTIONS.map(place=>({
      label:place.section==='overview'?student.name:`${student.name} · ${place.label}`,
      href:`/teacher/?student=${student.code}${place.section==='overview'?'':`&section=${place.section}`}`,
      group:'Student',hint:place.section==='overview'?place.label:place.hint,words:place.section==='overview'?`${place.label} ${place.words}`:place.words,
    }))),
  ];
}
