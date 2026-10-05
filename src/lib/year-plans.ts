import plans from "../../content/year-plans.json";
export type YearPlan = typeof plans[number];
export function getYearPlan(studentId:string):YearPlan|undefined{return plans.find(p=>p.studentId===studentId);}
export function assessmentInstructions(minutes:number):string{return `Allow about ${minutes} minutes. Work independently and keep your first answers. Do not use AI, translation tools, a dictionary or another person unless Rory explicitly allows them for that task. Note your time and any help used. Submit your typed answers or clear photos/PDF to Rory, using the semester assessment title. Rory will give feedback; complete corrections afterwards as a separate attempt. A short fresh check in the next live lesson can confirm what you retained.`;}
