export const LESSON_TIMEZONE = "Europe/Vienna";
export type Lesson = { id:string; seriesId:string; date:string; time:string; duration:number; start:string; end:string; timezone:string; title:string; location:string; status:"scheduled"|"cancelled"; sequence:number; updatedAt:string; studentCode:string; studentName:string };
export type LessonRequest = { id:string; lessonId:string; date:string; time:string; message:string; role:string; status:"pending"|"accepted"|"declined"; createdAt:string; studentCode:string; studentName:string };
export type LessonBreak = { id:string; from:string; to:string; label:string; studentCode:string; studentName:string };
export type SchoolTest = {id:string;date:string;title:string;scope:string;files:{index:number;name:string;type:string;size:number}[];status:"scheduled"|"cancelled";sequence:number;updatedAt:string;studentCode:string;studentName:string};
export type CalendarData = { ok:boolean; error?:string; lessons:Lesson[]; requests:LessonRequest[]; breaks:LessonBreak[]; tests?:SchoolTest[] };
export type FeedLesson = {date?:string} & Pick<Lesson,"id"|"start"|"end"|"title"|"location"|"status"|"sequence"|"updatedAt">;
export function viennaDate(now=new Date()):string {return new Intl.DateTimeFormat("en-CA",{timeZone:LESSON_TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function lessonDate(date:string):string {return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:LESSON_TIMEZONE}).format(new Date(`${date}T12:00:00Z`));}
export function lessonTime(iso:string):string {return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:LESSON_TIMEZONE}).format(new Date(iso));}
export function nextLesson(lessons:Lesson[],now=Date.now()):Lesson|undefined {return lessons.filter(l=>l.status==="scheduled"&&new Date(l.end).getTime()>now).sort((a,b)=>a.start.localeCompare(b.start))[0];}
function icsText(value:string):string {return value.replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/[,;]/g,"\\$&").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");}
function stamp(value:string):string {return new Date(value).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");}
// RFC 5545 folds at 75 UTF-8 octets, without splitting a character.
function fold(line:string):string {let out="",part="",bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>75){out+=part+"\r\n";part=" ";bytes=1;}part+=char;bytes+=n;}return out+part;}
export function buildLessonsIcs(lessons:FeedLesson[],now=new Date()):string {
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Rory's English//Lessons//EN","CALSCALE:GREGORIAN","X-WR-CALNAME:Rory’s English calendar","X-WR-TIMEZONE:Europe/Vienna","REFRESH-INTERVAL;VALUE=DURATION:PT1H","X-PUBLISHED-TTL:PT1H"];
  for(const l of lessons){
    lines.push("BEGIN:VEVENT",`UID:${l.id.replace(/[^A-Za-z0-9_-]/g,"")}@lessons.rorys-english`, `DTSTAMP:${stamp(l.updatedAt||now.toISOString())}`,`LAST-MODIFIED:${stamp(l.updatedAt||now.toISOString())}`,`SEQUENCE:${Math.max(0,Math.floor(l.sequence))}`,...(l.date?[`DTSTART;VALUE=DATE:${l.date.replace(/-/g,"")}`,`DTEND;VALUE=DATE:${new Date(new Date(l.date+"T12:00:00Z").getTime()+86400000).toISOString().slice(0,10).replace(/-/g,"")}`]:[`DTSTART:${stamp(l.start)}`,`DTEND:${stamp(l.end)}`]),`SUMMARY:${icsText(l.title)}`,`STATUS:${l.status==="cancelled"?"CANCELLED":"CONFIRMED"}`);
    if(l.location)lines.push(`LOCATION:${icsText(l.location)}`);
    if(l.status!=="cancelled"&&!l.date)lines.push("BEGIN:VALARM","TRIGGER:-PT1H","ACTION:DISPLAY","DESCRIPTION:English lesson in one hour","END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");return lines.map(fold).join("\r\n")+"\r\n";
}
