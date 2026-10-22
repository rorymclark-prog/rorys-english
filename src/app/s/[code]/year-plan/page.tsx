import Link from "next/link";
import {notFound} from "next/navigation";
import {getStudentByCode} from "@/lib/content";
import {getYearPlan,assessmentInstructions} from "@/lib/year-plans";
import {CalendarIcon,ChevronRightIcon,ClockIcon} from "@/components/Icons";
const viennaDate=(iso:string)=>new Date(iso+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Vienna"});
export default async function YearPlanPage({params}:{params:Promise<{code:string}>}){
  const {code}=await params;const student=getStudentByCode(code);const plan=student&&getYearPlan(student.id);if(!plan)notFound();
  return <main className="re-home today-page year-plan-page">
    <header className="re-page-heading"><p className="re-eyebrow">{plan.schoolYear} · {plan.book}</p><h1>Year plan</h1><p>Rory adjusts this to your school work. Nothing here is a task for today.</p></header>
    <section className="today-rows" aria-label="To do with your family">
      <Link className="today-row" href={`/s/${code}/calendar/`}><CalendarIcon/><span><strong>Add your school test dates</strong><small>So a preparation lesson lands before each test</small></span><ChevronRightIcon/></Link>
      <div className="today-row is-static"><ClockIcon/><span><strong>Arrange two recap lessons</strong><small>One before the first-semester test, one before the final assessment</small></span></div>
    </section>
    <details className="re-fold" open><summary>Next lessons</summary>
      {plan.bookings.map(b=><div className="plan-row" key={b.date}><span><strong>{viennaDate(b.date)}</strong><small>{b.focus}</small></span></div>)}
      <p>The Calendar holds the current booking. These focuses are proposals; unfinished work carries forward.</p>
    </details>
    <details className="re-fold"><summary>Assessments at home</summary>
      {plan.milestones.map(m=><div className="plan-row" key={m.id}><span><strong>{m.title}</strong><small>{m.window} · date to confirm · about {m.duration} minutes</small></span></div>)}
      <p>Planned checkpoints, not tasks for now. Rory releases fresh questions on what you have actually studied and sets a term-time deadline.</p>
      <p>{assessmentInstructions(plan.milestones[0]?.duration??45)}</p>
      <p><Link href={`/s/${code}/documents/`}>Submit a completed assessment in My saved work</Link>, keeping the first attempt separate from later corrections.</p>
    </details>
    <details className="re-fold"><summary>All units <span>{plan.units.length}</span></summary>
      {plan.units.map(u=><div className="plan-row" key={u.number}><span><strong>Unit {u.number} · {u.title}</strong><small>pp{u.pages[0]}–{u.pages[1]} · {u.focus}</small></span></div>)}
      <p>{plan.sourceStatus}. This outline does not mark any unit complete.</p>
    </details>
    <details className="re-fold"><summary>How we work</summary>
      <p>Fortnightly home visits during term time. No lessons or assumed homework during school holidays, including 26 December and the Christmas break.</p>
      <p>{plan.capacity}</p>
      <p>Between lessons: practise a few unit words in conversation, rehearse the writing points aloud, then write your own answer. Rory picks one manageable follow-up after each lesson.</p>
    </details>
  </main>;
}
