"use client";

import {useCallback} from "react";
import Link from "next/link";
import ProfileAvatar from "@/components/ProfileAvatar";
import {usePathname} from "next/navigation";
import {useStudent} from "./StudentContext";
import {GearIcon} from "./Icons";
import {navIcons} from "./NavIcons";
import FindBox from "./FindBox";
import {studentNavigation as sections,navPlace} from '@/lib/student-navigation';
import {studentFindIndex} from '@/lib/find-index';
import {localDate} from '@/lib/local-date';

// The desktop sidebar: the same five sections as the phone's tab bar, each
// with its own pages underneath, and Find above them.
export default function StudentNavigation(){
  const {code,displayName,studentId}=useStudent();
  const path=usePathname();
  const base=`/s/${code}`;
  const here=navPlace(path,base);
  const entries=useCallback(()=>studentFindIndex(code,localDate(),studentId),[code,studentId]);
  return <aside className="re-sidebar">
    <Link href={`${base}/`} className="re-brand"><span>r.</span><div>Rory’s English<small>A LITTLE EVERY LESSON.</small></div></Link>
    <FindBox entries={entries} placeholder="Find" shortcut/>
    <nav aria-label="Workspace navigation" className="re-nav-groups">
      {sections.map(section=>{
        const Icon=navIcons[section.icon];
        const current=here.item===section.suffix,inside=here.section===section.suffix&&!current;
        return <div className="re-nav-group" key={section.suffix}>
          <Link href={`${base}/${section.suffix}`} aria-current={current?"page":undefined} className={current?"is-active":inside?"is-section":""}><Icon width={21} height={21}/>{section.label}</Link>
          {section.more.map(item=>{const on=here.item===item.suffix;return <Link key={item.suffix} href={`${base}/${item.suffix}`} aria-current={on?"page":undefined} className={`re-nav-sub${on?" is-active":""}`}>{item.label}</Link>;})}
        </div>;
      })}
    </nav>
    <div className="re-sidebar-bottom"><Link href={`${base}/settings/`} className="re-settings-link"><GearIcon width={20}/>Settings</Link><div className="re-profile"><ProfileAvatar code={code} name={displayName}/><div><strong>{displayName}</strong><small>Your English space</small></div></div></div>
  </aside>;
}
