import {getStudentByParentCode} from "@/lib/content";
import CalendarView from "@/components/views/CalendarView";
export default async function ParentCalendarPage({params}:{params:Promise<{code:string}>}){const {code}=await params;const student=getStudentByParentCode(code)!;return <CalendarView code={code} name={student.displayName} parent/>;}
