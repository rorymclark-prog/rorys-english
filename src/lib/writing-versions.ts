import {sentenceReview,type WritingSource} from './writing-review';
export function writingVersions(w:WritingSource){
 const original=w.original||'',rows=sentenceReview(w).rows;
 function build(improved:boolean){let cursor=0,text='';for(const r of rows){const at=original.indexOf(r.original,cursor);if(at<0)continue;text+=original.slice(cursor,at)+(improved?r.improved||r.corrected||r.original:r.corrected||r.original);cursor=at+r.original.length;}return text+original.slice(cursor);}
 return {original,corrected:w.corrected||build(false),model:w.model||build(true),generatedModel:!!w.model};
}
export type ChangeToken={kind:'same'|'remove'|'add';text:string};
export function writingDiff(before:string,after:string):ChangeToken[]{
 const token=(s:string)=>s.match(/\s+|[\p{L}\p{N}’'-]+|[^\s\p{L}\p{N}]/gu)||[],a=token(before),b=token(after);
 if(a.length*b.length>2500000)return [{kind:'remove',text:before},{kind:'add',text:after}];
 const d=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)d[i][j]=a[i]===b[j]?d[i+1][j+1]+1:Math.max(d[i+1][j],d[i][j+1]);
 const result:ChangeToken[]=[];const add=(kind:ChangeToken['kind'],text:string)=>{const last=result.at(-1);if(last?.kind===kind)last.text+=text;else result.push({kind,text});};
 let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){add('same',a[i++]);j++;}else if(i<a.length&&(j===b.length||d[i+1][j]>=d[i][j+1]))add('remove',a[i++]);else add('add',b[j++]);}return result;
}
