"use client";
import {useParentLanguage} from "./ParentLanguage";
import { endParentPreview, isParentPreview, parentPreviewRoster } from "@/lib/parent-preview";
import ParentPreviewButton from "./ParentPreviewButton";
export default function ParentPreviewBanner({code,name}:{code:string;name:string}) {
  const {t}=useParentLanguage();
  if(!isParentPreview(code))return null;
  const others=parentPreviewRoster().filter(student=>student.code!==code);
  return <aside className="m-5" aria-label="Parent preview"><div className="preview-banner"><div><strong>{t(`Viewing as ${name}’s parent`,`Elternvorschau für ${name}`)}</strong><p>{t("Read-only preview · the same shared information parents see.","Schreibgeschützte Vorschau · dieselben Informationen wie im Elternbereich.")}</p></div><button type="button" onClick={()=>{endParentPreview();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/teacher/`);}}>{t("Exit preview ↗","Vorschau beenden ↗")}</button></div><details className="mt-3"><summary className="cursor-pointer text-sm font-bold">{t("View another student’s parent page","Elternbereich des anderen Schülers ansehen")}</summary>{others.map(student=><ParentPreviewButton key={student.code} code={student.code} name={student.name}/>)}</details></aside>;
}
