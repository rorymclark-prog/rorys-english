// Browsers post here when the Content-Security-Policy blocks something on a
// page. One short line per report goes to the Vercel function logs; nothing is
// stored. Learner and parent codes are masked, and query strings dropped, so the
// log never holds a personal link.
export const runtime="nodejs";
export const dynamic="force-dynamic";

function clean(value:unknown):string{
  const raw=String(value??"").slice(0,300);
  let out=raw;
  try{const u=new URL(raw);out=u.protocol==="http:"||u.protocol==="https:"?u.origin+u.pathname:u.protocol;}catch{/* "inline", "eval", "blob", … */}
  return out.replace(/\/(s|p)\/[^/]+/g,"/$1/…").slice(0,200);
}

export async function POST(request:Request){
  const text=(await request.text()).slice(0,8000);
  let report:Record<string,unknown>={};
  try{
    const body=JSON.parse(text);
    // report-uri sends {"csp-report":{…}}; the Reporting API sends [{body:{…}}].
    report=body?.["csp-report"]??(Array.isArray(body)?body[0]?.body:body)??{};
  }catch{/* not JSON: ignore */}
  const directive=clean(report["effective-directive"]??report.effectiveDirective??report["violated-directive"]);
  if(directive)console.warn("csp-violation",JSON.stringify({directive,blocked:clean(report["blocked-uri"]??report.blockedURL),page:clean(report["document-uri"]??report.documentURL)}));
  return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
}
