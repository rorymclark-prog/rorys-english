"use client";

import {useEffect,useRef,useState} from "react";

const key=(code:string)=>`re_profile_photo_v1_${code}`;
export default function ProfileAvatar({code,name,editable=false,className=""}:{code:string;name:string;editable?:boolean;className?:string}){
  const [photo,setPhoto]=useState<string|null>(null);
  const [error,setError]=useState("");
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const update=()=>{try{setPhoto(localStorage.getItem(key(code)));}catch{setPhoto(null);}};
    update();window.addEventListener("storage",update);window.addEventListener("re-profile-photo",update);
    return()=>{window.removeEventListener("storage",update);window.removeEventListener("re-profile-photo",update);};
  },[code]);
  async function choose(file?:File){
    if(!file)return;
    if(!file.type.startsWith("image/")||file.size>8_000_000){setError("Choose a photo under 8 MB.");return;}
    try{
      const url=URL.createObjectURL(file);
      try{
        const img=new Image();img.src=url;await img.decode();
        const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
        const ctx=canvas.getContext("2d");if(!ctx)throw new Error();
        const side=Math.min(img.width,img.height);
        ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,256,256);
        localStorage.setItem(key(code),canvas.toDataURL("image/jpeg",.78));
      }finally{URL.revokeObjectURL(url);}
      setError("");window.dispatchEvent(new Event("re-profile-photo"));
    }catch{setError("This photo could not be saved on this device.");}
  }
  const avatar=<span className={`re-profile-photo ${className}`} aria-label={`${name}'s profile picture`}>{photo?<img src={photo} alt=""/>:<span aria-hidden>{name.slice(0,1).toUpperCase()}</span>}</span>;
  if(!editable)return avatar;
  return <span className="re-profile-photo-editor"><button type="button" className="re-profile-photo-button" onClick={()=>input.current?.click()} aria-label={`Choose ${name}'s profile picture`}>{avatar}<span className="re-photo-edit-mark" aria-hidden>＋</span></button><input ref={input} type="file" accept="image/*" hidden onChange={e=>{void choose(e.target.files?.[0]);e.target.value="";}}/><span className="re-photo-edit-label">Choose a picture · this device only</span>{photo&&<button type="button" className="re-photo-remove" onClick={()=>{localStorage.removeItem(key(code));window.dispatchEvent(new Event("re-profile-photo"));}}>Remove photo</button>}{error&&<span role="alert" className="re-photo-error">{error}</span>}</span>;
}
