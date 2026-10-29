export type SpeakingFragment={speaker:'You'|'AI partner';delta:string;start_ms:number;end_ms:number};
export type SpeakingPayload={title:string;transcript:string;reflection:string};
export type SpeakingRecovery={
 schema:1;id:string;title:string;topic:number;fragments:SpeakingFragment[];reflection:string;
 elapsed:number;startedAt:string;conversationSaved:boolean;feedbackAttempted:boolean;feedbackReady:boolean;
 audioDocumentId:string;audioExpected:boolean;audioSaved?:boolean;savePayload?:SpeakingPayload;
};
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(value);
const validPayload=(value:unknown):value is SpeakingPayload=>!!value&&typeof value==='object'&&typeof (value as SpeakingPayload).title==='string'&&(value as SpeakingPayload).title.length<=150&&typeof (value as SpeakingPayload).transcript==='string'&&(value as SpeakingPayload).transcript.length<=24000&&!!(value as SpeakingPayload).transcript.trim()&&typeof (value as SpeakingPayload).reflection==='string'&&(value as SpeakingPayload).reflection.length<=3000;
export function readSpeakingRecovery(value:unknown):SpeakingRecovery|null{
 if(!value||typeof value!=='object')return null;
 const r=value as Partial<SpeakingRecovery>;
 if(r.schema!==1||!validId(r.id)||typeof r.title!=='string'||r.title.length>150||!Array.isArray(r.fragments)||r.fragments.length>3000||typeof r.startedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(r.startedAt)||!Number.isFinite(Date.parse(r.startedAt)))return null;
 // Reject a malformed copy instead of silently removing or rewriting its evidence.
 if(r.fragments.some(f=>!f||!['You','AI partner'].includes(f.speaker)||typeof f.delta!=='string'||f.delta.length>24000||!Number.isFinite(f.start_ms)||!Number.isFinite(f.end_ms)||f.start_ms<0||f.end_ms<0))return null;
 if(r.savePayload!==undefined&&!validPayload(r.savePayload)||r.audioDocumentId!==undefined&&r.audioDocumentId!==''&&!validId(r.audioDocumentId)||r.reflection!==undefined&&(typeof r.reflection!=='string'||r.reflection.length>3000))return null;
 return {schema:1,id:r.id,title:r.title,topic:Number.isInteger(r.topic)&&r.topic!>=0&&r.topic!<7?r.topic!:0,fragments:r.fragments.map(f=>({...f})),reflection:r.reflection||'',elapsed:Number.isFinite(r.elapsed)?Math.max(0,Math.min(3600,r.elapsed!)):0,startedAt:r.startedAt,conversationSaved:r.conversationSaved===true,feedbackAttempted:r.feedbackAttempted===true,feedbackReady:r.feedbackReady===true,audioDocumentId:r.audioDocumentId||'',audioExpected:r.audioExpected===true,audioSaved:r.audioSaved===true,...(r.savePayload?{savePayload:{...r.savePayload}}:{})};
}
export function recoverableSpeech(value:SpeakingRecovery|null):value is SpeakingRecovery{return !!value&&(!!value.savePayload?.transcript.trim()||value.fragments.some(f=>f.speaker==='You'&&f.delta.trim()));}
export function freezeSpeakingPayload(value:SpeakingRecovery,transcript:string,reflection:string,createId:()=>string):SpeakingRecovery{
 return {...value,savePayload:value.savePayload||{title:value.title.slice(0,150),transcript:transcript.slice(0,24000),reflection:reflection.slice(0,3000)},audioDocumentId:value.audioDocumentId||createId()};
}
type SavedRecord={id?:string;title?:string;body?:{transcript?:string;reflection?:string;aiAnalysis?:string|null;audioDocumentId?:string}};
type SpeakingReceipt={ok:boolean;received?:boolean;record?:SavedRecord};
export function speakingReceiptMatches(result:SpeakingReceipt,value:SpeakingRecovery){const p=value.savePayload;return !!p&&result.ok&&result.received===true&&result.record?.id===value.id&&result.record.title===p.title&&result.record.body?.transcript===p.transcript&&(result.record.body.reflection||'')===p.reflection;}
export type SpeakingSaveOutcome={kind:'saved'|'retry'|'audio-missing'|'stale';message:string;value:SpeakingRecovery};
/** Existing requests, sequenced against one frozen source. Recovery never starts a paid analysis. */
export async function persistSpeakingRecovery(options:{
 value:SpeakingRecovery;recovered:boolean;sample:Promise<Blob|null>|null;maxAudioBytes:number;
 current:()=>boolean;checkpoint:(value:SpeakingRecovery)=>boolean;onStatus:(message:string)=>void;
 save:(value:SpeakingRecovery)=>Promise<SpeakingReceipt>;analyse:(id:string)=>Promise<SpeakingReceipt>;
 upload:(value:SpeakingRecovery,sample:Blob)=>Promise<{ok:boolean;received?:boolean;document?:{id?:string;files?:{type:string;size:number}[]}}>;
 attach:(id:string,documentId:string)=>Promise<SpeakingReceipt>;
}):Promise<SpeakingSaveOutcome>{
 let value=options.value,audioSaved=options.value.audioSaved===true;
 const result=(kind:SpeakingSaveOutcome['kind'],message:string)=>({kind,message,value});
 const checkpoint=(patch:Partial<SpeakingRecovery>)=>{if(!options.current())return false;value={...value,...patch};return options.checkpoint(value);};
 if(!options.current())return result('stale','');
 if(!value.savePayload||!checkpoint({}))return result('retry','Could not keep the exact retry copy on this device. Download your conversation before leaving, then try again.');
 options.onStatus('Saving your conversation…');
 if(!value.conversationSaved){
  const receipt=await options.save(value);if(!options.current())return result('stale','');
  if(!speakingReceiptMatches(receipt,value))return result('retry',receipt.ok?'Could not match the saved receipt to this exact conversation. Your device copy is kept; download it and ask Rory for help.':'Could not confirm the save. Your exact device copy is kept; choose Retry save when connected.');
  if(!checkpoint({conversationSaved:true}))return result('retry','Your conversation was received. Could not update its device recovery copy; download your work and retry when device storage is available.');
 }
 if(!options.recovered&&!value.feedbackAttempted){
  // This marker must reach durable storage before any paid request is sent.
  if(checkpoint({feedbackAttempted:true})){
   options.onStatus('Conversation saved. Preparing Conversation feedback…');
   const analysis=await options.analyse(value.id);if(!options.current())return result('stale','');
   checkpoint({feedbackReady:analysis.ok&&analysis.record?.id===value.id&&!!analysis.record.body?.aiAnalysis});
  }
 }
 const sample=await options.sample;if(!options.current())return result('stale','');
 if(!audioSaved&&sample&&sample.size>0&&sample.size<=options.maxAudioBytes&&['audio/webm','audio/mp4','audio/ogg'].includes(sample.type.split(';')[0])){
  options.onStatus('Conversation saved. Saving its short audio sample…');
  const uploaded=await options.upload(value,sample);if(!options.current())return result('stale','');
  if(!uploaded.ok||!uploaded.received||uploaded.document?.id!==value.audioDocumentId||uploaded.document.files?.length!==1||uploaded.document.files[0].size!==sample.size||uploaded.document.files[0].type!==sample.type.split(';')[0])return result('retry','Could not confirm this exact audio sample. The conversation is saved; download the sound or choose Retry save.');
  const attached=await options.attach(value.id,value.audioDocumentId);if(!options.current())return result('stale','');
  if(!attached.ok||attached.record?.id!==value.id||attached.record.body?.audioDocumentId!==value.audioDocumentId)return result('retry','Could not confirm the audio attachment. The conversation is saved; download the sound or choose Retry save.');
  audioSaved=true;if(!checkpoint({audioSaved:true}))return result('retry','Your conversation and audio were received. Could not update the device recovery copy; keep it until device storage is available.');
 }else if(!audioSaved&&value.audioExpected)return result('audio-missing','Could not recover the full audio sample. The conversation is saved. Download any available sound, then discard the device copy when finished.');
 const saved=audioSaved?'Conversation and short audio sample saved.':'Conversation saved. No audio sample was available from this browser.';
 return result('saved',`${saved} ${value.feedbackReady?'Conversation feedback is ready for you, Rory and your parents.':options.recovered?'Open Feedback to check or prepare Conversation feedback.':'Conversation feedback is unavailable; Rory can review it.'}`);
}
