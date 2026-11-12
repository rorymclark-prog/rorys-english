// "Needs you today": the short list at the top of the teacher home.
//
// Pure and import-free. It reads the same events the Notifications page shows
// and the same per-student summary the student cards use, and turns them into
// one line per thing that is waiting, most pressing first. It never invents a
// task: every line counts events that exist, and a failed check is reported as
// a failed check by the caller, never as "all clear".

export type NeedEvent={code:string;name?:string;at:string;kind:string;view?:string;read:boolean;needsCheck?:boolean};
export type NeedStudent={code:string;name:string;daysSinceActivity?:number|null};
export type Need={id:string;code:string;name:string;kind:'message'|'check'|'work'|'quiet';title:string;detail:string;href:string;at:string};

/** Days without saved activity before a student is listed as quiet. */
export const QUIET_DAYS=7;

const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;
const workWords:Record<string,[string,string]>={homework:['homework answer','homework answers'],upload:['upload','uploads'],speaking:['conversation','conversations'],answer:['practice answer','practice answers']};
const sectionFor=(view:string|undefined)=>view==='documents'||view==='learning'||view==='review'?view:'review';
const newest=(events:readonly NeedEvent[])=>events.reduce((latest,e)=>e.at>latest.at?e:latest,events[0]);

/**
 * What is waiting, most pressing first: a student who wrote to you, then
 * drafted feedback that needs your check, then new work nobody has opened, then
 * a student who has gone quiet. Within a kind, the oldest wait comes first.
 */
export function needsYou(events:readonly NeedEvent[],students:readonly NeedStudent[],limit=6):Need[]{
  const needs:Need[]=[];
  for(const student of students){
    const mine=events.filter(e=>e.code===student.code),name=student.name;
    const student_=encodeURIComponent(student.code);
    const messages=mine.filter(e=>e.kind==='message'&&!e.read);
    if(messages.length)needs.push({id:`message:${student.code}`,code:student.code,name,kind:'message',title:`${name} wrote to you`,detail:plural(messages.length,'unread message'),href:`/teacher/?inbox=messages&student=${student_}`,at:newest(messages).at});
    const checks=mine.filter(e=>e.needsCheck);
    if(checks.length)needs.push({id:`check:${student.code}`,code:student.code,name,kind:'check',title:`Check ${name}’s feedback`,detail:`${plural(checks.length,'drafted feedback','drafted feedbacks')} waiting for your check`,href:`/teacher/?student=${student_}&section=${sectionFor(newest(checks).view)}`,at:newest(checks).at});
    const work=mine.filter(e=>e.kind!=='message'&&!e.read&&!e.needsCheck);
    if(work.length){
      const counts=Object.keys(workWords).map(kind=>[kind,work.filter(e=>e.kind===kind).length] as const).filter(([,n])=>n>0);
      const other=work.length-counts.reduce((sum,[,n])=>sum+n,0);
      const detail=[...counts.map(([kind,n])=>plural(n,...workWords[kind])),...(other?[plural(other,'other item')]:[])].join(' · ');
      needs.push({id:`work:${student.code}`,code:student.code,name,kind:'work',title:`New work from ${name}`,detail,href:`/teacher/?student=${student_}&section=${sectionFor(newest(work).view)}`,at:newest(work).at});
    }
    const quiet=student.daysSinceActivity;
    if(typeof quiet==='number'&&quiet>=QUIET_DAYS&&!mine.some(e=>!e.read))needs.push({id:`quiet:${student.code}`,code:student.code,name,kind:'quiet',title:`${name} has gone quiet`,detail:`No saved activity for ${quiet} days`,href:`/teacher/?inbox=messages&student=${student_}`,at:''});
  }
  const rank={message:0,check:1,work:2,quiet:3};
  return needs.sort((a,b)=>rank[a.kind]-rank[b.kind]||a.at.localeCompare(b.at)||a.name.localeCompare(b.name)).slice(0,limit);
}
