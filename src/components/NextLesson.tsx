"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {fetchCalendar} from "@/lib/calendar-client";
import {nextLesson,lessonDate,lessonTime,type Lesson} from "@/lib/lesson-calendar";
import {CalendarIcon,ChevronRightIcon} from "@/components/Icons";
export default function NextLesson({code,row=false}:{code:string;row?:boolean}){
  const [lesson,setLesson]=useState<Lesson>(),[state,setState]=useState("loading");
  useEffect(()=>{let live=true;const refresh=()=>{void fetchCalendar(code).then(r=>{if(live){setState(r.ok?"ready":"error");if(r.ok)setLesson(nextLesson(r.lessons||[]));}}).catch(()=>{if(live)setState("error");});};refresh();window.addEventListener("focus",refresh);return()=>{live=false;window.removeEventListener("focus",refresh);};},[code]);
  const title=lesson?lessonDate(lesson.date):state==="loading"?"Checking lesson times…":state==="error"?"Check your lesson calendar":"Dates to be confirmed";
  if(row)return <Link className="today-row" href={`/s/${code}/calendar/`}><CalendarIcon/><span><strong>Next lesson</strong><small>{title}{lesson?` · ${lesson.time}–${lessonTime(lesson.end)}`:""}</small></span><ChevronRightIcon/></Link>;
  return <section className="ux-panel next-lesson-card"><p className="work-eyebrow">YOUR NEXT LESSON</p><h2>{title}</h2>{lesson&&<><p className="next-lesson-time">{lesson.time}–{lessonTime(lesson.end)} <small>Vienna time</small></p><p className="ux-subtle">{lesson.title}{lesson.location?` · ${lesson.location}`:""}</p></>}<Link className="ux-link-row" href={`/s/${code}/calendar/`}>Open lesson calendar <span aria-hidden>→</span></Link></section>;
}
