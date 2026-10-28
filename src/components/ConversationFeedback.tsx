"use client";
import {useEffect,useState} from 'react';
import type {LearningRecord,LearningResult} from '@/lib/learning';
import {documentRequest} from '@/lib/documents';
import {isStudentPreview} from '@/lib/student-preview';
import PlainFeedback from './PlainFeedback';
import FeedbackText from './FeedbackText';
import ConversationTranscript from './ConversationTranscript';
export default function ConversationFeedback({record,code,teacher=false,parent=false,showTranscript=true,onSaved}:{record:LearningRecord;code?:string;teacher?:boolean;parent?:boolean;showTranscript?:boolean;onSaved?:()=>Promise<void>}){
 const [current,setCurrent]=useState(record),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>setCurrent(record),[record]);const b=current.body,disabled=!code||parent||isStudentPreview(code);
 async function prepare(refine=false){if(disabled||busy||!code)return;setBusy(true);setError('');try{const r=await documentRequest(code,teacher,{action:refine?'teacherRefineConversationFeedback':'speakingAnalyse',id:record.id}) as LearningResult;if(r.ok&&r.record){setCurrent(r.record);await onSaved?.();}else setError(r.error||'The conversation is saved. Feedback could not finish.');}finally{setBusy(false);}}
 return <section className="doc-conversation-feedback" aria-label="Conversation feedback"><h3>Conversation feedback</h3><p className="doc-muted">Based on your saved conversation captions. This feedback covers your ideas and language; captions can contain mistakes.</p>{b.aiAnalysis?(b.plainAiFeedback?<PlainFeedback review={b.plainAiFeedback}/>:<p className="doc-preserve"><FeedbackText text={b.aiAnalysis}/></p>):<p className="doc-reading-note">Your conversation is saved. Feedback has not been prepared yet.</p>}{error&&<p className="doc-error" role="alert">{error}</p>}{!b.aiAnalysis&&!disabled&&<button className="doc-secondary" disabled={busy} onClick={()=>void prepare()}>{busy?'Preparing…':'Prepare conversation feedback'}</button>}{teacher&&!disabled&&<button className="doc-link" disabled={busy} onClick={()=>void prepare(true)}>{busy?'Checking the saved evidence…':'Update conversation feedback from the saved evidence'}</button>}{teacher&&code&&b.audioDocumentId&&<p><a className="doc-link" href={`/teacher/?student=${encodeURIComponent(code)}&section=documents&document=${encodeURIComponent(b.audioDocumentId)}`}>Open recording & private check</a></p>}{showTranscript&&b.transcript&&<details className="doc-transcript"><summary>Read your conversation</summary><ConversationTranscript text={b.transcript}/></details>}</section>;
}
