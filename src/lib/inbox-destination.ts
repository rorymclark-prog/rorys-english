import type {InboxEvent} from './inbox';

// Notification ids retain the original source id, including older saved events.
export function inboxDestination(event:InboxEvent,teacher:boolean,studentCode=event.code):string {
  const record=event.kind==='speaking'&&event.id.startsWith('speaking:')?event.id.slice('speaking:'.length):'';
  const exact=/^[A-Za-z0-9_-]{16,100}$/.test(record)?record:'';
  const document=event.kind==='upload'&&/^document:[A-Za-z0-9_-]{16,100}$/.test(event.id)?event.id.slice('document:'.length):'';
  if(teacher){
    const query=new URLSearchParams({student:event.code,section:event.view});
    if(exact)query.set('record',exact);
    if(document)query.set('document',document);
    return '/teacher/?'+query.toString()+(exact?'#review-'+encodeURIComponent(exact):'');
  }
  return `/s/${encodeURIComponent(studentCode)}/${exact?'progress':encodeURIComponent(event.view)}/`+(exact?'#review-'+encodeURIComponent(exact):document?'?document='+encodeURIComponent(document):'');
}
