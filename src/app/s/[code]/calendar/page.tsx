import {getBundle} from "@/lib/content";
import CalendarView from "@/components/views/CalendarView";
export default async function CalendarPage({params}:{params:Promise<{code:string}>}){const {code}=await params;const bundle=getBundle(code)!;return <CalendarView code={code} name={bundle.student.displayName}/>;}
