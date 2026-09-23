import Link from "next/link";
import StudyToolLink from "@/components/StudyToolLink";
import {getBundle} from "@/lib/content";
import type {Unit} from "@/lib/types";
import Screen from "@/components/Screen";
import {BookIcon,ChevronRightIcon,ClockIcon,FolderIcon,PencilIcon,TargetIcon} from "@/components/Icons";
import {MicrophoneIcon,RepeatIcon} from "@/components/LearningVisuals";

function UnitCard({unit,code}:{unit:Unit;code:string}){
  const resolve=(url:string)=>url.startsWith("/")?(process.env.NEXT_PUBLIC_BASE_PATH||"")+url:url;
  return <section className={`lesson-unit-card ${unit.active?"is-current":"is-archive"}`}>
    <div className="lesson-unit-heading"><span className="lesson-unit-icon"><BookIcon/></span><div><p className="work-eyebrow">{unit.active?"CURRENT UNIT":"PREVIOUS YEAR"} · {unit.schoolYear||"Archive"}</p><h2>{unit.title}</h2></div></div>
    {unit.note&&<p className="ux-subtle">{unit.note}</p>}
    {unit.tutoringFocus&&<p className="lesson-focus"><strong>What you’re working on:</strong> {unit.tutoringFocus}</p>}
    {!unit.active&&<p className="ux-subtle">Saved for optional revision. These are not outstanding tasks.</p>}
    {unit.homework.length>0&&<div className="lesson-unit-group"><h3>Tasks in this unit</h3>{unit.homework.map(h=>{const speaking=h.tasks.some(t=>t.type==="voice"),Icon=speaking?MicrophoneIcon:PencilIcon;return <Link key={h.week} className="lesson-item" href={`/s/${code}/lessons/${unit.id}/homework/${h.week}/`}><span className={`lesson-item-icon ${speaking?"is-speaking":""}`}><Icon/></span><span><strong>{h.title}</strong><small>{speaking?"Speaking":"Writing"}{h.estimatedMinutes?` · About ${h.estimatedMinutes} min`:""}{h.due?` · Due ${h.due}`:" · No deadline set"}</small></span><ChevronRightIcon/></Link>})}</div>}
    {unit.resources&&unit.resources.length>0&&<div className="lesson-unit-group"><h3>Lesson files</h3>{unit.resources.map(r=><div key={r.url}><a className="lesson-item" href={resolve(r.url)} target="_blank" rel="noopener noreferrer"><span className="lesson-item-icon"><FolderIcon/></span><span><strong>{r.title}</strong><small>{r.blurb||"Open resource"}</small></span><ChevronRightIcon/></a>{r.url.endsWith(".mp3")&&<audio className="mt-2 w-full" controls preload="none" src={resolve(r.url)} aria-label={r.title}>Open the audio link above to listen.</audio>}</div>)}</div>}
    {unit.studyTools.length>0&&<div className="lesson-unit-group"><h3>Optional practice</h3>{unit.studyTools.map(t=><StudyToolLink key={t.url} className="lesson-item" href={resolve(t.url)}><span className="lesson-item-icon"><RepeatIcon/></span><span><strong>{t.title}</strong><small>{t.blurb||"Practice at your own pace"}</small></span><ChevronRightIcon/></StudyToolLink>)}</div>}
  </section>;
}

export default async function LessonsPage({params}:{params:Promise<{code:string}>}){
  const {code}=await params,bundle=getBundle(code)!;
  const units=[...bundle.units].sort((a,b)=>Number(b.active)-Number(a.active));
  return <Screen title="Lessons" subtitle="Your current unit first, then earlier material for revision.">
    <nav className="ux-route-grid" aria-label="More ways to learn"><Link className="ux-route-card" href={`/s/${code}/study/`}><RepeatIcon/><span><strong>Practice</strong><small>Study tools and quizzes</small></span><ChevronRightIcon/></Link><Link className="ux-route-card" href={`/s/${code}/resources/`}><FolderIcon/><span><strong>Resources</strong><small>Slides, audio and files</small></span><ChevronRightIcon/></Link><Link className="ux-route-card" href={`/s/${code}/test-prep/`}><TargetIcon/><span><strong>Test prep</strong><small>Reviews and next steps</small></span><ChevronRightIcon/></Link></nav>
    <div className="lesson-unit-list">{units.map(unit=><UnitCard key={unit.id} unit={unit} code={code}/>)}</div>
  </Screen>;
}
