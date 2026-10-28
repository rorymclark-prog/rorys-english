import type {AnswerReview} from '@/lib/documents';
import FeedbackText from './FeedbackText';
const labels={correct:'Correct · keep it','needs-change':'Try this change',uncertain:'Reading needs confirmation','not-answered':'No answer yet'};
export default function WorksheetReview({answers}:{answers:AnswerReview[]}){
  return <section className="doc-worksheet-answers"><h3>Your worksheet answers</h3><p className="doc-muted">Each answer is checked against the task. Unclear readings stay unmarked. This is practice feedback.</p><div className="doc-answer-list">{answers.map((a,i)=><article key={`${a.label}-${i}`} className={`doc-answer-row is-${a.status}`} aria-label={`Answer ${a.label}`}><header><strong>{a.label}</strong><span>{labels[a.status]}</span></header>{a.prompt&&<p className="doc-answer-prompt"><strong>Task / given word</strong> {a.prompt}</p>}<div className="doc-answer-columns"><div><small>YOUR ANSWER</small><p>{a.response||'No answer shown'}</p></div>{a.status==='needs-change'&&a.correction&&<div><small>CORRECTION</small><p><FeedbackText text={a.correction}/></p></div>}</div><p className="doc-answer-note"><FeedbackText text={a.note}/></p></article>)}</div></section>;
}
