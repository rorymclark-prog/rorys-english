"use client";

import StudyToolLink from "@/components/StudyToolLink";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import Screen from "@/components/Screen";
import StatusRow from "@/components/StatusRow";
import {ExternalIcon} from "@/components/Icons";
import {RepeatIcon} from "@/components/LearningVisuals";
import PracticeDesk from "@/components/PracticeDesk";

export default function StudyView({unit}:{unit:Unit|null}){
  const {code,displayName}=useStudent(),tools=unit?.studyTools??[];
  const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
  const resolve=(url:string)=>url.startsWith("/")?`${base}${url}`:url;
  return <Screen title="Practice desk" subtitle={unit?.title}>
    <PracticeDesk key={code} code={code} name={displayName}/>
    <p className="work-intro mt-8">More optional tools for this unit.</p>
    <section className="study-tools" aria-labelledby="study-tools-title"><div className="work-section-heading"><div><p className="work-eyebrow">TRY IT YOURSELF</p><h2 id="study-tools-title">Study tools</h2></div><span className="work-count">{tools.length}</span></div>
      {tools.length===0?<StatusRow kind="empty">No study tools for this unit yet.</StatusRow>:<ul className="study-tool-grid">{tools.map(tool=><li key={`${tool.url}${tool.title}`} className="study-tool-card"><span className="study-tool-icon"><RepeatIcon/></span><span className="ux-chip">PRACTICE TOOL</span><h3>{tool.title}</h3><p>{tool.blurb||"Practise at your own pace."}</p><StudyToolLink href={resolve(tool.url)} className="study-tool-action">Open practice <ExternalIcon/></StudyToolLink></li>)}</ul>}
    </section>
  </Screen>;
}
