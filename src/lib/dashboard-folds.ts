// The teacher's Learning dashboard shows the blocks that have something in
// them. A block with nothing yet is folded away and named, so Rory can open it
// to start it; nothing is removed and "Show all" brings the whole page back.

export const DASHBOARD_FOLDS=[
  {id:'goals',label:'School profile & learning goals'},
  {id:'evidence',label:'Evidence record'},
  {id:'skills',label:'Skills & vocabulary checks'},
  {id:'homework',label:'Homework follow-through'},
  {id:'changes',label:'Change since earlier lessons'},
  {id:'school',label:'School expectations'},
  {id:'words',label:'Unit words in conversations'},
  {id:'checkpoints',label:'Your checkpoints'},
  {id:'teaching',label:'Your teaching over time'},
] as const;
export type DashboardFold=typeof DASHBOARD_FOLDS[number]['id'];

/** Which blocks have something in them, and the ones that do not, in page order. */
export function dashboardFolds(has:Record<DashboardFold,boolean>){
  return {has,empty:DASHBOARD_FOLDS.filter(fold=>!has[fold.id])};
}
