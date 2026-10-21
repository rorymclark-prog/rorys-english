"use client";
import { useEffect, useState } from "react";

// Receives slide-only messages from the teacher tab in this browser. No lesson
// transcript, learner records, coaching or teacher questions cross this channel.
export default function CoachAudienceView() {
  const [slide,setSlide]=useState<{image:string;page:number}|null>(null);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.hash.slice(1)).get("session");
    if(!id||!/^[a-f0-9-]{36}$/.test(id)||typeof BroadcastChannel==="undefined")return;
    const channel=new BroadcastChannel(`rory-slide-${id}`);
    channel.onmessage=event=>{const data=event.data;if(data?.type==="slide"&&typeof data.image==="string"&&data.image.length<=1_000_000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(data.image)&&Number.isInteger(data.page)&&data.page>=1&&data.page<=200)setSlide({image:data.image,page:data.page});if(data?.type==="clear")setSlide(null);};
    channel.postMessage({type:"ready"});
    return()=>channel.close();
  },[]);
  return <main style={{minHeight:"100dvh",background:"#17161c",color:"#faf8f5",display:"grid",placeItems:"center",padding:"1rem"}} aria-label="Student presentation window">
    {slide?<figure style={{width:"100%",margin:0,textAlign:"center"}}><img src={slide.image} alt={`Lesson slide ${slide.page}`} style={{width:"100%",height:"calc(100dvh - 4rem)",objectFit:"contain"}}/><figcaption style={{fontSize:".8rem",marginTop:".6rem"}}>Slide {slide.page}</figcaption></figure>:<div style={{textAlign:"center"}}><h1 style={{fontSize:"1.6rem",fontWeight:700}}>Your lesson</h1><p style={{marginTop:"1rem"}}>Waiting for Rory to show a slide.</p></div>}
  </main>;
}
