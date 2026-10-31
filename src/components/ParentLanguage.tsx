"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import {PARENT_LANGUAGE_KEY,parentLanguage,type ParentLanguage} from '@/lib/parent-language';
const ParentLanguageContext=createContext<ParentLanguage|null>(null);
export function useParentLanguage(){const language=useContext(ParentLanguageContext);return {language:language||'en',parent:language!==null,t:(en:string,de:string)=>language==='de'?de:en};}
export default function ParentLanguageProvider({children}:{children:React.ReactNode}){
 const [language,setLanguage]=useState<ParentLanguage>('de');
 useEffect(()=>{try{setLanguage(parentLanguage(localStorage.getItem(PARENT_LANGUAGE_KEY)));}catch{/* German first */}},[]);
 function choose(value:ParentLanguage){setLanguage(value);try{localStorage.setItem(PARENT_LANGUAGE_KEY,value);}catch{/* usable without persistence */}}
 return <ParentLanguageContext.Provider value={language}><div lang={language} className="parent-portal"><header className="parent-language"><span>Rory’s English · {language==='de'?'Elternbereich':'Parent portal'}</span><div role="group" aria-label={language==='de'?'Sprache':'Language'}><button type="button" lang="de" aria-pressed={language==='de'} onClick={()=>choose('de')}>Deutsch</button><button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>choose('en')}>English</button></div></header>{children}</div></ParentLanguageContext.Provider>;
}
