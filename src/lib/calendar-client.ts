"use client";
import {authed,type ApiResult} from "./api";
import type {CalendarData} from "./lesson-calendar";
export function fetchCalendar(code:string,teacher=false){return authed<CalendarData>(code,{action:teacher?"teacherCalendarLessons":"calendarLessons"});}
export function calendarAction(code:string,action:string,body:Record<string,unknown>={}){return authed<ApiResult & {calendarToken?:string;scope?:string;created?:number;skipped?:number;cancelled?:number}>(code,{action,...body});}
