import type {AnswerReview,LearnerDocument,DocumentAnalysis,DocumentWorkType} from './documents';
import {documentMeta} from './document-groups';
import {readWorkContext} from './work-source';

export function documentWorkType(d:LearnerDocument):DocumentWorkType{
  if(d.files.some(f=>f.type.startsWith('audio/')))return /^AI conversation audio\b/i.test(d.title)?'conversation':'recording';
  if(d.workType)return d.workType;
  if(documentMeta(d.context).role!=='answer')return 'material';
  if(d.analysis?.workType)return d.analysis.workType;
  if(d.analysis?.answerReview?.length||d.analysis?.exerciseAnswers?.length||/worksheet|word[ -]formation|gap[ -]?fill|matching exercise/i.test(d.title))return 'worksheet';
  return 'writing';
}
export function documentTypeLabel(d:LearnerDocument):string{
  const type=documentWorkType(d);
  return type==='conversation'?'AI conversation':type==='recording'?'Recording':type==='material'?'Task material':type==='worksheet'?(readWorkContext(documentMeta(d.context).context).source==='school'?'School worksheet':'Worksheet'):'Written exercise';
}
export function documentStatusLabel(d:LearnerDocument):string{
  if(d.processing)return 'Preparing feedback';
  if(d.status==='error')return 'Saved · feedback needs a retry';
  if(documentWorkType(d)==='material')return 'Saved · task material';
  if(d.hasConversationFeedback||d.analysis||d.status==='ready'||d.feedback&&!d.reviewPending)return 'Done · feedback ready';
  if(d.files.some(f=>f.type.startsWith('audio/')))return 'Done · recording saved';
  return 'Saved · ready for feedback';
}
export function documentAnswerReview(a:DocumentAnalysis):AnswerReview[]{
  return a.answerReview?.length?a.answerReview:(a.exerciseAnswers||[]).map(x=>({label:String(x.number),prompt:x.base,response:x.response,status:x.status==='uncertain'?'uncertain':'correct',correction:'',note:x.note}));
}
// Earlier generated notes sometimes contain the retired workflow sentence.
// Remove that display sentence only; preserve the saved analysis and original.
export function documentFeedbackText(text:string):string{
  return text.replace(/(?:This (?:remains|is) )?AI practice feedback awaiting Rory[’']s review\.?/gi,'').replace(/Rory has not reviewed (?:this|these suggestions)\.?/gi,'').trim();
}
