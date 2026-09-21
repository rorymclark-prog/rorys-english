import {getBundle} from '@/lib/content';
import DocumentsView from '@/components/views/DocumentsView';
export default async function DocumentsPage({params}:{params:Promise<{code:string}>}){const {code}=await params;const bundle=getBundle(code)!;return <DocumentsView code={code} name={bundle.student.displayName}/>;}
