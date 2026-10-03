import {documentGroups,documentMeta} from './document-groups';
import type {LearnerDocument} from './documents';

// Show the same private originals wherever learners look for completed work.
// Explicit review links suppress duplicates in the learning record only.
export function savedWritingGroups(documents:LearnerDocument[],reviewIds:string[]=[]){
  const reviews=new Set(reviewIds);
  return documentGroups(documents).filter(group=>
    group.items.some(d=>documentMeta(d.context).role==='answer'&&d.files.some(f=>!f.type.startsWith('audio/')))&&
    !group.items.some(d=>reviews.has(documentMeta(d.context).reviewId)));
}
export function savedWorkDate(document:LearnerDocument){
  const date=documentMeta(document.context).workDate;
  const parsed=new Date(`${date}T12:00:00Z`);
  return date&&!Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===date?date:document.created;
}
