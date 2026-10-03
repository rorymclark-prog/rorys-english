import type {LearningRecord} from './learning';
export type TeachingFile={label:string;url:string};
export function isTeachingPack(record:LearningRecord):boolean{
 return record.visibility==='teacher'&&record.kind==='lesson'&&!!record.body.tutorPrivate?.plan?.startsWith('Teaching files:');
}
/** Only owner-restricted Drive files from a private lesson preparation record. */
export function teachingFiles(record:LearningRecord):TeachingFile[]{
 if(!isTeachingPack(record))return [];
 const plan=record.body.tutorPrivate?.plan||'';
 if(!plan.startsWith('Teaching files:'))return [];
 return plan.split('\n').slice(1).flatMap(line=>{
  const match=line.match(/^([^:]{1,80}):\s*(https:\/\/\S+)$/);
  if(!match)return [];
  try{
   const url=new URL(match[2]);
   const file=url.hostname==='drive.google.com'&&/^\/file\/d\/[A-Za-z0-9_-]+\/view$/.test(url.pathname);
   const deck=url.hostname==='docs.google.com'&&/^\/presentation\/d\/[A-Za-z0-9_-]+\/edit$/.test(url.pathname);
   const parameters=Array.from(url.searchParams.entries()).every(([key,value])=>
    (key==='usp'&&value==='drivesdk')||(key==='ouid'&&/^\d+$/.test(value))||(['rtpof','sd'].includes(key)&&value==='true'));
   return (file||deck)&&parameters&&!url.username&&!url.password&&!url.port&&!url.hash?[{label:match[1].trim(),url:match[2]}]:[];
  }catch{return [];}
 });
}
