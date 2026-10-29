"use client";
import {type DocumentExercise,type DocumentPracticeAttempt} from '@/lib/documents';
import {isStudentPreview} from '@/lib/student-preview';
import PracticeExercise from './PracticeExercise';
export default function DocumentPractice({code,documentId,version,exercises,attempts,teacher=false,parent=false,sourceType='document'}:{code:string;documentId:string;version:string;exercises:DocumentExercise[];attempts:DocumentPracticeAttempt[];teacher?:boolean;parent?:boolean;sourceType?:'document'|'submission'|'reply'}){
 const disabled=teacher||parent||isStudentPreview(code);
 return <section className="document-practice" aria-label="Practise from your writing"><h3>Practise</h3><p className="doc-muted">Try these new sentences using the patterns in your feedback. Your attempts stay with this work for Rory. An example appears after you save a try. For rewritten sentences and your own writing, compare your meaning and wording with the example; there may be other correct answers.</p>{exercises.map((exercise,index)=><PracticeExercise key={`${code}:${sourceType}:${documentId}:${version}:${exercise.id}`} {...{code,documentId,version,sourceType,disabled,teacher}} exercise={exercise} index={index} attempts={attempts}/>)}</section>;
}
