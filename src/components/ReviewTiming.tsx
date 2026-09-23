"use client";
import {useEffect,useState} from "react";

export const REVIEW_TIMING_NOTE="Homework is received straight away. Rory’s feedback appears after he approves it and at least five hours have passed since submission. It may take longer if he has not reviewed it yet. AI practice hints are separate, not Rory’s review.";

export default function ReviewTiming({availableAt,teacher=false}:{availableAt?:string;teacher?:boolean}) {
  const [time,setTime]=useState("");
  useEffect(()=>{
    const date=new Date(availableAt||"");
    setTime(Number.isFinite(date.getTime())?date.toLocaleString(undefined,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"");
  },[availableAt]);
  return <p className="mt-2 text-sm">{teacher?"You can approve feedback now. The app withholds it until five hours after submission; after that it is available automatically, without another publish step.":REVIEW_TIMING_NOTE}{time&&<> <strong>Earliest feedback: {time}.</strong></>}</p>;
}
