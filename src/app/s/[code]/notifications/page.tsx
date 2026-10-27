import InboxView from '@/components/views/InboxView';
export default async function NotificationsPage({params}:{params:Promise<{code:string}>}){const {code}=await params;return <InboxView code={code} name="Rory"/>;}
