import Link from "next/link";
import StudyToolLink from "@/components/StudyToolLink";
import {getBundle} from "@/lib/content";
import Screen from "@/components/Screen";
export default async function LessonsPage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params; const bundle=getBundle(code)!;
  const resolve=(url:string)=>url.startsWith("/")?(process.env.NEXT_PUBLIC_BASE_PATH||"")+url:url;
  return <Screen title="Lessons & archive" subtitle="This year first. Previous work is here when you need it.">
    {bundle.units.map(unit=><section key={unit.id} className="mt-4 rounded-card bg-surface p-5 shadow-card dark:bg-navy-raised">
      <p className="text-xs font-bold uppercase tracking-wide">{unit.active?"Current school year":"Previous-year archive"} · {unit.schoolYear||"Previous year"}</p>
      <h2 className="mt-2 text-xl font-bold">{unit.title}</h2>
      {unit.note&&<p className="mt-2">{unit.note}</p>}
      {unit.tutoringFocus&&<p className="mt-3 rounded-lg border p-3"><strong>Our tutoring plan:</strong> {unit.tutoringFocus}</p>}
      {!unit.active&&<p className="mt-2 text-sm">Kept for optional revision. These are not outstanding tasks for this year.</p>}
      {unit.homework.map(h=><Link key={h.week} className="mt-3 block underline" href={`/s/${code}/lessons/${unit.id}/homework/${h.week}/`}>{h.title}{h.due?` · ${h.due}`:" · No deadline set"}</Link>)}
      {unit.resources?.map(r=><div key={r.url} className="mt-4 border-t pt-3">
        <a className="font-semibold underline" href={resolve(r.url)} target="_blank" rel="noopener noreferrer">{r.title}</a>
        {r.blurb&&<p className="mt-1 text-sm">{r.blurb}</p>}
        {r.url.endsWith(".mp3")&&<audio className="mt-3 w-full" controls preload="none" src={resolve(r.url)} aria-label={r.title}>Open the audio link above to listen.</audio>}
      </div>)}
      {unit.studyTools.map(t=><StudyToolLink key={t.url} className="mt-3 block underline" href={resolve(t.url)}>{t.title} · optional practice</StudyToolLink>)}
    </section>)}
    <Link className="mt-5 inline-block underline" href={`/s/${code}/resources/`}>Other approved documents →</Link>
  </Screen>;
}
