import Link from "next/link";
import StudyToolLink from "@/components/StudyToolLink";
import {LatestLessonPractice} from "@/components/LessonPractice";
import {readableDate} from "@/lib/clarity";
import UnitCover from "@/components/UnitCover";
import {getBundle} from "@/lib/content";
import type {Unit} from "@/lib/types";
import Screen from "@/components/Screen";
import {BookIcon,ChevronRightIcon,FolderIcon,PencilIcon} from "@/components/Icons";
import {MicrophoneIcon,RepeatIcon} from "@/components/LearningVisuals";

function UnitCard({unit,code}:{unit:Unit;code:string}){
  const resolve=(url:string)=>url.startsWith("/")?(process.env.NEXT_PUBLIC_BASE_PATH||"")+url:url;
  return <section className={`lesson-unit-card ${unit.active?"is-current":"is-archive"}`}>
    <UnitCover src={unit.coverImage} title={unit.title}/>
    <div className="lesson-unit-heading"><span className="lesson-unit-icon"><BookIcon/></span><div><p className="work-eyebrow">{unit.active?"CURRENT SCHOOL UNIT":unit.status==="tutoring"?"LESSON WITH RORY":"PREVIOUS YEAR"} · {unit.schoolYear||"Archive"}</p><h2>{unit.title}</h2></div></div>
    {unit.note&&<p className="ux-subtle">{unit.note}</p>}
    {unit.tutoringFocus&&<p className="lesson-focus"><strong>What you’re working on:</strong> {unit.tutoringFocus}</p>}
    {!unit.active&&unit.status!=="tutoring"&&<p className="ux-subtle">Saved for optional revision. These are not outstanding tasks.</p>}
    {unit.homework.length>0&&<div className="lesson-unit-group"><h3>Tasks in this unit</h3>{unit.homework.map(h=>{const speaking=h.tasks.some(t=>t.type==="voice"),Icon=speaking?MicrophoneIcon:PencilIcon;return <Link key={h.week} className="lesson-item" href={`/s/${code}/lessons/${unit.id}/homework/${h.week}/`}><span className={`lesson-item-icon ${speaking?"is-speaking":""}`}><Icon/></span><span><strong>{h.title}</strong><small>{speaking?"Speaking":"Writing"}{h.estimatedMinutes?` · About ${h.estimatedMinutes} min`:""}{h.due?` · Due ${readableDate(h.due)}`:" · No deadline set"}</small></span><ChevronRightIcon/></Link>})}</div>}
    {unit.resources&&unit.resources.length>0&&<div className="lesson-unit-group"><h3>Lesson files</h3>{unit.resources.map(r=><div key={r.url}><a className="lesson-item" href={resolve(r.url)} target="_blank" rel="noopener noreferrer"><span className="lesson-item-icon"><FolderIcon/></span><span><strong>{r.title}</strong><small>{r.blurb||"Open resource"}</small></span><ChevronRightIcon/></a>{r.url.endsWith(".mp3")&&<audio className="mt-2 w-full" controls preload="none" src={resolve(r.url)} aria-label={r.title}>Open the audio link above to listen.</audio>}</div>)}</div>}
    {unit.studyTools.length>0&&<div className="lesson-unit-group"><h3>Optional practice</h3>{unit.studyTools.map(t=><StudyToolLink key={t.url} className="lesson-item" href={resolve(t.url)}><span className="lesson-item-icon"><RepeatIcon/></span><span><strong>{t.title}</strong><small>{t.blurb||"Practice at your own pace"}</small></span><ChevronRightIcon/></StudyToolLink>)}</div>}
  </section>;
}

export default async function LessonsPage({params}:{params:Promise<{code:string}>}){
  const {code}=await params,bundle=getBundle(code)!;
  const units=[...bundle.units].sort((a,b)=>Number(b.status==="tutoring")-Number(a.status==="tutoring")||Number(b.active)-Number(a.active));
  const current=units.filter(u=>u.active||u.status==="tutoring"),archive=units.filter(u=>!(u.active||u.status==="tutoring"));
  return <Screen title="Lessons" subtitle="Your lesson with Rory and your current school unit.">
    <LatestLessonPractice code={code} showFiles={false}/>
    <div className="lesson-unit-list">{current.map(unit=><UnitCard key={unit.id} unit={unit} code={code}/>)}</div>
    {archive.length>0&&<details className="re-fold"><summary>Earlier material <span>{archive.length}</span></summary><div className="lesson-unit-list">{archive.map(unit=><UnitCard key={unit.id} unit={unit} code={code}/>)}</div></details>}
  </Screen>;
}
