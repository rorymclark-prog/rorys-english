import {getBundle} from '@/lib/content';
import LearningView from '@/components/views/LearningView';
import Link from 'next/link';
import {ChevronRightIcon,CheckSquareIcon,FileIcon} from '@/components/Icons';

export default async function TestPrepPage({params}:{params:Promise<{code:string}>}){
  const {code}=await params,bundle=getBundle(code)!;
  return <main className="re-screen-main test-prep-page"><header className="test-prep-hero"><p className="work-eyebrow">SCHOOL TESTS</p><h1>Test prep</h1><p>Read Rory’s review, choose one target, then try a fresh answer. Your practice and feedback stay together below.</p></header><nav className="ux-route-grid" aria-label="Related work pages"><Link className="ux-route-card" href={`/s/${code}/homework/`}><CheckSquareIcon/><span><strong>Homework</strong><small>See assigned tasks</small></span><ChevronRightIcon/></Link><Link className="ux-route-card" href={`/s/${code}/documents/`}><FileIcon/><span><strong>Documents</strong><small>Upload completed work</small></span><ChevronRightIcon/></Link></nav><LearningView code={code} name={bundle.student.displayName} mode="student" initialFilter="test" showHeader={false}/></main>;
}
