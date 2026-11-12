// Wires the student's own content into Find. The matching and the rules about
// what may be found live in find.ts; this file only fetches the data.
import ferdi from '../../content/ferdi/units.json';
import valentin from '../../content/valentin/units.json';
import {practiceCatalog} from './practice-catalog';
import {studentNavigation} from './student-navigation';
import {studentFindEntries,teacherFindEntries,type FindEntry} from './find';

type UnitFiles={title:string;resources?:{title:string}[]};
const unitFiles:Record<string,UnitFiles[]>={ferdi,valentin};

// The student id comes from the page's own student context, so this file never
// needs the roster (which must stay out of public browser code).
export function studentFindIndex(code:string,today:string,student:string):FindEntry[]{
  const files=(unitFiles[student]||[]).flatMap(unit=>(unit.resources||[]).map(r=>({title:r.title,unit:unit.title})));
  return studentFindEntries(code,studentNavigation,practiceCatalog(code),files,today);
}

export function teacherFindIndex(roster:{code:string;name:string}[]):FindEntry[]{
  return teacherFindEntries(roster.map(s=>({code:s.code,name:s.name})));
}
