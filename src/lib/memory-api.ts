import {authed,request,savedSession,type ApiResult} from './api';
import type {MemorySettings} from './learning-memory';
export const getMemorySettings=(code:string,teacher=false)=>teacher?request<ApiResult&{settings?:MemorySettings}>({action:'learningMemory',code,session:savedSession('__teacher__')?.token||''}):authed<ApiResult&{settings?:MemorySettings}>(code,{action:'learningMemory'});
export const saveMemorySettings=(code:string,settings:MemorySettings)=>request<ApiResult>({action:'teacherSetLearningMemory',code,settings,session:savedSession('__teacher__')?.token||''});
export const setMemoryEnabled=(code:string,enabled:boolean)=>authed<ApiResult>(code,{action:'learningMemoryEnabled',enabled});
