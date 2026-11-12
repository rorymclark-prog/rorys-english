// Wires the student's own content into Find. The matching and the rules about
// what may be found live in find.ts; this file only fetches the data.
import ferdi from '../../content/ferdi/units.json';
import valentin from '../../content/valentin/units.json';
import roster from '../../content/students.json';
import {practiceCatalog} from './practice-catalog';
import {studentNavigation} from './student-navigation';
import {studentFindEntries,teacherFindEntries,type FindEntry} from './find';

type UnitFiles={title:string;resources?:{title:string}[]};
const unitFiles:Record<string,UnitFiles[]>={ferdi,valentin};

export function studentFindIndex(code:string,today:string):FindEntry[]{
  const student=roster.find(s=>s.code===code)?.id||'';
  const files=(unitFiles[student]||[]).flatMap(unit=>(unit.resources||[]).map(r=>({title:r.title,unit:unit.title})));
  return studentFindEntries(code,studentNavigation,practiceCatalog(code),files,today);
}

export function teacherFindIndex():FindEntry[]{
  return teacherFindEntries(roster.map(s=>({code:s.code,name:s.displayName})));
}
