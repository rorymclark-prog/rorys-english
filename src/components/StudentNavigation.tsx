"use client";

import Link from "next/link";
import ProfileAvatar from "@/components/ProfileAvatar";
import {usePathname} from "next/navigation";
import {useStudent} from "./StudentContext";
import {HomeIcon,BookIcon,CheckSquareIcon,ChartIcon,GearIcon,FolderIcon,TargetIcon,FileIcon,MessageIcon} from "./Icons";
import {MicrophoneIcon,RepeatIcon} from "./LearningVisuals";
const groups = [
  {label:"YOUR DAY", items:[["","Today",HomeIcon]]},
  {label:"YOUR WORK", items:[["homework/","Homework",CheckSquareIcon],["test-prep/","Test prep",TargetIcon],["documents/","Documents",FileIcon],["progress/","Feedback & progress",ChartIcon]]},
  {label:"PRACTISE & FIND", items:[["speak/","Speaking",MicrophoneIcon],["lessons/","Lessons",BookIcon],["study/","Practice",RepeatIcon],["resources/","Resources",FolderIcon],["coach/","Writing help",MessageIcon]]},
] as const;

export default function StudentNavigation(){
  const {code,displayName}=useStudent();
  const path=usePathname();
  const base=`/s/${code}`;
  return <aside className="re-sidebar">
    <Link href={`${base}/`} className="re-brand"><span>r.</span><div>Rory’s English<small>A LITTLE EVERY LESSON.</small></div></Link>
    <div className="re-workspace-label"><ProfileAvatar code={code} name={displayName}/><div>YOUR LEARNING SPACE<strong>{displayName}</strong></div></div>
    <nav aria-label="Workspace navigation" className="re-nav-groups">
      {groups.map(group=><div className="re-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([suffix,label,Icon])=>{
        const href=`${base}/${suffix}`;
        const active=suffix?path.startsWith(href):path===base||path===base+"/";
        return <Link key={href} href={href} aria-current={active?"page":undefined} className={active?"is-active":""}><Icon width={21} height={21}/>{label}</Link>;
      })}</div>)}
    </nav>
    <div className="re-sidebar-bottom"><Link href={`${base}/settings/`} className="re-settings-link"><GearIcon width={20}/>Settings</Link><div className="re-profile"><ProfileAvatar code={code} name={displayName}/><div><strong>{displayName}</strong><small>Your English space</small></div></div></div>
  </aside>;
}
