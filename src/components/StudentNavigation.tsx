"use client";

import Link from "next/link";
import ProfileAvatar from "@/components/ProfileAvatar";
import {usePathname} from "next/navigation";
import {useStudent} from "./StudentContext";
import {HomeIcon,CalendarIcon,BookIcon,CheckSquareIcon,ChartIcon,GearIcon,FolderIcon,TargetIcon,FileIcon,MessageIcon} from "./Icons";
import {MicrophoneIcon,RepeatIcon} from "./LearningVisuals";
import {studentNavigation as groups} from '@/lib/student-navigation';
const icons={home:HomeIcon,calendar:CalendarIcon,work:CheckSquareIcon,feedback:ChartIcon,documents:FileIcon,test:TargetIcon,speaking:MicrophoneIcon,lessons:BookIcon,practice:RepeatIcon,files:FolderIcon,writing:MessageIcon};

export default function StudentNavigation(){
  const {code,displayName}=useStudent();
  const path=usePathname();
  const base=`/s/${code}`;
  return <aside className="re-sidebar">
    <Link href={`${base}/`} className="re-brand"><span>r.</span><div>Rory’s English<small>A LITTLE EVERY LESSON.</small></div></Link>
    <div className="re-workspace-label"><ProfileAvatar code={code} name={displayName}/><div>YOUR LEARNING SPACE<strong>{displayName}</strong></div></div>
    <nav aria-label="Workspace navigation" className="re-nav-groups">
      {groups.map(group=><div className="re-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([suffix,label,icon])=>{
        const Icon=icons[icon];
        const href=`${base}/${suffix}`;
        const active=suffix?path.startsWith(href):path===base||path===base+"/";
        return <Link key={href} href={href} aria-current={active?"page":undefined} className={active?"is-active":""}><Icon width={21} height={21}/>{label}</Link>;
      })}</div>)}
    </nav>
    <div className="re-sidebar-bottom"><Link href={`${base}/settings/`} className="re-settings-link"><GearIcon width={20}/>Settings</Link><div className="re-profile"><ProfileAvatar code={code} name={displayName}/><div><strong>{displayName}</strong><small>Your English space</small></div></div></div>
  </aside>;
}
