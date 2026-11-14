import type {Assignment} from './remote';
/** Extract only an explicitly numbered task section; never infer a book/unit. */
export function homeworkSection(details:string,kind:'writing'|'vocabulary'|'speaking'){
 const headings=[...details.matchAll(/(?:^|\n)\s*\d+\.\s*([^\n]+)\n/g)];
 const target=headings.findIndex(h=>new RegExp(kind==='speaking'?'^(?:speaking|AI speaking)':'^'+kind,'i').test(h[1]));
 if(target<0)return '';
 const heading=headings[target],start=heading.index!+heading[0].length,end=headings[target+1]?.index??details.length;
 return details.slice(start,end).split(/\n\s*(?:WRITING AND SUBMITTING HOMEWORK|EXTRA AI[ -]SUPPORTED WRITING)/i)[0].trim();
}
export function activeHomework(assignments:Assignment[],requested=''){
 const active=assignments.filter(a=>! /^(archived|superseded|cancelled|withdrawn|done|complete|completed|reviewed)$/i.test(a.status.trim()));
 return active.find(a=>a.id===requested)||active[0]||null;
}
export function weeklyTimeEstimate(p:{paused:boolean;minutes:number;target:number;writing:number;writingTarget:number;vocabulary:number;vocabularyTarget:number},writingMinutes=20){
 if(p.paused)return null;
 const speaking=Math.max(0,p.target-p.minutes),writing=p.writing<p.writingTarget?writingMinutes:0,vocabulary=Math.max(0,p.vocabularyTarget-p.vocabulary)*2.5;
 return Math.ceil((speaking+writing+vocabulary)/5)*5;
}
