import {postProgress} from "@/lib/server/progress-transport";
import {googleHttp} from "@/lib/server/google-http";
import {buildLessonsIcs,type FeedLesson} from "@/lib/lesson-calendar";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive"};
export async function GET(request:Request){
  const url=new URL(request.url),token=url.searchParams.get("token"),code=url.searchParams.get("code");
  if(!token||!/^[a-f0-9]{64}$/.test(token)||!code||code.length>100)return new Response("Calendar link unavailable.",{status:404,headers});
  try{
    const endpoint=process.env.APPS_SCRIPT_URL;if(!endpoint)throw Error("Unavailable");
    const reply=await postProgress(endpoint,{action:"calendarFeed",code,token},googleHttp,fetch);
    if(!reply.ok||!Array.isArray(reply.lessons))return new Response("Calendar link unavailable.",{status:404,headers});
    return new Response(buildLessonsIcs(reply.lessons as FeedLesson[]),{headers:{...headers,"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":"inline; filename=english-lessons.ics"}});
  }catch{
    // Never log bearer-link URLs or private event data. Failures must not look
    // like an empty calendar, which could erase a subscriber's existing events.
    return new Response("Calendar temporarily unavailable. Please try again.",{status:503,headers:{...headers,"Retry-After":"60"}});
  }
}
