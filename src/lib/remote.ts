"use client";
import { authed, request, type ApiResult } from "./api";
export const remoteEnabled = () => !!process.env.NEXT_PUBLIC_SYNC_URL;
export interface Section { headers: string[]; rows: (string | number)[][] }
export interface Progress extends ApiResult { name?: string; generatedAt?: string; homework?: Section; quizzes?: Section; schoolTests?: Section; writing?: Section; speaking?: Section; mockTests?: Section }
export const fetchProgress = (code: string) => authed<Progress>(code,{action:"progress"});
export interface AiResult extends ApiResult {text?: string}
export const fetchAi = (code:string,kind:"word"|"writing"|"tutor",q:string) => authed<AiResult>(code,{action:"ai",kind,q});
export interface ResourceItem {name:string;url:string;type:string;modified:string}
export interface Resources extends ApiResult {name?:string;resources?:ResourceItem[]}
export const fetchResources = (code:string) => authed<Resources>(code,{action:"resources"});
export interface Assignment {date:string;title:string;details:string;due:string;id:string;status:string}
export interface AssignmentsResult extends ApiResult {assignments?:Section}
export const fetchAssignments = (code:string) => authed<AssignmentsResult>(code,{action:"assignments"});
export const rowToAssignment = (r:(string|number)[]):Assignment => ({date:String(r[0]??""),title:String(r[1]??""),details:String(r[2]??""),due:String(r[3]??""),id:String(r[5]??""),status:String(r[4]??"open")});
// A school-year boundary, not an inferred holiday calendar.
export const isCurrentAssignment = (a:Assignment) => /^2026-(09|10|11|12)-|^2027-(01|02|03|04|05|06|07|08)-/.test(a.date);
export interface OkResult extends ApiResult {}
export interface NoteResult extends ApiResult {note?:string}
export const fetchNote = (code:string) => authed<NoteResult>(code,{action:"note"});
export interface TeacherStudentSummary {homeworkDone:number|string;quizRounds:number|string;bestQuizPct:number|string;schoolTests:number|string;writingSamples:number|string;lastUpdated:string;daysSinceActivity:number|null}
export interface TeacherStudent {code:string;name:string;summary:TeacherStudentSummary|null;focusNote:string}
export interface TeacherDashboard extends ApiResult {generatedAt?:string;students?:TeacherStudent[]}
const teacherPost = <T extends ApiResult>(session:string,body:Record<string,unknown>) => request<T>({...body,session});
export const fetchTeacherDashboard = (session:string) => teacherPost<TeacherDashboard>(session,{action:"teacherDashboard"});
export interface AddStudentResult extends ApiResult {code?:string;parentCode?:string;name?:string}
export const addStudent = (s:string,name:string) => teacherPost<AddStudentResult>(s,{action:"teacherAddStudent",name});
export const assignHomeworkFromDashboard = (s:string,code:string,title:string,details:string,due:string) => teacherPost<OkResult>(s,{action:"teacherAssignHomework",code,title,details,due});
export const setFocusNote = (s:string,code:string,note:string) => teacherPost<OkResult>(s,{action:"teacherSetFocusNote",code,note});
export const logSchoolTest = (s:string,code:string,test:string,score:number,max:number,notes:string) => teacherPost<OkResult>(s,{action:"teacherLogSchoolTest",code,test,score,max,notes});
export const logMockTest = (s:string,code:string,paper:string,reading:number,listening:number,writing:number,speaking:number,useOfEnglish:number,notes:string) => teacherPost<OkResult>(s,{action:"teacherLogMockTest",code,paper,reading,listening,writing,speaking,useOfEnglish,notes});
export interface WritingAssessment {cefr:string;grammar:number;vocab:number;coherence:number;errors:string[];feedback:string}
export interface AnalyseWritingResult extends ApiResult {assessment?:WritingAssessment}
export const analyseWriting = (s:string,code:string,title:string,text:string) => teacherPost<AnalyseWritingResult>(s,{action:"teacherAnalyseWriting",code,title,text});
export const publishAssessment = (s:string,code:string,title:string,assessment:WritingAssessment,id:string) => teacherPost<OkResult>(s,{action:"teacherPublishAssessment",code,title,assessment,id});
export interface Submission {id:string;task:string;title?:string;prompts?:Record<string,string>;unit:string;submitted:string;answers:Record<string,string>;status:string;feedback:string;reviewed:string;feedbackAvailableAt?:string;reviewPending?:boolean}
export interface Submissions extends ApiResult {submissions?:Submission[]}
export const fetchSubmissions = (code:string) => authed<Submissions>(code,{action:"submissions"});
export const reviewSubmission = (code:string,id:string,status:string,feedback:string) => authed<OkResult>(code,{action:"teacherReview",id,status,feedback});
export const createAccess = (code:string,parent=false) => authed<OkResult & {access?:string}>(code,{action:"teacherAccess",parent});
export const publishResources = (code:string,resources:ResourceItem[]) => authed<OkResult>(code,{action:"teacherResources",resources});
