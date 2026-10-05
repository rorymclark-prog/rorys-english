import {getAllStudents,getBundle} from "@/lib/content";
import "../teacher.css";
import {SettingsProvider} from "@/components/SettingsContext";
import {themeScript} from "@/lib/appearance";
import TeacherDashboardView from "@/components/views/TeacherDashboardView";
export const metadata={title:"Calendar — Rory’s English",robots:{index:false,follow:false}};
export default function TeacherCalendarPage(){return <div className="min-h-dvh re-teacher-shell"><script dangerouslySetInnerHTML={{__html:themeScript("__teacher__")}}/><SettingsProvider studentId="__teacher__"><TeacherDashboardView activeUnits={Object.fromEntries(getAllStudents().map(s=>[s.code,getBundle(s.code)?.activeUnit||null]))} initialCalendar/></SettingsProvider></div>;}
