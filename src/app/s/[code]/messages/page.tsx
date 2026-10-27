import InboxView from '@/components/views/InboxView';
export default async function MessagesPage({params}:{params:Promise<{code:string}>}){const {code}=await params;return <InboxView code={code} name="Rory" initialTab="messages"/>;}
