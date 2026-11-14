// The teacher home shows a block that has something in it as a card. A block
// with nothing yet is one quiet folded line that says what will appear there;
// open it to read the full explanation. Same idea as dashboard-folds.ts.

export const HOME_FOLDS={
  assessments:{label:'Recorded lesson assessments',appears:'Draft reviews of recorded lessons appear here.'},
  progress:{label:'Your teaching progress',appears:'Your lesson reflections appear here once you add one.'},
} as const;
export type HomeFold=keyof typeof HOME_FOLDS;
