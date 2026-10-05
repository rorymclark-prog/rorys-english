"use client";

import {useEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ChevronLeftIcon} from './Icons';
import {APP_BACK_STATE,appBackState} from '@/lib/app-navigation';

export default function BackButton({home}:{home:string}) {
  const pathname=usePathname(),router=useRouter();
  const scope=`${process.env.NEXT_PUBLIC_BASE_PATH||''}${home}`;
  const previous=useRef<{path:string;length:number}|null>(null);
  const [canGoBack,setCanGoBack]=useState(false);
  useEffect(()=>{
    const remember=()=>{
      const path=window.location.pathname;
      const state=appBackState(scope,path,window.history.length,window.history.state?.[APP_BACK_STATE],previous.current);
      window.history.replaceState({...window.history.state,[APP_BACK_STATE]:state},'');
      previous.current={path,length:window.history.length};
      setCanGoBack(state.canGoBack);
    };
    remember();window.addEventListener('popstate',remember);
    return()=>window.removeEventListener('popstate',remember);
  },[pathname,scope]);
  const atHome=pathname.replace(/\/$/,'')===home.replace(/\/$/,'');
  return <button type="button" className="re-back-button" disabled={atHome&&!canGoBack} onClick={()=>{
    const state=window.history.state?.[APP_BACK_STATE];
    if(state?.scope===scope&&state.path===window.location.pathname&&state.canGoBack&&window.history.length>1)router.back();
    else router.replace(home);
  }}><ChevronLeftIcon/><span>Back</span></button>;
}
