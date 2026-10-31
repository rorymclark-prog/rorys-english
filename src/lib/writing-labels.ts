import type {ParentLanguage} from './parent-language';
export type WritingLanguage=ParentLanguage;
export const writingTranslator=(language:WritingLanguage='en')=>(english:string,german:string)=>language==='de'?german:english;
export const unchangedNote=(value:string)=>value;
