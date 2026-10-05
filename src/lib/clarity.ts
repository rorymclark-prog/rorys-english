import type {Submission} from './remote';

/** Readable dates without treating a Sheet wall-date as a UTC instant. */
export function readableDate(value:string|number|undefined):string{
  if(value==null||String(value).trim()==='')return '';
  const raw=String(value).trim();
  let date:Date,zone='UTC';
  if(/^\d{4,5}(\.\d+)?$/.test(raw))date=new Date(Date.UTC(1899,11,30)+Math.floor(Number(raw))*86400000);
  else if(/^\d{4}-\d{2}-\d{2}(?:$|[ T]\d{2}:\d{2})/.test(raw)){
    const day=raw.slice(0,10),check=new Date(day+'T12:00:00Z');
    if(Number.isNaN(check.getTime())||check.toISOString().slice(0,10)!==day)return 'Date not confirmed';
    if(/[TZ]/.test(raw)&&/Z$|[+-]\d{2}:\d{2}$/.test(raw)){date=new Date(raw);zone='Europe/Vienna';}
    else date=new Date(raw.slice(0,10)+'T12:00:00Z');
  }else return 'Date not confirmed';
  return Number.isNaN(date.getTime())?'Date not confirmed':new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:zone}).format(date);
}
export function submissionStatus(submissions:Submission[],unit:string,task:string):string{
  const latest=submissions.filter(s=>s.unit===unit&&s.task===task).sort((a,b)=>b.submitted.localeCompare(a.submitted))[0];
  if(!latest)return 'Available to practise';
  if(latest.status==='revision-needed')return 'Revision requested';
  if(latest.status==='reviewed'&&latest.feedback&&!latest.reviewPending)return 'Feedback from Rory ready';
  return 'Received by Rory · waiting for review';
}

export function isCompletedAssignment(status:string):boolean{return /^(done|complete|completed|reviewed)$/i.test(status.trim());}
