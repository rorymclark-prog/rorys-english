"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useStudent} from "./StudentContext";
import {navIcons} from "./NavIcons";
import {studentNavigation,navPlace} from "@/lib/student-navigation";

// The five tabs are the five sections of the shared map, so a page lights the
// same tab it is listed under in the sidebar and the menu.
export default function TabBar(){
  const {code}=useStudent(),path=usePathname(),base=`/s/${code}`;
  const here=navPlace(path,base).section;
  return <nav aria-label="Main navigation" className="re-bottom-nav glass fixed inset-x-3 bottom-3 z-20 mx-auto rounded-card border border-black/[.06] shadow-[0_8px_30px_rgba(0,0,0,.14)] dark:border-white/10">
    <ul className="flex items-stretch justify-around pb-safe">{studentNavigation.map(({suffix,label,icon})=>{
      const Icon=navIcons[icon],active=here===suffix;
      return <li key={suffix} className="flex-1"><Link href={`${base}/${suffix}`} aria-current={active?"page":undefined} className={`re-tab-link flex min-h-[56px] flex-col items-center justify-center gap-1 pt-2 text-xs font-semibold ${active?"is-active":""}`}><Icon width={24} height={24}/><span>{label==='Homework'?<>Home<wbr/>work</>:label==='Feedback'?<>Feed<wbr/>back</>:label}</span></Link></li>;
    })}</ul>
  </nav>;
}
