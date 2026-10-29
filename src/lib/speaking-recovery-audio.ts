// Private device storage, namespaced with the authenticated draft scope. Never
// reuse the teacher archive: student captions and samples have their own lifetime.
const DATABASE='rory-speaking-recovery-v1',STORE='samples';
let opening:Promise<IDBDatabase>|undefined;
function database():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')return Promise.reject(new Error('Audio recovery is unavailable in this browser.'));
 if(!opening)opening=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:['scope','session','sequence']});
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=undefined;};resolve(db);};
  request.onerror=()=>reject(new Error('Audio recovery storage could not open.'));
  request.onblocked=()=>reject(new Error('Close another app tab to open audio recovery.'));
 }).catch(error=>{opening=undefined;throw error;});
 return opening;
}
function completed(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error('The audio sample could not be kept on this device.'));tx.onerror=()=>{};});}
function scopeRange(scope:string,session:string){if(!scope||scope.length>256||!/^[A-Za-z0-9_-]{16,100}$/.test(session))throw new Error('Missing private audio scope.');return IDBKeyRange.bound([scope,session,0],[scope,session,Number.MAX_SAFE_INTEGER]);}
export async function keepSpeakingChunk(scope:string,session:string,sequence:number,blob:Blob){
 scopeRange(scope,session);if(!Number.isSafeInteger(sequence)||sequence<0||sequence>360||!blob.size)throw new Error('Invalid audio recovery chunk.');
 const db=await database(),tx=db.transaction(STORE,'readwrite'),done=completed(tx);
 tx.objectStore(STORE).put({scope,session,sequence,blob});await done;
}
export async function readSpeakingAudio(scope:string,session:string):Promise<Blob|null>{
 const db=await database(),tx=db.transaction(STORE,'readonly'),done=completed(tx),request=tx.objectStore(STORE).getAll(scopeRange(scope,session));await done;
 return joinSpeakingChunks(request.result as {sequence:number;blob:Blob}[]);
}
export function joinSpeakingChunks(chunks:{sequence:number;blob:Blob}[]):Blob|null{
 if(!chunks.length)return null;
 if(chunks.length>361)throw new Error('The saved audio sample has too many chunks.');
 const sorted=chunks.slice().sort((a,b)=>a.sequence-b.sequence),type=sorted.find(chunk=>chunk.blob instanceof Blob&&chunk.blob.type)?.blob.type.split(';')[0]||'';
 if(!['audio/webm','audio/mp4','audio/ogg'].includes(type)||sorted.some((chunk,index)=>chunk.sequence!==index||!(chunk.blob instanceof Blob)||!chunk.blob.size||!!chunk.blob.type&&chunk.blob.type.split(';')[0]!==type)||sorted.reduce((total,chunk)=>total+chunk.blob.size,0)>2621440)throw new Error('The saved audio sample is incomplete or has unsupported metadata.');
 return new Blob(sorted.map(chunk=>chunk.blob),{type});
}
export async function discardSpeakingAudio(scope:string,session:string){
 if(!scope||!session)return;const db=await database(),tx=db.transaction(STORE,'readwrite'),done=completed(tx);tx.objectStore(STORE).delete(scopeRange(scope,session));await done;
}
// A failed write remains a failure. Normal finalisation waits for all commits;
// a hard close can recover only chunks which reached IndexedDB before exit.
export function speakingChunkWriter(write:(sequence:number,blob:Blob)=>Promise<void>){let index=0,tail=Promise.resolve();return {append(blob:Blob){const sequence=index++;tail=tail.then(()=>write(sequence,blob));return tail;},flush:()=>tail};}
