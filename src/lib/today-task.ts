/** Presentation only: the full saved task title remains the submission title. */
export function learnerTaskTitle(title:string):string {
  // This is the known dashboard reset suffix, not a general date/topic remover.
  const short=title.replace(/\s*·\s*current homework(?:\s*·\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+reset)?\s*$/i,'').trim();
  return short||title;
}

export const assignmentTargetId=(id:string)=>`assignment-${id}`;

export function assignmentTaskHref(code:string,id:string):string {
  return `/s/${encodeURIComponent(code)}/homework/?assignment=${encodeURIComponent(id)}#${encodeURIComponent(assignmentTargetId(id))}`;
}

export function selectedAssignmentId(search:string,hash=''):string {
  const id=new URLSearchParams(search).get('assignment');
  if(id)return id;
  try {const target=decodeURIComponent(hash.replace(/^#/,''));return target.startsWith('assignment-')?target.slice('assignment-'.length):'';}
  catch {return '';}
}

/** Open only a task already rendered for this learner, including its archive. */
export function revealAssignment(id:string,root:Pick<Document,'getElementById'>):boolean {
  const target=root.getElementById(assignmentTargetId(id));
  if(!target)return false;
  let ancestor:HTMLElement|null=target;
  while(ancestor){if(ancestor.tagName==='DETAILS')(ancestor as HTMLDetailsElement).open=true;ancestor=ancestor.parentElement;}
  const focus=target.querySelector<HTMLElement>('summary')||target;
  focus.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:'auto'});
  return true;
}
