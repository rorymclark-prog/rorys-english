"use client";
import { isStudentPreview } from "@/lib/student-preview";
export default function StudyToolLink({href,className,children}:{href:string;className?:string;children:React.ReactNode}) {
  if(isStudentPreview())return <span className={className} aria-disabled="true">{children}<small className="mt-1 block text-xs no-underline">Practice scoring is disabled in teacher preview.</small></span>;
  return <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a>;
}
