'use client';
import {useEffect,useState} from 'react';
import {authed,request,savedSession} from '@/lib/api';
import type {Submission,Submissions} from '@/lib/remote';
import {homeworkProgress} from '@/lib/homework-progress';
import {viennaDay} from '@/lib/teacher-metrics';
import type {EngagementPanelProps} from './EngagementPanel';
import HomeworkProgressPanel from './HomeworkProgress';
import StatusRow from './StatusRow';
export default function HomeworkProgressLoader({code,teacher=false,source,sourceError='',summaryOnly=false,onRefresh,onWeeklySummary}:EngagementPanelProps){
 const [submissions,setSubmissions]=useState<Submission[]|null>(source?.submissions||null),[loading,setLoading]=useState(!source),[error,setError]=useState(''),[retry,setRetry]=useState(0),[week,setWeek]=useState('');
 useEffect(()=>{
  let active=true;setError('');
  if(source){setSubmissions(source.submissions);setLoading(false);return;}
  setLoading(true);setSubmissions(null);
  const read=teacher?request<Submissions>({action:'submissions',code,session:savedSession('__teacher__')?.token||''}):authed<Submissions>(code,{action:'submissions'});
  void read.then(result=>{if(!active)return;if(!result.ok||!Array.isArray(result.submissions))throw Error(result.error||'Saved homework could not be loaded.');setSubmissions(result.submissions);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Saved homework could not be loaded.');}).finally(()=>{if(active)setLoading(false);});
  const refresh=()=>setRetry(n=>n+1);window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('focus',refresh);};
 },[code,teacher,source,retry]);
 const today=viennaDay();
 useEffect(()=>{
  if(!onWeeklySummary)return;
  if(loading){onWeeklySummary({status:'loading'});return;}
  if(error||!submissions){onWeeklySummary({status:'error'});return;}
  onWeeklySummary({status:'ready',homework:homeworkProgress(code,submissions,today)});
 },[loading,error,submissions,code,today,onWeeklySummary]);
 if(summaryOnly)return null;
 if(loading)return <section className="engagement-panel" role="status" aria-busy="true"><h2>Homework progress</h2><p>Checking saved writing, spelling and multiplication…</p></section>;
 if(error||!submissions)return <StatusRow kind="error" onRetry={()=>{if(onRefresh)void onRefresh();else setRetry(n=>n+1);}}>{error||'Saved homework could not be loaded. No progress total has been assumed.'}</StatusRow>;
 return <HomeworkProgressPanel progress={homeworkProgress(code,submissions,today,week)} code={code} teacher={teacher} warning={sourceError} onWeekChange={setWeek} onRefresh={()=>{if(onRefresh)void onRefresh();else setRetry(n=>n+1);}}/>;
}
