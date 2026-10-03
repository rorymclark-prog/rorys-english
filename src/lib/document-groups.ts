import type {LearnerDocument} from './documents';
export type DocumentRole='answer'|'review'|'task';
export function documentMeta(context:string){
  const role=context.match(/^\[Document role: (answer|review|task)\]$/m)?.[1] as DocumentRole|undefined;
  const reviewId=context.match(/^\[Learning review: ([A-Za-z0-9_-]{16,100})\]$/m)?.[1]||'';
  return {role:role||'answer',reviewId,context:context.replace(/^\[(?:Document role: (?:answer|review|task)|Learning review: [A-Za-z0-9_-]{16,100})\]\n?/gm,'')};
}
export function documentContext(context:string,role:DocumentRole,reviewId=''){
  const clean=documentMeta(context).context;
  return `[Document role: ${role}]\n${reviewId?`[Learning review: ${reviewId}]\n`:''}${clean}`.slice(0,2000);
}
// Only explicit links establish a work group. A date or similar title never does.
export function documentGroups(documents:LearnerDocument[]){
  const byId=new Map(documents.map(d=>[d.id,d]));
  const root=(d:LearnerDocument)=>{
    const seen=new Set<string>(),path:LearnerDocument[]=[];
    while(d.parentId&&byId.has(d.parentId)){
      if(seen.has(d.id))return path.sort((a,b)=>a.id.localeCompare(b.id))[0];
      seen.add(d.id);path.push(d);d=byId.get(d.parentId)!;
    }return d;
  };
  const groups=new Map<string,{root:LearnerDocument;items:LearnerDocument[]}>();
  for(const d of documents){const r=root(d);if(!groups.has(r.id))groups.set(r.id,{root:r,items:[]});groups.get(r.id)!.items.push(d);}
  return [...groups.values()].map(g=>({...g,items:g.items.sort((a,b)=>a.created.localeCompare(b.created))})).sort((a,b)=>Math.max(...b.items.map(d=>Date.parse(d.created)||0))-Math.max(...a.items.map(d=>Date.parse(d.created)||0)));
}
