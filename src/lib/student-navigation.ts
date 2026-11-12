// One map of the student app. The tab bar, the desktop sidebar, the phone menu
// and Find all read it, so a page sits in the same place wherever you look.
//
// Five sections, one per tab. `more` lists the pages that belong to a section;
// `owns` names pages that light the tab without being listed (they are reached
// from a bell, a row on Today or Find). `words` are extra search words, German
// included, and are never shown.

export type NavIcon='home'|'calendar'|'work'|'feedback'|'documents'|'test'|'speaking'|'lessons'|'practice'|'files'|'writing';
export type NavItem={suffix:string;label:string;icon:NavIcon;hint:string;words:string};
export type NavSection=NavItem&{more:readonly NavItem[];owns?:readonly string[]};

export const studentNavigation:readonly NavSection[]=[
  {suffix:'',label:'Today',icon:'home',hint:'What to do next',words:'home start heute dashboard next',owns:['notifications','year-plan'],more:[
    {suffix:'calendar/',label:'Calendar',icon:'calendar',hint:'Lesson times and dates',words:'kalender termine schedule timetable when lesson time date stundenplan'},
    {suffix:'messages/',label:'Messages',icon:'writing',hint:'Write to Rory',words:'nachrichten message chat ask question rory contact schreiben'},
  ]},
  {suffix:'homework/',label:'Homework',icon:'work',hint:'Tasks Rory set',words:'hausaufgaben hausübung hü tasks assignment due exercise aufgabe',more:[
    {suffix:'test-prep/',label:'Test prep',icon:'test',hint:'Dates and what to revise',words:'schularbeit test exam prüfung matura revise revision lernen klausur'},
    {suffix:'documents/',label:'My saved work',icon:'documents',hint:'Photos and files you sent',words:'documents dokumente upload photo foto scan essay file pdf worksheet arbeitsblatt handwriting'},
  ]},
  {suffix:'speak/',label:'Speak',icon:'speaking',hint:'Talk and get feedback',words:'sprechen speaking voice conversation talk pronunciation aussprache microphone mikrofon',more:[]},
  {suffix:'lessons/',label:'Lessons',icon:'lessons',hint:'Units and lesson notes',words:'unit units lektion book buch course kurs slides',more:[
    {suffix:'study/',label:'Practice desk',icon:'practice',hint:'Retry your exercises',words:'practice practise üben übung exercises retry vocabulary vokabeln study tools quiz'},
    {suffix:'resources/',label:'Resource library',icon:'files',hint:'All lesson files',words:'resources files dateien materials slides folien pdf worksheet transcript download unterlagen'},
    {suffix:'coach/',label:'Writing help',icon:'writing',hint:'Ask the writing coach',words:'coach writing schreiben essay email text tips hilfe ai'},
  ]},
  {suffix:'progress/',label:'Feedback',icon:'feedback',hint:'Corrections and progress',words:'feedback progress fortschritt corrections korrektur rückmeldung results marks noten review',more:[]},
];

/** Where a path sits on the map: the section whose tab lights up, and the exact page if it is listed. */
export function navPlace(path:string,base:string):{section:string|null;item:string|null}{
  const rest=path.startsWith(base)?path.slice(base.length).replace(/^\/+/,''):'';
  const parts=rest.split('/').filter(Boolean);
  if(!parts.length)return {section:'',item:''};
  // A homework task is homework, even though its address sits under its unit.
  if(parts[0]==='lessons'&&parts[2]==='homework')return {section:'homework/',item:'homework/'};
  const page=parts[0]+'/';
  for(const section of studentNavigation){
    if(section.suffix===page)return {section:section.suffix,item:page};
    if(section.more.some(item=>item.suffix===page))return {section:section.suffix,item:page};
    if(section.owns?.includes(parts[0]))return {section:section.suffix,item:null};
  }
  return {section:null,item:null};
}
