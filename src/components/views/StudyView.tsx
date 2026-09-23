"use client";

import Link from "next/link";
import StudyToolLink from "@/components/StudyToolLink";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import Screen from "@/components/Screen";
import {BookIcon,ChevronRightIcon,ExternalIcon,MessageIcon} from "@/components/Icons";
import {MicrophoneIcon,RepeatIcon} from "@/components/LearningVisuals";

export default function StudyView({unit}:{unit:Unit|null}){
  const {code}=useStudent(),tools=unit?.studyTools??[];
  const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
  const resolve=(url:string)=>url.startsWith("/")?`${base}${url}`:url;
  return <Screen title="Practice" subtitle={unit?.title}>
    <p className="work-intro">Choose one skill to try. Your lesson and speaking work are close by.</p>
    <nav className="ux-route-grid" aria-label="More ways to practise"><Link className="ux-route-card" href={`/s/${code}/speak/`}><MicrophoneIcon/><span><strong>Speaking</strong><small>Talk through an idea</small></span><ChevronRightIcon/></Link><Link className="ux-route-card" href={`/s/${code}/coach/`}><MessageIcon/><span><strong>Writing help</strong><small>Hints for words and drafts</small></span><ChevronRightIcon/></Link><Link className="ux-route-card" href={`/s/${code}/lessons/`}><BookIcon/><span><strong>Lessons</strong><small>See your current unit</small></span><ChevronRightIcon/></Link></nav>
    <section className="study-tools" aria-labelledby="study-tools-title"><div className="work-section-heading"><div><p className="work-eyebrow">TRY IT YOURSELF</p><h2 id="study-tools-title">Study tools</h2></div><span className="work-count">{tools.length}</span></div>
      {tools.length===0?<div className="work-empty"><RepeatIcon/><strong>No study tools for this unit yet.</strong><p>Try a speaking conversation or open your lesson instead.</p></div>:<ul className="study-tool-grid">{tools.map(tool=><li key={`${tool.url}${tool.title}`} className="study-tool-card"><span className="study-tool-icon"><RepeatIcon/></span><span className="ux-chip">PRACTICE TOOL</span><h3>{tool.title}</h3><p>{tool.blurb||"Practise at your own pace."}</p><StudyToolLink href={resolve(tool.url)} className="study-tool-action">Open practice <ExternalIcon/></StudyToolLink></li>)}</ul>}
    </section>
  </Screen>;
}
