import Link from "next/link";
import FeedbackText from "./FeedbackText";
import {BookIcon,ChevronRightIcon} from "./Icons";
export default function YearPlanNotice({code,note}:{code:string;note:string}){
return <section className="today-notice" aria-label="From Rory">{note&&<p className="today-rory-note"><FeedbackText text={note}/></p>}<Link className="today-row" href={`/s/${code}/year-plan/`}><BookIcon/><span><strong>Year plan</strong><small>Units, assessments and dates to add</small></span><ChevronRightIcon/></Link></section>;
}
