import type {InboxEvent} from './inbox';

// Notification ids retain the original source id, including older saved events.
export function inboxDestination(event:InboxEvent,teacher:boolean,studentCode=event.code):string {
  const record=event.kind==='speaking'&&event.id.startsWith('speaking:')?event.id.slice('speaking:'.length):'';
  const exact=/^[A-Za-z0-9_-]{16,100}$/.test(record)?record:'';
  const document=event.kind==='upload'&&/^document:[A-Za-z0-9_-]{16,100}$/.test(event.id)?event.id.slice('document:'.length):'';
  const practice=event.kind==='practice'&&event.practice&&['document','submission','reply'].includes(event.practice.source)&&[event.practice.id,event.practice.attempt].every(id=>/^[A-Za-z0-9_-]{8,100}$/.test(id))?event.practice:null;
  if(teacher&&practice){
    const query=new URLSearchParams({student:event.code,section:practice.source==='document'?'documents':practice.source==='submission'?'review':'learning',attempt:practice.attempt});
    if(practice.source==='document')query.set('document',practice.id);
    if(practice.source==='submission')query.set('submission',practice.id);
    if(practice.source==='reply'&&practice.record&&/^[A-Za-z0-9_-]{8,100}$/.test(practice.record))query.set('record',practice.record);
    if(practice.summary){
      query.delete('attempt');query.set('practice',practice.source==='document'?practice.id:`${practice.source}:${practice.id}`);
      return '/teacher/?'+query.toString()+'#saved-practice';
    }
    return '/teacher/?'+query.toString()+'#practice-'+encodeURIComponent(practice.attempt);
  }
  if(teacher){
    const query=new URLSearchParams({student:event.code,section:event.view});
    if(exact)query.set('record',exact);
    if(document)query.set('document',document);
    return '/teacher/?'+query.toString()+(exact?'#review-'+encodeURIComponent(exact):'');
  }
  return `/s/${encodeURIComponent(studentCode)}/${exact?'progress':encodeURIComponent(event.view)}/`+(exact?'#review-'+encodeURIComponent(exact):document?'?document='+encodeURIComponent(document):'');
}
