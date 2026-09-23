import {getBundle} from '@/lib/content';
import LearningView from '@/components/views/LearningView';

export default async function TestPrepPage({params}:{params:Promise<{code:string}>}){
  const {code}=await params,bundle=getBundle(code)!;
  return <main className="mx-auto max-w-5xl px-4 py-6"><header className="rounded-card bg-surface p-5 shadow-card dark:bg-navy-raised dark:shadow-card-dark"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-amber">School tests</p><h1 className="display mt-1 text-3xl">Test preparation</h1><p className="mt-2 text-sm">Keep the task, Rory’s feedback, your practice answers and any completed files together. Start with one target, then try a fresh answer.</p></header><LearningView code={code} name={bundle.student.displayName} mode="student" initialFilter="test"/></main>;
}
