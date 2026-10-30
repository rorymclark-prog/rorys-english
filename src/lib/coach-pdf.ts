import type { LessonPage } from "./coach-position";

type PdfIndexSource = {numPages:number;getPage:(page:number)=>Promise<{getTextContent:()=>Promise<{items:unknown[]}>}>};
/** Index all pages, even when the presenter remains on the title slide. */
export async function indexCoachPdf(pdf:PdfIndexSource,cancelled:()=>boolean):Promise<LessonPage[]> {
  if(pdf.numPages<1||pdf.numPages>200)throw new Error("Choose a PDF with at most 200 pages.");
  const pages:LessonPage[]=[];
  for(let page=1;page<=pdf.numPages;page++){
    if(cancelled())return [];
    const slide=await pdf.getPage(page),content=await slide.getTextContent();
    if(cancelled())return [];
    const text=content.items.map(item=>item&&typeof item==="object"&&"str" in item&&typeof item.str==="string"?item.str+("hasEOL" in item&&item.hasEOL?"\n":" "):"").join("").trim().slice(0,12000);
    pages.push({number:page,text});
  }
  return pages;
}
