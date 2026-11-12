import { getBundle } from "@/lib/content";
import AiCoachView from "@/components/views/AiCoachView";

export default async function CoachPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  getBundle(code); // 404 handled by the [code] layout
  return (
    <>
      <AiCoachView code={code} />
    </>
  );
}
