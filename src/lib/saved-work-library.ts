import type {LearnerDocument,DocumentWorkType} from './documents';
import {documentGroups,documentMeta} from './document-groups';
import {documentWorkType} from './document-feedback';
export type WorkLibraryFilter='all'|DocumentWorkType;
export const workLibraryFilters:[WorkLibraryFilter,string][]=[['all','All work'],['writing','Writing'],['worksheet','Worksheets'],['conversation','Conversations'],['recording','Recordings'],['material','Materials']];
export function savedWorkLibrary(documents:LearnerDocument[],query:string,filter:WorkLibraryFilter){
 const terms=query.toLocaleLowerCase('en-GB').trim().split(/\s+/).filter(Boolean);
 return documentGroups(documents).filter(group=>{
  if(filter!=='all'&&!group.items.some(item=>documentWorkType(item)===filter))return false;
  const text=group.items.map(item=>[item.title,documentMeta(item.context).context,item.analysis?.transcription,item.analysis?.writing?.original,item.analysis?.summary].filter(Boolean).join(' ')).join(' ').toLocaleLowerCase('en-GB');
  return terms.every(term=>text.includes(term));
 });
}
