import ferdi from '../../content/ferdi/units.json';
import valentin from '../../content/valentin/units.json';
import plans from '../../content/year-plans.json';
import ferdiTasks from '../../content/ferdi/english-in-context5-unit01-2026/homework.json';
import valentinTasks from '../../content/valentin/way2go8-unit01-2026/homework.json';
import ferdiArchive from '../../content/ferdi/unit10/homework.json';
import valentinArchive from '../../content/valentin/unit05/homework.json';
export type RingUnit={id:string;title:string;year:string;available:boolean;active:boolean;homework:{week:number;title:string;availableFrom?:string;tasks:{type:string}[]}[]};
export function practiceCatalog(code:string):RingUnit[]{
 const student=code==='ferdi-7h3k'?'ferdi':code==='valentin-q9m2'?'valentin':null;if(!student)return [];
 const defs=student==='ferdi'?ferdi:valentin,plan=plans.find(p=>p.studentId===student)!;
 const prefix=student==='ferdi'?'english-in-context5':'way2go8';
 const units:RingUnit[]=plan.units.map(u=>{const id=`${prefix}-unit${String(u.number).padStart(2,'0')}-2026`,def=defs.find(d=>d.id===id);return {id,title:`Unit ${u.number} · ${u.title}`,year:plan.schoolYear,available:!!def,active:!!def?.active,homework:def?.active?(student==='ferdi'?ferdiTasks:valentinTasks):[]};});
 for(const def of defs)if(!units.some(u=>u.id===def.id))units.push({id:def.id,title:def.title,year:def.schoolYear,available:true,active:def.active,homework:def.id==='unit10'?ferdiArchive:def.id==='unit05'?valentinArchive:[]});
 return units;
}
export function practiceCourse(code:string){const plan=plans.find(p=>p.studentId===(code==='ferdi-7h3k'?'ferdi':code==='valentin-q9m2'?'valentin':''));return plan?{title:plan.book,year:plan.schoolYear,provisional:plan.studentId==='valentin'}:null;}
