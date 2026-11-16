import {readLessonPractice,type LessonPractice} from './lesson-practice';
import {homeworkSection} from './homework-hub';
import type {Assignment} from './remote';

/** One lesson plan supplies all current homework views; old assignment prose is never copied. */
export function buildHomeworkRefresh(practice:LessonPractice,date:string,number:number):Assignment{
 const p=readLessonPractice(practice);
 if(!p?.assignmentId||!p.unitId||!p.vocabularyPrompt||!/^20\d\d-\d\d-\d\d$/.test(date)||p.lessonDate>date||!Number.isInteger(number)||number<1)throw Error('A refresh needs a verified lesson, linked assignment, unit and vocabulary task.');
 const sections=[`From our lesson on ${p.lessonDate}. Current practice starts ${date}. No fixed submission deadline.`,
  `1. Speaking with AI\nAim for 30 minutes per full teaching week, normally two chats on different days. The following ${p.speakingMinutes}-minute focus is part of that total, not extra time.\n${p.speakingPrompt}`,
  `2. Writing\n${p.writingPrompt}`,
  `3. Vocabulary\n${p.vocabularyPrompt}`,
  ...(p.writingSource?[`4. Source for writing\n${p.writingSource.title}\n${p.writingSource.text}`]:[]),
  `5. Save your work\nWrite independently. Handwriting is preferred: photograph every page clearly and upload it to this homework. A typed independent answer is also acceptable. Stop after your planned writing time and save an unfinished draft. Keep earlier work; you do not need to submit it again. In-app conversations save when you end the chat. Check that your work has saved. AI may explain a point or give a small hint, but must not write your submission. Holidays do not create catch-up minutes.`];
 return {id:p.assignmentId,date,title:`HW${number} · ${p.title}`,details:sections.join('\n\n'),due:'',status:'open'};
}

/** Used by the refresh workflow before saving and on exact live readback. */
export function homeworkRefreshIssues(assignment:Assignment,practice:LessonPractice){
 const issues:string[]=[];
 if(assignment.id!==practice.assignmentId)issues.push('assignment link');
 if(assignment.title.replace(/^HW\d+\s*·\s*/,'')!==practice.title)issues.push('title');
 if(homeworkSection(assignment.details,'writing')!==practice.writingPrompt)issues.push('writing brief');
 if(homeworkSection(assignment.details,'vocabulary')!==practice.vocabularyPrompt)issues.push('vocabulary');
 if(!assignment.details.includes(practice.speakingPrompt))issues.push('speaking brief');
 if(assignment.due&&assignment.due<assignment.date)issues.push('expired deadline');
 if(practice.writingSource&&!assignment.details.includes(practice.writingSource.text))issues.push('writing source');
 return issues;
}
