// Where the teacher workspace is, written into the address bar.
//
// Every teacher screen renders inside one client component at /teacher/, so
// without this Back left the app, refresh dropped Rory on the student list and
// nothing could be bookmarked. The query keeps the formats older links and
// notifications already use (?student=…&section=…&record=…, ?inbox=…), so
// nothing that points here today breaks.

export const TEACHER_SECTIONS=["overview","teaching","learning","documents","review","assign","assess"] as const;
export type TeacherSection=typeof TEACHER_SECTIONS[number];

export type TeacherView=
  |{kind:"home"}
  |{kind:"student";student:string;section:TeacherSection;record?:string}
  |{kind:"progress";student:string}
  |{kind:"calendar";student?:string}
  |{kind:"live"}
  |{kind:"voice"}
  |{kind:"inbox";tab:"messages"|"notifications";student?:string};

const RECORD=/^[A-Za-z0-9_-]{16,100}$/;
const CODE=/^[A-Za-z0-9_-]{1,100}$/;

function isSection(value:string|null):value is TeacherSection{return !!value&&(TEACHER_SECTIONS as readonly string[]).includes(value);}

/** Reads the view from location.search and location.pathname. */
export function readTeacherView(search:string,pathname=""):TeacherView{
  const q=new URLSearchParams(search);
  const inbox=q.get("inbox"),view=q.get("view"),section=q.get("section");
  const student=CODE.test(q.get("student")||"")?q.get("student")!:undefined;
  if(inbox==="messages"||inbox==="notifications")return {kind:"inbox",tab:inbox,...(student?{student}:{})};
  if(view==="calendar"||section==="calendar")return {kind:"calendar",...(student?{student}:{})};
  if(view==="live")return {kind:"live"};
  if(view==="voice")return {kind:"voice"};
  if(student&&view==="progress")return {kind:"progress",student};
  if(student){
    const record=RECORD.test(q.get("record")||"")?q.get("record")!:undefined;
    // A recorded-lesson link with no section opens the notes it belongs to.
    const chosen:TeacherSection=isSection(section)?section:record?"learning":"overview";
    return {kind:"student",student,section:chosen,...(record?{record}:{})};
  }
  // The older standalone routes still work as entry points.
  if(/\/teacher\/calendar\/?$/.test(pathname))return {kind:"calendar"};
  if(/\/teacher\/live\/?$/.test(pathname))return {kind:"live"};
  return {kind:"home"};
}

/** The canonical address for a view, under /teacher/. */
export function teacherViewHref(view:TeacherView,basePath=""):string{
  const q=new URLSearchParams();
  switch(view.kind){
    case "inbox":q.set("inbox",view.tab);if(view.student)q.set("student",view.student);break;
    case "calendar":q.set("view","calendar");if(view.student)q.set("student",view.student);break;
    case "live":q.set("view","live");break;
    case "voice":q.set("view","voice");break;
    case "progress":q.set("student",view.student);q.set("view","progress");break;
    case "student":q.set("student",view.student);if(view.section!=="overview")q.set("section",view.section);if(view.record)q.set("record",view.record);break;
  }
  const query=q.toString();
  return `${basePath}/teacher/${query?"?"+query:""}`;
}
