export type ParentLanguage='de'|'en';
export const PARENT_LANGUAGE_KEY='re_parent_language_v1';
export const parentLanguage=(value:unknown):ParentLanguage=>value==='en'?'en':'de';
export const parentDate=(value:string,language:ParentLanguage)=>{
 const date=new Date(value.length===10?`${value}T12:00:00Z`:value);
 return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(language==='de'?'de-AT':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Vienna'}).format(date);
};
