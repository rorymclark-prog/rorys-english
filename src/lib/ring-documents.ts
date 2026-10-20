import type {LearnerDocument} from './documents';
// The document index intentionally omits analyses. Read only exact, ready answer
// records through the existing authenticated endpoint; never fetch file bytes or
// start OCR. Keep concurrency small and fail visibly instead of inventing zero.
export async function ringDocuments(documents:LearnerDocument[],read:(id:string)=>Promise<{ok:boolean;document?:LearnerDocument}>){
 const result=[...documents],pending=documents.map((document,index)=>({document,index})).filter(({document:d})=>d.status==='ready'&&d.analysis===undefined&&d.files.some(f=>!f.type.startsWith('audio/'))&&!/^\[Document role: (task|review)\]$/m.test(d.context));
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,pending.length)},async()=>{while(cursor<pending.length){const {document,index}=pending[cursor++],value=await read(document.id);if(!value.ok||!value.document||value.document.id!==document.id)throw Error('Earlier writing could not be checked. Try again to load its saved reading.');result[index]=value.document;}}));
 return result;
}
