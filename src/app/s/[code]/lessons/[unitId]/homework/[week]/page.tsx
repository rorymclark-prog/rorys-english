import {notFound} from "next/navigation";
import {getBundle} from "@/lib/content";
import HomeworkWeekView from "@/components/views/HomeworkWeekView";
export function generateStaticParams({params}:{params:{code:string}}) {
  return getBundle(params.code)?.units.flatMap(u=>u.homework.map(h=>({unitId:u.id,week:String(h.week)})))||[];
}
export const dynamicParams=false;
export default async function Page({params}:{params:Promise<{code:string;unitId:string;week:string}>}) {
  const {code,unitId,week}=await params;
  const unit=getBundle(code)?.units.find(u=>u.id===unitId);
  const hw=unit?.homework.find(h=>String(h.week)===week);
  if(!unit||!hw)notFound();
  return <HomeworkWeekView unitId={unit.id} week={hw} archived={!unit.active} backHref={`/s/${code}/lessons/`}/>;
}
