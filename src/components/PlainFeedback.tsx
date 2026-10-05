import FeedbackText from './FeedbackText';
import type {PlainReview} from '@/lib/learning';

export default function PlainFeedback({review}:{review:PlainReview}){
  return <div className="space-y-4 text-sm leading-7">{review.summary&&<p><FeedbackText text={review.summary}/></p>}{review.strengths?.length? <div><h4 className="font-bold">What went well</h4><ul className="ml-5 list-disc space-y-2">{review.strengths.map((x,i)=><li key={i}><FeedbackText text={x}/></li>)}</ul></div>:null}{review.targets?.length?<div><h4 className="font-bold">What to practise next</h4><ul className="ml-5 list-disc space-y-2">{review.targets.map((x,i)=><li key={i}><FeedbackText text={x}/></li>)}</ul></div>:null}{review.nextStep&&<div><h4 className="font-bold">Try this</h4><p><FeedbackText text={review.nextStep}/></p></div>}</div>;
}
