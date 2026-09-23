"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useStudent} from "./StudentContext";
import {HomeIcon,BookIcon,CheckSquareIcon,ChartIcon} from "./Icons";
import {MicrophoneIcon} from "./LearningVisuals";

export default function TabBar(){
  const {code}=useStudent(),path=usePathname(),base=`/s/${code}`;
  const tabs=[
    {href:`${base}/`,label:"Today",Icon:HomeIcon,active:path===base||path===`${base}/`},
    {href:`${base}/homework/`,label:"Work",Icon:CheckSquareIcon,active:["homework","test-prep","documents"].some(section=>path.startsWith(`${base}/${section}/`))},
    {href:`${base}/speak/`,label:"Speak",Icon:MicrophoneIcon,active:path.startsWith(`${base}/speak/`)},
    {href:`${base}/lessons/`,label:"Learn",Icon:BookIcon,active:["lessons","study","resources","coach"].some(section=>path.startsWith(`${base}/${section}/`))},
    {href:`${base}/progress/`,label:"Progress",Icon:ChartIcon,active:path.startsWith(`${base}/progress/`)},
  ];
  return <nav aria-label="Main navigation" className="re-bottom-nav glass fixed inset-x-3 bottom-3 z-20 mx-auto rounded-card border border-black/[.06] shadow-[0_8px_30px_rgba(0,0,0,.14)] dark:border-white/10">
    <ul className="flex items-stretch justify-around pb-safe">{tabs.map(({href,label,Icon,active})=><li key={href} className="flex-1"><Link href={href} aria-current={active?"page":undefined} className={`re-tab-link flex min-h-[56px] flex-col items-center justify-center gap-1 pt-2 text-xs font-semibold ${active?"is-active":""}`}><Icon width={24} height={24}/><span>{label}</span></Link></li>)}</ul>
  </nav>;
}
