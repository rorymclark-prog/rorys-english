import type {InboxEvent} from './inbox';

// Notification ids retain the original source id, including older saved events.
export function inboxDestination(event:InboxEvent,teacher:boolean,studentCode=event.code):string {
  const record=event.kind==='speaking'&&event.id.startsWith('speaking:')?event.id.slice('speaking:'.length):'';
  const exact=/^[A-Za-z0-9_-]{16,100}$/.test(record)?record:'';
  if(teacher){
    const query=new URLSearchParams({student:event.code,section:event.view});
    if(exact)query.set('record',exact);
    return '/teacher/?'+query.toString()+(exact?'#review-'+encodeURIComponent(exact):'');
  }
  return `/s/${encodeURIComponent(studentCode)}/${exact?'progress':encodeURIComponent(event.view)}/`+(exact?'#review-'+encodeURIComponent(exact):'');
}
